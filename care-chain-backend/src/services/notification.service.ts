// src/services/notification.service.ts
// BullMQ-backed notification service with batching.
//
// Architecture:
//   - Callers push notifications via enqueue() — this is non-blocking.
//   - A BullMQ worker processes the queue, groups events by user, and
//     delivers them (Socket.IO real-time + FCM push + in-app store).
//   - Delayed "batch" jobs collect notifications for the same user within
//     a configurable window before sending, matching CareChainX's Celery-Beat
//     notification batching pattern.

import { Queue, Worker, Job as BullJob } from 'bullmq';
import { createBullMQConnection } from '../config/redisConnection';
import { User } from '../models/User.model';
import { logger } from '../utils/logger';
import { getIO } from '../config/socket';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'job_match'         // new job matches doctor's profile
  | 'application_update' // application status changed
  | 'offer_received'    // hospital sent a job offer
  | 'leave_update'      // leave request approved / rejected
  | 'attendance_alert'  // missed check-in/check-out
  | 'assignment_update' // assignment status changed
  | 'message'           // new chat message
  | 'system';           // admin broadcast

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** When true the notification is sent immediately, bypassing the batch window */
  urgent?: boolean;
}

// ─── Queue names ──────────────────────────────────────────────────────────────

const QUEUE_NOTIFICATION = 'notifications';
/** Batch-flush job name: consolidate pending notifications for one user */
const JOB_FLUSH = 'flush-user-notifications';
/** Default batch window in ms — notifications in this window are grouped */
const BATCH_DELAY_MS = parseInt(process.env.NOTIFICATION_BATCH_DELAY_MS || '15000', 10); // 15 s

// ─── Service ──────────────────────────────────────────────────────────────────

class NotificationService {
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private isReady = false;

  /** Pending batches: userId → list of payloads collected before flush */
  private pendingBatches: Map<string, NotificationPayload[]> = new Map();
  /** Track which users already have a scheduled flush job */
  private scheduledFlush: Set<string> = new Set();

  async init(): Promise<void> {
    try {
      const connection = createBullMQConnection();
      if (!connection) {
        logger.warn('NotificationService: Redis unavailable — using in-process delivery only');
        return;
      }

      this.queue = new Queue(QUEUE_NOTIFICATION, { connection });

      this.worker = new Worker(
        QUEUE_NOTIFICATION,
        async (job: BullJob) => {
          if (job.name === JOB_FLUSH) {
            await this.flushBatch(job.data.userId as string);
          }
        },
        { connection, concurrency: 5 }
      );

      this.worker.on('failed', (job, err) => {
        logger.error(`Notification job ${job?.id} failed:`, err.message);
      });

      this.isReady = true;
      logger.info('NotificationService initialised with BullMQ');
    } catch (err) {
      logger.warn('NotificationService init failed — degraded mode:', err);
    }
  }

  /**
   * Enqueue a notification for delivery.
   *
   * Urgent notifications are delivered immediately.
   * Normal notifications are batched per-user for BATCH_DELAY_MS before flush.
   */
  async enqueue(payload: NotificationPayload): Promise<void> {
    if (payload.urgent || !this.isReady) {
      // Deliver immediately (Socket.IO only for now)
      await this.deliverToSocket(payload.userId, [payload]);
      return;
    }

    // Accumulate in memory batch
    const batch = this.pendingBatches.get(payload.userId) ?? [];
    batch.push(payload);
    this.pendingBatches.set(payload.userId, batch);

    // Schedule a flush job if none exists for this user yet
    if (!this.scheduledFlush.has(payload.userId) && this.queue) {
      this.scheduledFlush.add(payload.userId);
      await this.queue.add(
        JOB_FLUSH,
        { userId: payload.userId },
        { delay: BATCH_DELAY_MS, jobId: `flush:${payload.userId}:${Date.now()}` }
      );
    }
  }

  /**
   * Convenience helpers for specific notification types.
   */
  async notifyJobMatch(doctorId: string, jobId: string, jobTitle: string): Promise<void> {
    await this.enqueue({
      userId: doctorId,
      type: 'job_match',
      title: 'New Job Match',
      body: `A new job "${jobTitle}" matches your profile.`,
      data: { jobId },
    });
  }

