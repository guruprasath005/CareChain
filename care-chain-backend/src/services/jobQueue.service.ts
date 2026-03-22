// src/services/jobQueue.service.ts
// Job Posting Queue Service - Handles 1000+ concurrent job postings

import { Queue, Worker, Job, QueueEvents, FlowProducer } from 'bullmq';
import Redis from 'ioredis';
import { createBullMQConnection } from '../config/redisConnection';
import { logger } from '../utils/logger';
import { jobService, CreateJobData } from './job.service';

export interface JobPostingRequest {
  hospitalId: string;
  jobData: CreateJobData;
  priority?: number;
  userId?: string;
}

export interface BulkJobPostingRequest {
  hospitalId: string;
  jobs: CreateJobData[];
  userId?: string;
}

export interface JobPostingResult {
  success: boolean;
  jobId?: string;
  error?: string;
  createdAt?: Date;
}

/**
 * Job Queue Service
 * Handles high-volume job postings with rate limiting and priority queuing
 */
class JobQueueService {
  private connection: Redis | null = null;
  private jobPostingQueue: Queue | null = null;
  private bulkOperationsQueue: Queue | null = null;
  private worker: Worker | null = null;
  private bulkWorker: Worker | null = null;
  private flowProducer: FlowProducer | null = null;
  private isInitialized: boolean = false;
  private fallbackQueue: Array<{
    request: JobPostingRequest;
    resolve: Function;
    reject: Function;
  }> = [];
  private processingFallback: boolean = false;

  /**
   * Initialize the job queue service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Create BullMQ-compatible connection with error handler attached first
      this.connection = createBullMQConnection('JobQueue');

      // Try to connect with timeout
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

      const connected = await Promise.race([connectPromise, timeoutPromise]);

      if (!connected) {
        logger.debug('Job queue using in-memory fallback');
        if (this.connection) {
          try { this.connection.disconnect(); } catch {}
          this.connection = null;
        }
        this.isInitialized = false;
        this.startFallbackProcessor();
        return;
      }

      // Create job posting queue
      this.jobPostingQueue = new Queue('job-posting', {
        connection: this.connection,
        defaultJobOptions: {
          removeOnComplete: { age: 3600, count: 5000 },
          removeOnFail: { age: 86400, count: 1000 },
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        },
      });

      // Create bulk operations queue
      this.bulkOperationsQueue = new Queue('bulk-job-posting', {
        connection: this.connection,
        defaultJobOptions: {
          removeOnComplete: { age: 7200, count: 1000 },
          removeOnFail: { age: 86400, count: 500 },
          attempts: 2,
          backoff: { type: 'fixed', delay: 2000 },
        },
      });

      // Create flow producer for complex workflows
      this.flowProducer = new FlowProducer({ connection: this.connection });

      // Create worker for single job postings
      this.worker = new Worker(
        'job-posting',
        async (job: Job<JobPostingRequest>) => {
          return await this.processJobPosting(job.data);
        },
        {
          connection: this.connection,
          concurrency: 50, // Process 50 jobs concurrently
          limiter: {
            max: 200,        // Max 200 jobs
            duration: 1000,  // Per second
          },
        }
      );

      // Create worker for bulk operations
      this.bulkWorker = new Worker(
        'bulk-job-posting',
        async (job: Job<BulkJobPostingRequest>) => {
          return await this.processBulkJobPosting(job.data);
        },
        {
          connection: this.connection,
          concurrency: 5,  // Process 5 bulk operations concurrently
          limiter: {
            max: 10,
            duration: 1000,
          },
        }
      );

      this.setupEventHandlers();
      this.isInitialized = true;
      logger.info('Job Queue Service initialized');
    } catch (error) {
      logger.warn('Job Queue falling back to synchronous processing:', error);
      this.isInitialized = false;
      this.startFallbackProcessor();
    }
  }

  private setupEventHandlers(): void {
    if (this.worker) {
      this.worker.on('completed', (job, result) => {
        logger.debug(`Job posting ${job.id} completed`);
      });

      this.worker.on('failed', (job, error) => {
        logger.error(`Job posting ${job?.id} failed:`, error.message);
      });

      this.worker.on('stalled', (jobId) => {
        logger.warn(`Job posting ${jobId} stalled`);
      });
    }

    if (this.bulkWorker) {
      this.bulkWorker.on('completed', (job, result) => {
        logger.info(`Bulk job posting ${job.id} completed:`, result);
      });

      this.bulkWorker.on('failed', (job, error) => {
        logger.error(`Bulk job posting ${job?.id} failed:`, error.message);
      });
    }
  }

  private startFallbackProcessor(): void {
    setInterval(async () => {
      if (this.processingFallback || this.fallbackQueue.length === 0) return;

      this.processingFallback = true;
      const batch = this.fallbackQueue.splice(0, 10);

      for (const item of batch) {
        try {
          const result = await this.processJobPosting(item.request);
          item.resolve(result);
        } catch (error) {
          item.reject(error);
        }
      }

      this.processingFallback = false;
    }, 100);
  }

  /**
   * Queue a single job posting
   */
  async queueJobPosting(request: JobPostingRequest): Promise<string> {
    if (!this.isInitialized || !this.jobPostingQueue) {
      // Fallback to synchronous processing
      return new Promise((resolve, reject) => {
        this.fallbackQueue.push({ request, resolve: (r: any) => resolve(r.jobId), reject });
      });
    }

    const job = await this.jobPostingQueue.add('create-job', request, {
      priority: request.priority || 5,
      jobId: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    });

    return job.id!;
  }

