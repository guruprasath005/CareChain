// src/controllers/health.controller.ts
// Health Check Controller

import { Request, Response } from 'express';
import { ApiResponse } from '../utils/response';
import { apiGateway } from '../gateway';
import { cacheService } from '../services/cache.service';
import { jobQueueService } from '../services/jobQueue.service';
import { sequelize } from '../config/database';
import redis from '../config/redis';
import os from 'os';

/**
 * Health Controller
 */
export const healthController = {
  /**
   * GET /health
   * Health check endpoint
   */
  async check(req: Request, res: Response): Promise<void> {
    ApiResponse.success(res, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
    }, 'Service is healthy');
  },

  /**
   * GET /health/ready
   * Readiness check (checks database, redis, gateway, cache, queue)
   */
  async ready(req: Request, res: Response): Promise<void> {
    const checks: Record<string, 'ok' | 'error' | 'degraded'> = {
      database: 'error',
      redis: 'error',
      gateway: 'error',
      cache: 'error',
      queue: 'error',
    };

    // Check database
    try {
      await sequelize.authenticate();
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }

    // Check Redis
    try {
      if (redis.status === 'ready') {
        await redis.ping();
        checks.redis = 'ok';
      } else {
        checks.redis = 'degraded'; // Memory fallback
      }
    } catch {
      checks.redis = 'degraded'; // Memory fallback available
    }

    // Check Gateway
    try {
      const gatewayHealth = await apiGateway.healthCheck();
      const gatewayOk = gatewayHealth.rateLimiter || gatewayHealth.cache;
      checks.gateway = gatewayOk ? 'ok' : 'degraded';
    } catch {
      checks.gateway = 'degraded';
    }

    // Check Cache
    try {
      const cacheHealthy = await cacheService.isHealthy();
      checks.cache = cacheHealthy ? 'ok' : 'degraded';
    } catch {
      checks.cache = 'degraded';
    }

    // Check Queue
    try {
      const queueHealthy = await jobQueueService.getQueueStats();
      checks.queue = queueHealthy ? 'ok' : 'degraded';
    } catch {
      checks.queue = 'degraded';
    }

    // Determine overall status
    const hasError = Object.values(checks).includes('error');
    const allOk = Object.values(checks).every(status => status === 'ok');

    if (hasError) {
      // Critical failure - database must be ok
      if (checks.database === 'error') {
        ApiResponse.error(res, 'Service not ready - database unavailable', 503);
        return;
      }
    }

    if (allOk) {
      ApiResponse.success(res, { checks, status: 'ready' }, 'All services ready');
    } else {
      ApiResponse.success(res, { checks, status: 'degraded' }, 'Service ready with degraded features');
    }
  },

  /**
   * GET /health/live
   * Liveness check (basic process check)
   */
  async live(req: Request, res: Response): Promise<void> {
    ApiResponse.success(res, { alive: true }, 'Service is alive');
  },

  /**
   * GET /health/detailed
   * Detailed health check with system metrics
   */
  async detailed(req: Request, res: Response): Promise<void> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Get cache stats
    const cacheStats = cacheService.getStats();

    // Get queue stats
    let queueStats = null;
    try {
      queueStats = await jobQueueService.getQueueStats();
    } catch {
      // Queue not available
    }

    // Get gateway health
    let gatewayHealth = null;
    try {
      gatewayHealth = await apiGateway.healthCheck();
    } catch {
      // Gateway not available
    }

    ApiResponse.success(res, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      system: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        loadAverage: os.loadavg(),
      },
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        memory: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
          rss: memoryUsage.rss,
        },
        cpu: cpuUsage,
      },
      cache: cacheStats,
      queue: queueStats,
      gateway: gatewayHealth,
    }, 'Detailed health check');
  },

  /**
   * GET /health/metrics
   * Prometheus-style metrics (for monitoring)
   */
  async metrics(req: Request, res: Response): Promise<void> {
    const memoryUsage = process.memoryUsage();
    const cacheStats = cacheService.getStats();
    
    let queueStats: any = { jobPosting: { waiting: 0, active: 0 }, bulkPosting: { waiting: 0, active: 0 } };
    try {
      queueStats = await jobQueueService.getQueueStats();
    } catch {
      // Queue not available
    }

    // Prometheus format
    const metrics = `
# HELP carechain_uptime_seconds Server uptime in seconds
# TYPE carechain_uptime_seconds gauge
carechain_uptime_seconds ${process.uptime()}

# HELP carechain_heap_used_bytes Heap memory used
# TYPE carechain_heap_used_bytes gauge
carechain_heap_used_bytes ${memoryUsage.heapUsed}

# HELP carechain_heap_total_bytes Total heap memory
# TYPE carechain_heap_total_bytes gauge
carechain_heap_total_bytes ${memoryUsage.heapTotal}

# HELP carechain_cache_hits_total Cache hits
# TYPE carechain_cache_hits_total counter
carechain_cache_hits_total ${cacheStats.hits}

# HELP carechain_cache_misses_total Cache misses
# TYPE carechain_cache_misses_total counter
carechain_cache_misses_total ${cacheStats.misses}

# HELP carechain_cache_hit_rate Cache hit rate
# TYPE carechain_cache_hit_rate gauge
carechain_cache_hit_rate ${cacheStats.hitRate}

# HELP carechain_queue_waiting_jobs Jobs waiting in queue
# TYPE carechain_queue_waiting_jobs gauge
carechain_queue_waiting_jobs{queue="job_posting"} ${queueStats.jobPosting.waiting}
carechain_queue_waiting_jobs{queue="bulk_posting"} ${queueStats.bulkPosting.waiting}

# HELP carechain_queue_active_jobs Jobs currently being processed
# TYPE carechain_queue_active_jobs gauge
carechain_queue_active_jobs{queue="job_posting"} ${queueStats.jobPosting.active}
carechain_queue_active_jobs{queue="bulk_posting"} ${queueStats.bulkPosting.active}
`.trim();

    res.setHeader('Content-Type', 'text/plain');
    res.send(metrics);
  },
};

export default healthController;
