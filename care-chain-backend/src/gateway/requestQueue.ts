// src/gateway/requestQueue.ts
// BullMQ-based task queue for high-volume and background operations

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { createBullMQConnection } from '../config/redisConnection';
import { logger } from '../utils/logger';

export interface QueuedRequest {
  method: string;
  path: string;
  body?: any;
  batch?: any[];
  batchIndex?: number;
  totalBatches?: number;
  userId?: string;
  headers?: Record<string, string>;
  /** The logical task name used to look up the registered handler */
  taskName?: string;
}

export interface QueueJobResult {
  success: boolean;
  data?: any;
  error?: string;
  processedAt: Date;
}

type TaskHandler = (data: QueuedRequest) => Promise<any>;

/**
 * Request Queue using BullMQ.
 *
 * Architecture: instead of replaying raw HTTP requests (which doesn't work),
 * consumers register named task handlers via `registerHandler()`. When a job
 * is processed the queue dispatches to the matching handler by `taskName`.
 * This keeps business logic in services while still allowing async / retried
 * execution through BullMQ.
 *
 * Usage:
 *   requestQueue.registerHandler('bulk-job-create', async (data) => { ... });
 *   await requestQueue.enqueue('bulk-operations', { taskName: 'bulk-job-create', body: jobs });
 */
export class RequestQueue {
  private connection: Redis | null = null;
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private handlers: Map<string, TaskHandler> = new Map();
  private isConnected: boolean = false;
  private pendingRequests: Map<string, { resolve: Function; reject: Function }> = new Map();
  private inMemoryQueue: Array<{ data: QueuedRequest; priority: number; callback: Function }> = [];
  private inMemoryProcessor: NodeJS.Timeout | null = null;

  constructor() {}

  /**
   * Register a named handler that workers will call when processing jobs.
   * Must be registered before jobs of that taskName arrive.
   */
  registerHandler(taskName: string, handler: TaskHandler): void {
    this.handlers.set(taskName, handler);
    logger.debug(`Task handler registered: ${taskName}`);
  }

  async initialize(): Promise<void> {
    try {
      this.connection = createBullMQConnection('RequestQueue');

      const connectPromise = new Promise<boolean>(async (resolve) => {
        try {
          await this.connection!.connect();
          await this.connection!.ping();
          resolve(true);
        } catch {
          resolve(false);
        }
      });

      const timeoutPromise = new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(false), 3000)
      );

      this.isConnected = await Promise.race([connectPromise, timeoutPromise]);

      if (!this.isConnected) {
        logger.debug('Request queue using in-memory mode');
        if (this.connection) {
          try { this.connection.disconnect(); } catch {}
          this.connection = null;
        }
        this.startInMemoryProcessor();
        return;
      }

      // Initialize default queues
      await this.createQueue('job-posting');
      await this.createQueue('bulk-operations');
      await this.createQueue('notifications');
      await this.createQueue('email');

