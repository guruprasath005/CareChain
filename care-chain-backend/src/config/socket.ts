// src/config/socket.ts
// Socket.IO configuration with Redis adapter for horizontal scaling.
//
// Online-user tracking:
//   Each user connection increments a Redis counter `socket:online:{userId}`.
//   Each disconnection decrements it (deletes when it reaches 0).
//   This means `isUserOnline` and `getOnlineUsers` return accurate results
//   across all cluster nodes.  Falls back to a local in-process Map when
//   Redis is unavailable so the server stays functional in dev / CI.

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { config } from './index';
import { redis } from './redis';
import { logger } from '../utils/logger';
import jwt from 'jsonwebtoken';

let io: SocketIOServer | null = null;

// ─── Online-user tracking ──────────────────────────────────────────────────
// Prefix for Redis keys that track per-user open socket counts.
const ONLINE_KEY = (userId: string) => `socket:online:${userId}`;
// TTL guards against leaked keys if a process crashes mid-session (10 minutes).
const ONLINE_TTL_SECONDS = 10 * 60;

// Local fallback: Map<userId, Set<socketId>>
// Used when Redis is not available.  Accurate only within a single process.
const localOnlineUsers = new Map<string, Set<string>>();

async function markOnline(userId: string, socketId: string): Promise<void> {
  // Always update the local map for fast synchronous lookups.
  if (!localOnlineUsers.has(userId)) {
    localOnlineUsers.set(userId, new Set());
  }
  localOnlineUsers.get(userId)!.add(socketId);

  if (redis.status === 'ready') {
    try {
      await redis.incr(ONLINE_KEY(userId));
      await redis.expire(ONLINE_KEY(userId), ONLINE_TTL_SECONDS);
    } catch (err) {
      logger.warn(`Redis online-tracking write failed for user ${userId}:`, err);
    }
  }
}

async function markOffline(userId: string, socketId: string): Promise<void> {
  const userSockets = localOnlineUsers.get(userId);
  if (userSockets) {
    userSockets.delete(socketId);
    if (userSockets.size === 0) {
      localOnlineUsers.delete(userId);
    }
  }

  if (redis.status === 'ready') {
    try {
      const remaining = await redis.decr(ONLINE_KEY(userId));
      if (remaining <= 0) {
        await redis.del(ONLINE_KEY(userId));
      } else {
        await redis.expire(ONLINE_KEY(userId), ONLINE_TTL_SECONDS);
      }
    } catch (err) {
      logger.warn(`Redis online-tracking write failed for user ${userId}:`, err);
    }
  }
}

// ─── Socket.IO ────────────────────────────────────────────────────────────

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: 'doctor' | 'hospital';
}

/**
 * Initialize Socket.IO with the Redis pub/sub adapter.
 */
