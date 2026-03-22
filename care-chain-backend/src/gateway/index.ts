// src/gateway/index.ts
// API Gateway - Central entry point for scalable request handling

import { Request, Response, NextFunction, Router } from 'express';
import { RedisRateLimiter } from './rateLimiter';
import { CircuitBreaker } from './circuitBreaker';
import { RequestQueue } from './requestQueue';
import { GatewayCache } from './cache';
import { logger } from '../utils/logger';
import { ApiResponse } from '../utils/response';

export interface GatewayOptions {
  enableRateLimiting?: boolean;
  enableCircuitBreaker?: boolean;
  enableCaching?: boolean;
  enableRequestQueue?: boolean;
}

/**
 * API Gateway Class
 * Handles rate limiting, circuit breaking, caching, and request queuing
 */
export class ApiGateway {
  private rateLimiter: RedisRateLimiter;
  private circuitBreaker: CircuitBreaker;
  private requestQueue: RequestQueue;
  private cache: GatewayCache;
  private options: GatewayOptions;

  constructor(options: GatewayOptions = {}) {
    this.options = {
      enableRateLimiting: true,
      enableCircuitBreaker: true,
      enableCaching: true,
      enableRequestQueue: true,
      ...options,
    };

    this.rateLimiter = new RedisRateLimiter();
    this.circuitBreaker = new CircuitBreaker();
    this.requestQueue = new RequestQueue();
    this.cache = new GatewayCache();
  }

  /**
   * Initialize gateway components
   */
  async initialize(): Promise<void> {
    logger.info('Initializing API Gateway...');
    
    if (this.options.enableRequestQueue) {
      await this.requestQueue.initialize();
    }

    if (this.options.enableCircuitBreaker) {
      this.circuitBreaker.initialize();
    }

    logger.info('API Gateway initialized successfully');
  }

  /**
   * Rate limiting middleware using Redis
   */
  rateLimitMiddleware(config: {
    windowMs?: number;
    maxRequests?: number;
    keyPrefix?: string;
  } = {}) {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!this.options.enableRateLimiting) {
        return next();
      }

      try {
        const key = this.getClientKey(req, config.keyPrefix);
        const result = await this.rateLimiter.checkLimit(key, {
          windowMs: config.windowMs || 60000,
          maxRequests: config.maxRequests || 100,
        });

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', result.limit);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Reset', result.resetTime);