  /**
   * Queue bulk job postings (for 1000+ jobs)
   */
  async queueBulkJobPosting(request: BulkJobPostingRequest): Promise<{
    batchId: string;
    totalJobs: number;
    estimatedTime: string;
  }> {
    const batchId = `bulk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (!this.isInitialized || !this.bulkOperationsQueue) {
      // Process synchronously in smaller batches
      const results: JobPostingResult[] = [];
      const batchSize = 50;

      for (let i = 0; i < request.jobs.length; i += batchSize) {
        const batch = request.jobs.slice(i, i + batchSize);
        for (const jobData of batch) {
          try {
            const result = await this.processJobPosting({
              hospitalId: request.hospitalId,
              jobData,
              userId: request.userId,
            });
            results.push(result);
          } catch (error: any) {
            results.push({ success: false, error: error.message });
          }
        }
      }

      return {
        batchId,
        totalJobs: request.jobs.length,
        estimatedTime: '0s (completed)',
      };
    }

    // Split into chunks and queue
    const chunkSize = 100;
    const chunks: CreateJobData[][] = [];
    
    for (let i = 0; i < request.jobs.length; i += chunkSize) {
      chunks.push(request.jobs.slice(i, i + chunkSize));
    }

    // Queue each chunk
    for (let i = 0; i < chunks.length; i++) {
      await this.bulkOperationsQueue.add(
        'bulk-create',
        {
          hospitalId: request.hospitalId,
          jobs: chunks[i],
          userId: request.userId,
        },
        {
          priority: 1, // High priority for bulk
          jobId: `${batchId}-chunk-${i}`,
        }
      );
    }

    const estimatedSeconds = Math.ceil(request.jobs.length / 100) * 2;

    return {
      batchId,
      totalJobs: request.jobs.length,
      estimatedTime: `${estimatedSeconds}s`,
    };
  }

  /**
   * Process a single job posting
   */
  private async processJobPosting(request: JobPostingRequest): Promise<JobPostingResult> {
    try {
      const job = await jobService.createJob(request.hospitalId, request.jobData);
      
      return {
        success: true,
        jobId: job.id,
        createdAt: new Date(),
      };
    } catch (error: any) {
      logger.error('Job posting failed:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Process bulk job postings
   */
  private async processBulkJobPosting(request: BulkJobPostingRequest): Promise<{
    total: number;
    successful: number;
    failed: number;
    results: JobPostingResult[];
  }> {
    const results: JobPostingResult[] = [];
    let successful = 0;
    let failed = 0;

    // Process in parallel with concurrency limit
    const concurrencyLimit = 10;
    const batches: CreateJobData[][] = [];
    
    for (let i = 0; i < request.jobs.length; i += concurrencyLimit) {
      batches.push(request.jobs.slice(i, i + concurrencyLimit));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (jobData) => {
        const result = await this.processJobPosting({
          hospitalId: request.hospitalId,
          jobData,
          userId: request.userId,
        });

        if (result.success) {
          successful++;
        } else {
          failed++;
        }

        return result;
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    logger.info(`Bulk job posting completed: ${successful}/${request.jobs.length} successful`);

    return {
      total: request.jobs.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<{
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'unknown';
    result?: JobPostingResult;
    error?: string;
  }> {
    if (!this.jobPostingQueue) {
      return { status: 'unknown' };
    }

    const job = await this.jobPostingQueue.getJob(jobId);
    if (!job) {
      return { status: 'unknown' };
    }

    const state = await job.getState();

    if (state === 'completed') {
      return {
        status: 'completed',
        result: job.returnvalue,
      };
    } else if (state === 'failed') {
      return {
        status: 'failed',
        error: job.failedReason,
      };
    }

    return { status: state as any };
  }

  /**
   * Get bulk operation status
   */
  async getBulkStatus(batchId: string): Promise<{
    status: 'processing' | 'completed' | 'partial' | 'failed';
    progress: number;
    completed: number;
    failed: number;
    total: number;
  }> {
    if (!this.bulkOperationsQueue) {
      return {
        status: 'completed',
        progress: 100,
        completed: 0,
        failed: 0,
        total: 0,
      };
    }

    // Get all jobs with this batch ID prefix
    const jobs = await this.bulkOperationsQueue.getJobs(
      ['waiting', 'active', 'completed', 'failed'],
      0,
      1000
    );

    const batchJobs = jobs.filter((j) => j.id?.startsWith(batchId));
    const total = batchJobs.length;
    
    if (total === 0) {
      return {
        status: 'completed',
        progress: 100,
        completed: 0,
        failed: 0,
        total: 0,
      };
    }

    let completed = 0;
    let failed = 0;
    let processing = 0;

    for (const job of batchJobs) {
      const state = await job.getState();
      if (state === 'completed') completed++;
      else if (state === 'failed') failed++;
      else processing++;
    }

    const progress = Math.round(((completed + failed) / total) * 100);

    let status: 'processing' | 'completed' | 'partial' | 'failed';
    if (processing > 0) status = 'processing';
    else if (failed === total) status = 'failed';
    else if (failed > 0) status = 'partial';
    else status = 'completed';

    return { status, progress, completed, failed, total };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    jobPosting: { waiting: number; active: number; completed: number; failed: number };
    bulkPosting: { waiting: number; active: number; completed: number; failed: number };
  }> {
    const getStats = async (queue: Queue | null) => {
      if (!queue) {
        return { waiting: 0, active: 0, completed: 0, failed: 0 };
      }

      return {
        waiting: await queue.getWaitingCount(),
        active: await queue.getActiveCount(),
        completed: await queue.getCompletedCount(),
        failed: await queue.getFailedCount(),
      };
    };

    return {
      jobPosting: await getStats(this.jobPostingQueue),
      bulkPosting: await getStats(this.bulkOperationsQueue),
    };
  }

  /**
   * Pause processing
   */
  async pause(): Promise<void> {
    if (this.worker) await this.worker.pause();
    if (this.bulkWorker) await this.bulkWorker.pause();
    logger.info('Job queue processing paused');
  }

  /**
   * Resume processing
   */
  async resume(): Promise<void> {
    if (this.worker) await this.worker.resume();
    if (this.bulkWorker) await this.bulkWorker.resume();
    logger.info('Job queue processing resumed');
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Job Queue Service...');

    if (this.worker) await this.worker.close();
    if (this.bulkWorker) await this.bulkWorker.close();
    if (this.jobPostingQueue) await this.jobPostingQueue.close();
    if (this.bulkOperationsQueue) await this.bulkOperationsQueue.close();
    if (this.flowProducer) await this.flowProducer.close();
    if (this.connection) await this.connection.quit();

    logger.info('Job Queue Service shutdown complete');
  }
}

// Export singleton instance
export const jobQueueService = new JobQueueService();

export default jobQueueService;