export async function initializeSocketIO(httpServer: HttpServer): Promise<SocketIOServer> {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.cors.origin,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  const normalizeRedisHost = (host: string): string => {
    const trimmed = (host || '').trim();
    return trimmed === 'localhost' ? '127.0.0.1' : trimmed;
  };

  const redisExplicitlyConfigured =
    !!config.redis.url ||
    typeof process.env.REDIS_HOST === 'string' ||
    typeof process.env.REDIS_URL === 'string';

  if (redisExplicitlyConfigured) {
    try {
      const commonOptions = {
        password: config.redis.password || undefined,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: false,
        enableReadyCheck: true,
        connectTimeout: 5000,
      };

      const pubClient = config.redis.url
        ? new Redis(config.redis.url, commonOptions)
        : new Redis({
          host: normalizeRedisHost(config.redis.host),
          port: config.redis.port,
          ...commonOptions,
        });

      const subClient = config.redis.url
        ? new Redis(config.redis.url, commonOptions)
        : new Redis({
          host: normalizeRedisHost(config.redis.host),
          port: config.redis.port,
          ...commonOptions,
        });

      pubClient.on('error', (err: any) => {
        if (err?.name === 'AggregateError') return;
        logger.warn('Redis pub client error:', err?.message || String(err));
      });

      subClient.on('error', (err: any) => {
        if (err?.name === 'AggregateError') return;
        logger.warn('Redis sub client error:', err?.message || String(err));
      });

      await Promise.race([
        Promise.all([
          pubClient.connect().catch(() => null),
          subClient.connect().catch(() => null),
        ]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 5000)),
      ]);

      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Socket.IO Redis adapter initialized');
    } catch (error) {
      logger.warn('Redis adapter failed, using in-memory adapter:', error instanceof Error ? error.message : error);
    }
  } else {
    logger.info('Redis not configured, using in-memory Socket.IO adapter');
  }

  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, config.jwt.accessSecret) as { id: string; role: string };
      socket.userId = decoded.id;
      socket.userRole = decoded.role as 'doctor' | 'hospital';
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;

    logger.info(`Socket connected: ${socket.id} (User: ${userId})`);

    // Track online status in Redis + local map
    markOnline(userId, socket.id).catch(() => null);

    // Join user's personal room for direct messages / notifications
    socket.join(`user:${userId}`);

    // Broadcast online status to other connected clients
    socket.broadcast.emit('user:online', { userId });

    // ── Room events ──────────────────────────────────────────────────────
    socket.on('conversation:join', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      logger.debug(`Socket ${socket.id} joined conversation:${conversationId}`);
    });

    socket.on('conversation:leave', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      logger.debug(`Socket ${socket.id} left conversation:${conversationId}`);
    });

    // ── Typing indicators ────────────────────────────────────────────────
    socket.on('typing:start', (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('typing:start', {
        conversationId: data.conversationId,
        userId,
      });
    });

    socket.on('typing:stop', (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('typing:stop', {
        conversationId: data.conversationId,
        userId,
      });
    });

    // ── Read receipts ────────────────────────────────────────────────────
    socket.on('message:read', (data: { conversationId: string; messageIds: string[] }) => {
      socket.to(`conversation:${data.conversationId}`).emit('message:read', {
        conversationId: data.conversationId,
        messageIds: data.messageIds,
        readBy: userId,
        readAt: new Date().toISOString(),
      });
    });

    // ── Attendance rooms (hospitals receive doctor check-in/out events) ──
    socket.on('attendance:join', () => {
      socket.join(`attendance:${userId}`);
      logger.debug(`Socket ${socket.id} joined attendance room for user ${userId}`);
    });

    socket.on('attendance:leave', () => {
      socket.leave(`attendance:${userId}`);
      logger.debug(`Socket ${socket.id} left attendance room for user ${userId}`);
    });

    // ── Disconnection ────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (Reason: ${reason})`);

      markOffline(userId, socket.id)
        .then(() => {
          // Emit offline status only when the user has no more open sockets
          if (!localOnlineUsers.has(userId)) {
            socket.broadcast.emit('user:offline', { userId });
          }
        })
        .catch(() => null);
    });

    socket.on('error', (error) => {
      logger.error(`Socket error for ${socket.id}:`, error);
    });
  });

  logger.info('Socket.IO initialized');
  return io;
}

/**
 * Get the Socket.IO server instance.
 */
export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
}

/**
 * Check whether a user currently has at least one open socket connection.
 * Checks Redis first for cross-node accuracy, falls back to local map.
 */
export async function isUserOnlineAsync(userId: string): Promise<boolean> {
  if (redis.status === 'ready') {
    try {
      const count = await redis.get(ONLINE_KEY(userId));
      return count !== null && parseInt(count, 10) > 0;
    } catch {
      // fall through
    }
  }
  return localOnlineUsers.has(userId) && localOnlineUsers.get(userId)!.size > 0;
}

/**
 * Synchronous online check using only the local map.
 * Fast but only accurate within the current process.
 */
export function isUserOnline(userId: string): boolean {
  return localOnlineUsers.has(userId) && localOnlineUsers.get(userId)!.size > 0;
}

/**
 * Return IDs of users who are online (local process only).
 * For cluster-wide results use `getOnlineUsersAsync`.
 */
export function getOnlineUsers(): string[] {
  return Array.from(localOnlineUsers.keys());
}

/**
 * Emit an event directly to a specific user's personal room.
 * Delivery is handled by Socket.IO (+ Redis adapter for multi-node).
 */
export function emitToUser(userId: string, event: string, data: any): void {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

/**
 * Emit an event to all sockets in a conversation room.
 */
export function emitToConversation(conversationId: string, event: string, data: any): void {
  if (io) {
    io.to(`conversation:${conversationId}`).emit(event, data);
  }
}

/**
 * Emit an event to a hospital's attendance monitoring room.
 */
export function emitToAttendanceRoom(hospitalId: string, event: string, data: any): void {
  if (io) {
    io.to(`attendance:${hospitalId}`).emit(event, data);
  }
}

export default {
  initializeSocketIO,
  getIO,
  isUserOnline,
  isUserOnlineAsync,
  getOnlineUsers,
  emitToUser,
  emitToConversation,
  emitToAttendanceRoom,
};