        if (!result.allowed) {
          res.setHeader('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000));
          return ApiResponse.tooManyRequests(res, 'Rate limit exceeded. Please try again later.');
        }

        next();
      } catch (error) {
        // Fallback to allowing request if rate limiter fails
        logger.warn('Rate limiter error, allowing request:', error);
        next();
      }
    };
  }

  /**
   * Circuit breaker middleware
   */
  circuitBreakerMiddleware(serviceName: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!this.options.enableCircuitBreaker) {
        return next();
      }

      try {
        const canProceed = await this.circuitBreaker.canRequest(serviceName);
        if (!canProceed) {
          return ApiResponse.serviceUnavailable(
            res,
            'Service temporarily unavailable. Please try again later.'
          );
        }

        // Record success/failure after response
        res.on('finish', () => {
          if (res.statusCode >= 500) {
            this.circuitBreaker.recordFailure(serviceName);
          } else {
            this.circuitBreaker.recordSuccess(serviceName);
          }
        });

        next();
      } catch (error) {
        logger.warn('Circuit breaker error:', error);
        next();
      }
    };
  }

  /**
   * Cache middleware for GET requests
   */
  cacheMiddleware(ttlSeconds: number = 60) {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!this.options.enableCaching || req.method !== 'GET') {
        return next();
      }

      try {
        const cacheKey = this.getCacheKey(req);
        const cached = await this.cache.get(cacheKey);

        if (cached) {
          res.setHeader('X-Cache', 'HIT');
          return res.json(cached);
        }

        // Store original json method
        const originalJson = res.json.bind(res);
        res.json = (body: any) => {
          // Cache successful responses
          if (res.statusCode >= 200 && res.statusCode < 300) {
            this.cache.set(cacheKey, body, ttlSeconds).catch(() => {});
          }
          res.setHeader('X-Cache', 'MISS');
          return originalJson(body);
        };

        next();
      } catch (error) {
        logger.warn('Cache middleware error:', error);
        next();
      }
    };
  }

  /**
   * Queue high-volume requests
   */
  queueMiddleware(queueName: string, priority: number = 5) {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!this.options.enableRequestQueue) {
        return next();
      }

      // Only queue POST/PUT/PATCH requests for bulk operations
      if (req.method === 'GET' || req.method === 'DELETE') {
        return next();
      }

      try {
        // Check if request should be queued based on system load
        const shouldQueue = await this.requestQueue.shouldQueueRequest();
        
        if (!shouldQueue) {
          return next(); // Process immediately
        }

        // Queue the request
        const jobId = await this.requestQueue.enqueue(queueName, {
          method: req.method,
          path: req.path,
          body: req.body,
          userId: (req as any).user?.id,
          headers: {
            authorization: req.headers.authorization || '',
            'content-type': req.headers['content-type'] || 'application/json',
          },
        }, priority);

        // Return accepted response with job ID
        return res.status(202).json({
          success: true,
          message: 'Request queued for processing',
          data: {
            jobId,
            status: 'queued',
            estimatedTime: '30 seconds',
          },
        });
      } catch (error) {
        logger.warn('Queue middleware error, processing synchronously:', error);
        next();
      }
    };
  }

  /**
   * Bulk operation handler - handles 1000+ concurrent requests
   */
  bulkOperationMiddleware(maxBatchSize: number = 100) {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Check if this is a bulk operation
      if (!Array.isArray(req.body) && !req.body?.items) {
        return next();
      }

      const items = Array.isArray(req.body) ? req.body : req.body.items;
      
      if (items.length <= maxBatchSize) {
        return next(); // Process normally
      }

      try {
        // Split into batches and queue
        const batches = this.chunkArray(items, maxBatchSize);
        const jobIds: string[] = [];

        for (let i = 0; i < batches.length; i++) {
          const jobId = await this.requestQueue.enqueue('bulk-operations', {
            method: req.method,
            path: req.path,
            batch: batches[i],
            batchIndex: i,
            totalBatches: batches.length,
            userId: (req as any).user?.id,
          }, 1); // High priority

          jobIds.push(jobId);
        }

        return res.status(202).json({
          success: true,
          message: 'Bulk operation queued for processing',
          data: {
            jobIds,
            totalItems: items.length,
            batchCount: batches.length,
            batchSize: maxBatchSize,
          },
        });
      } catch (error) {
        logger.error('Bulk operation error:', error);
        next(error);
      }
    };
  }

  /**
   * Health check for gateway components
   */
  async healthCheck(): Promise<{
    rateLimiter: boolean;
    circuitBreaker: boolean;
    cache: boolean;
    queue: boolean;
  }> {
    return {
      rateLimiter: await this.rateLimiter.isHealthy(),
      circuitBreaker: this.circuitBreaker.isHealthy(),
      cache: await this.cache.isHealthy(),
      queue: await this.requestQueue.isHealthy(),
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down API Gateway...');
    await this.requestQueue.close();
    await this.rateLimiter.close();
    await this.cache.close();
    logger.info('API Gateway shutdown complete');
  }

  // Helper methods
  private getClientKey(req: Request, prefix?: string): string {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = (req as any).user?.id;
    const identifier = userId || ip;
    return `${prefix || 'general'}:${identifier}`;
  }

  private getCacheKey(req: Request): string {
    const userId = (req as any).user?.id || 'anonymous';
    return `cache:${req.method}:${req.originalUrl}:${userId}`;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Export singleton instance
export const apiGateway = new ApiGateway();

export default apiGateway;