      logger.info('Request queues initialized');
    } catch (error) {
      logger.warn('Queue falling back to in-memory processing');
      this.isConnected = false;
      this.startInMemoryProcessor();
    }
  }

  private startInMemoryProcessor(): void {
    if (this.inMemoryProcessor) return;

    this.inMemoryProcessor = setInterval(async () => {
      if (this.inMemoryQueue.length === 0) return;

      // Sort by priority (lower = higher priority)
      this.inMemoryQueue.sort((a, b) => a.priority - b.priority);

      // Process up to 10 items at a time
      const batch = this.inMemoryQueue.splice(0, 10);

      for (const item of batch) {
        try {
          const result = await this.dispatch(item.data);
          item.callback(null, result);
        } catch (error) {
          item.callback(error, null);
        }
      }
    }, 100);
  }

  private async createQueue(name: string): Promise<Queue | null> {
    if (!this.isConnected || !this.connection) return null;

    try {
      const queue = new Queue(name, {
        connection: this.connection,
        defaultJobOptions: {
          removeOnComplete: {
            age: 3600,
            count: 1000,
          },
          removeOnFail: {
            age: 86400,
            count: 500,
          },
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      });

      this.queues.set(name, queue);

      const worker = new Worker(
        name,
        async (job: Job<QueuedRequest>) => {
          return await this.dispatch(job.data);
        },
        {
          connection: this.connection,
          concurrency: 10,
          limiter: {
            max: 100,
            duration: 1000,
          },
        }
      );

      worker.on('completed', (job, result) => {
        logger.debug(`Job ${job.id} completed`, { queue: name });
        const pending = this.pendingRequests.get(job.id!);
        if (pending) {
          pending.resolve(result);
          this.pendingRequests.delete(job.id!);
        }
      });

      worker.on('failed', (job, error) => {
        logger.error(`Job ${job?.id} failed in queue "${name}":`, error.message);
        if (job?.id) {
          const pending = this.pendingRequests.get(job.id);
          if (pending) {
            pending.reject(error);
            this.pendingRequests.delete(job.id);
          }
        }
      });

      this.workers.set(name, worker);
      return queue;
    } catch (error) {
      logger.error(`Failed to create queue ${name}:`, error);
      return null;
    }
  }

  /**
   * Dispatch a job to its registered handler by taskName.
   * Falls back to a no-op result if no handler is registered (logs a warning).
   */
  private async dispatch(data: QueuedRequest): Promise<QueueJobResult> {
    const taskName = data.taskName || data.path;

    if (!taskName) {
      logger.warn('Queued job has no taskName and no path — skipping');
      return { success: false, error: 'No taskName specified', processedAt: new Date() };
    }

    const handler = this.handlers.get(taskName);

    if (!handler) {
      logger.warn(`No handler registered for task "${taskName}" — skipping`);
      return {
        success: false,
        error: `No handler for task: ${taskName}`,
        processedAt: new Date(),
      };
    }

    try {
      logger.debug(`Dispatching task: ${taskName}`, {
        batchIndex: data.batchIndex,
        totalBatches: data.totalBatches,
      });

      const result = await handler(data);

      return {
        success: true,
        data: result,
        processedAt: new Date(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Task "${taskName}" failed:`, message);
      return {
        success: false,
        error: message,
        processedAt: new Date(),
      };
    }
  }

  /**
   * Enqueue a task for processing.
   * Set `data.taskName` to match a registered handler.
   */
  async enqueue(
    queueName: string,
    data: QueuedRequest,
    priority: number = 5
  ): Promise<string> {
    if (!this.isConnected) {
      return new Promise((resolve, reject) => {
        const jobId = `inmem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        this.inMemoryQueue.push({
          data,
          priority,
          callback: (error: any, _result: any) => {
            if (error) reject(error);
          },
        });

        resolve(jobId);
      });
    }

    let queue = this.queues.get(queueName);
    if (!queue) {
      const newQueue = await this.createQueue(queueName);
      if (newQueue) {
        queue = newQueue;
      }
    }

    if (!queue) {
      throw new Error(`Queue "${queueName}" not available`);
    }

    const job = await queue.add(queueName, data, {
      priority,
      jobId: `${queueName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    });

    return job.id!;
  }

  /**
   * Enqueue multiple tasks as a batch.
   */
  async enqueueBatch(
    queueName: string,
    items: QueuedRequest[],
    priority: number = 5
  ): Promise<string[]> {
    if (!this.isConnected) {
      const jobIds: string[] = [];
      for (const item of items) {
        const id = await this.enqueue(queueName, item, priority);
        jobIds.push(id);
      }
      return jobIds;
    }

    let queue = this.queues.get(queueName);
    if (!queue) {
      const newQueue = await this.createQueue(queueName);
      if (newQueue) queue = newQueue;
    }

    if (!queue) {
      throw new Error(`Queue "${queueName}" not available`);
    }

    const jobs = await queue.addBulk(
      items.map((data, index) => ({
        name: queueName,
        data,
        opts: {
          priority,
          jobId: `${queueName}-batch-${Date.now()}-${index}`,
        },
      }))
    );

    return jobs.map((job) => job.id!);
  }

  /**
   * Wait for a specific job to complete.
   */
  async waitForJob(jobId: string, timeoutMs: number = 30000): Promise<QueueJobResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(jobId);
        reject(new Error('Job timeout'));
      }, timeoutMs);

      this.pendingRequests.set(jobId, {
        resolve: (result: QueueJobResult) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
  }

  /**
   * Get status of a specific job.
   */
  async getJobStatus(queueName: string, jobId: string): Promise<{
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'unknown';
    progress?: number;
    result?: any;
    error?: string;
  }> {
    if (!this.isConnected) {
      return { status: 'unknown' };
    }

    const queue = this.queues.get(queueName);
    if (!queue) return { status: 'unknown' };

    const job = await queue.getJob(jobId);
    if (!job) return { status: 'unknown' };

    const state = await job.getState();
    const result: any = { status: state as any, progress: job.progress };

    if (state === 'completed') result.result = job.returnvalue;
    else if (state === 'failed') result.error = job.failedReason;

    return result;
  }

  /**
   * Get queue statistics.
   */
  async getStats(): Promise<{
    queues: Record<string, {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    }>;
  }> {
    if (!this.isConnected) {
      return {
        queues: {
          'in-memory': {
            waiting: this.inMemoryQueue.length,
            active: 0,
            completed: 0,
            failed: 0,
          },
        },
      };
    }

    const stats: Record<string, any> = {};
    for (const [name, queue] of this.queues) {
      stats[name] = {
        waiting: await queue.getWaitingCount(),
        active: await queue.getActiveCount(),
        completed: await queue.getCompletedCount(),
        failed: await queue.getFailedCount(),
      };
    }

    return { queues: stats };
  }

  /**
   * Return true when the queue is under load and new requests should be deferred.
   */
  async shouldQueueRequest(): Promise<boolean> {
    if (!this.isConnected) {
      return this.inMemoryQueue.length > 100;
    }

    try {
      let totalWaiting = 0;
      for (const queue of this.queues.values()) {
        totalWaiting += await queue.getWaitingCount();
      }
      return totalWaiting > 50;
    } catch {
      return false;
    }
  }

  async isHealthy(): Promise<boolean> {
    if (!this.isConnected) return true;

    try {
      if (this.connection) {
        await this.connection.ping();
        return true;
      }
    } catch {
      return false;
    }

    return false;
  }

  async close(): Promise<void> {
    if (this.inMemoryProcessor) {
      clearInterval(this.inMemoryProcessor);
    }

    for (const worker of this.workers.values()) {
      await worker.close();
    }

    for (const queue of this.queues.values()) {
      await queue.close();
    }

    if (this.connection) {
      await this.connection.quit();
    }
  }
}

export default RequestQueue;