  async notifyApplicationUpdate(
    doctorId: string,
    applicationId: string,
    status: string,
    jobTitle: string
  ): Promise<void> {
    await this.enqueue({
      userId: doctorId,
      type: 'application_update',
      title: 'Application Update',
      body: `Your application for "${jobTitle}" is now ${status}.`,
      data: { applicationId, status },
      urgent: ['offer_made', 'hired', 'rejected'].includes(status),
    });
  }

  async notifyOfferReceived(doctorId: string, applicationId: string, jobTitle: string): Promise<void> {
    await this.enqueue({
      userId: doctorId,
      type: 'offer_received',
      title: 'Job Offer Received',
      body: `You have received a job offer for "${jobTitle}". Review it now.`,
      data: { applicationId },
      urgent: true,
    });
  }

  async notifyLeaveUpdate(
    doctorId: string,
    leaveId: string,
    status: 'approved' | 'rejected'
  ): Promise<void> {
    await this.enqueue({
      userId: doctorId,
      type: 'leave_update',
      title: `Leave Request ${status === 'approved' ? 'Approved' : 'Rejected'}`,
      body: `Your leave request has been ${status}.`,
      data: { leaveId, status },
      urgent: true,
    });
  }

  async notifyAttendanceAlert(doctorId: string, assignmentId: string, message: string): Promise<void> {
    await this.enqueue({
      userId: doctorId,
      type: 'attendance_alert',
      title: 'Attendance Alert',
      body: message,
      data: { assignmentId },
      urgent: true,
    });
  }

  async broadcastSystem(userIds: string[], title: string, body: string): Promise<void> {
    await Promise.allSettled(
      userIds.map((uid) =>
        this.enqueue({ userId: uid, type: 'system', title, body, urgent: false })
      )
    );
  }

  // ─── Delivery methods ──────────────────────────────────────────────────────

  /**
   * Flush all pending notifications for a user and deliver them.
   */
  private async flushBatch(userId: string): Promise<void> {
    this.scheduledFlush.delete(userId);
    const batch = this.pendingBatches.get(userId) ?? [];
    this.pendingBatches.delete(userId);

    if (batch.length === 0) return;

    logger.debug(`Flushing ${batch.length} notifications for user ${userId}`);
    await this.deliverToSocket(userId, batch);
    await this.deliverFcmPush(userId, batch);
  }

  /**
   * Send notifications via Socket.IO to connected clients.
   */
  private async deliverToSocket(userId: string, batch: NotificationPayload[]): Promise<void> {
    try {
      let io;
      try { io = getIO(); } catch { return; }
      if (!io) return;

      const room = `user:${userId}`;
      if (batch.length === 1) {
        io.to(room).emit('notification', batch[0]);
      } else {
        io.to(room).emit('notifications:batch', { count: batch.length, notifications: batch });
      }
    } catch (err) {
      logger.warn('Socket delivery failed:', err);
    }
  }

  /**
   * Send push notification via FCM (Firebase Cloud Messaging).
   * Looks up the user's stored fcmTokens and sends one message per token.
   * No-ops gracefully if firebase-admin is not configured.
   */
  private async deliverFcmPush(userId: string, batch: NotificationPayload[]): Promise<void> {
    try {
      const user = await User.findByPk(userId, { attributes: ['fcmTokens'] });
      const tokens: string[] = user?.fcmTokens ?? [];
      if (tokens.length === 0) return;

      // Group notifications into a single push (last one wins for title/body)
      const last = batch[batch.length - 1];
      const title = batch.length > 1 ? `${batch.length} new notifications` : last.title;
      const body = batch.length > 1
        ? batch.map((n) => n.body).join(' • ').slice(0, 150)
        : last.body;

      // Dynamic import to avoid crashing if firebase-admin is not installed
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const admin = require('firebase-admin') as any;
        if (!admin?.apps?.length) return;

        await Promise.allSettled(
          tokens.map((token: string) =>
            admin.messaging().send({
              token,
              notification: { title, body },
              data: { type: last.type, ...((last.data as Record<string, string>) ?? {}) },
            })
          )
        );
      } catch {
        // firebase-admin not configured — skip silently
      }
    } catch (err) {
      logger.warn('FCM delivery failed:', err);
    }
  }

  async close(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}

export const notificationService = new NotificationService();
export default notificationService;
