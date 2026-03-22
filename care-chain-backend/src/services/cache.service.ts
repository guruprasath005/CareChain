// src/services/cache.service.ts
// Caching Service for high-performance data access

import Redis from 'ioredis';
import { createRedisConnection, tryConnectRedis } from '../config/redisConnection';
import { logger } from '../utils/logger';

export interface CacheConfig {
  defaultTTL: number;      // Default TTL in seconds
  maxMemoryItems: number;  // Max items in memory cache
  enableCompression: boolean;
}

const DEFAULT_CONFIG: CacheConfig = {
  defaultTTL: 300,         // 5 minutes
  maxMemoryItems: 5000,
  enableCompression: false,
};

// Cache key prefixes for organization
export const CACHE_KEYS = {
  // Job-related caches
  JOB: (id: string) => `cache:job:${id}`,
  JOB_LIST: (filters: string) => `cache:jobs:list:${filters}`,
  JOB_FILTERS: () => `cache:jobs:filters`,
  JOB_FEATURED: (limit: number) => `cache:jobs:featured:${limit}`,
  JOB_RECENT: (limit: number) => `cache:jobs:recent:${limit}`,
  JOB_SIMILAR: (id: string) => `cache:jobs:similar:${id}`,
  JOB_STATS: (id: string) => `cache:job:stats:${id}`,

  // Hospital-related caches
  HOSPITAL: (id: string) => `cache:hospital:${id}`,
  HOSPITAL_JOBS: (id: string, page: number) => `cache:hospital:${id}:jobs:${page}`,
  HOSPITAL_STATS: (id: string) => `cache:hospital:${id}:stats`,

  // Auth user cache (skip DB on every authenticated request)
  AUTH_USER: (id: string) => `auth:user:${id}`,

  // Doctor-related caches
  DOCTOR: (id: string) => `cache:doctor:${id}`,
  DOCTOR_APPLICATIONS: (id: string) => `cache:doctor:${id}:applications`,
  DOCTOR_RECOMMENDATIONS: (id: string) => `cache:doctor:${id}:recommendations`,

  // Search caches
  SEARCH: (query: string) => `cache:search:${Buffer.from(query).toString('base64').slice(0, 50)}`,
  
  // Aggregate caches
  SPECIALIZATIONS: () => `cache:aggregate:specializations`,
  CITIES: () => `cache:aggregate:cities`,
  JOB_TYPES: () => `cache:aggregate:jobTypes`,
};

// TTL values by cache type (in seconds)
export const CACHE_TTL = {
  JOB: 300,              // 5 minutes
  JOB_LIST: 60,          // 1 minute
  JOB_FILTERS: 3600,     // 1 hour
  JOB_FEATURED: 300,     // 5 minutes
  JOB_RECENT: 60,        // 1 minute
  JOB_STATS: 60,         // 1 minute
  HOSPITAL: 600,         // 10 minutes
  HOSPITAL_STATS: 300,   // 5 minutes
  DOCTOR: 600,           // 10 minutes
  SEARCH: 300,           // 5 minutes
  AGGREGATES: 3600,      // 1 hour
  AUTH_USER: 300,        // 5 minutes - short TTL so deactivation propagates quickly
};

/**
 * Cache Service
 * High-performance caching layer with Redis and memory fallback
 */
class CacheService {
  private redis: Redis | null = null;
  private isConnected: boolean = false;
  private memoryCache: Map<string, { value: any; expiry: number }> = new Map();
  private config: CacheConfig;
  private hitCount: number = 0;
  private missCount: number = 0;

  constructor(cacheConfig: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...cacheConfig };
    this.initialize();
    this.startCleanupInterval();
  }

  private async initialize(): Promise<void> {
    try {
      // Use shared connection utility with proper error handling
      this.redis = createRedisConnection('CacheService');
      
      this.redis.on('connect', () => {
        this.isConnected = true;
        logger.info('Cache Service Redis connected');
      });

      // Try to connect with timeout
      const connected = await tryConnectRedis(this.redis, 3000);
      
      if (!connected) {
        logger.debug('Cache Service using memory-only mode');
        if (this.redis) {
          try { this.redis.disconnect(); } catch {}
          this.redis = null;
        }
        this.isConnected = false;
      }
    } catch (error) {
      logger.debug('Cache Service using memory-only mode');
      this.isConnected = false;
    }
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.memoryCache) {
        if (entry.expiry < now) {
          this.memoryCache.delete(key);
        }
      }

      // Enforce max items limit
      if (this.memoryCache.size > this.config.maxMemoryItems) {
        const excess = this.memoryCache.size - this.config.maxMemoryItems;
        const keys = Array.from(this.memoryCache.keys()).slice(0, excess);
        keys.forEach((key) => this.memoryCache.delete(key));
      }
    }, 60000);
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    // Try Redis first
    if (this.isConnected && this.redis) {
      try {
        const value = await this.redis.get(key);
        if (value) {
          this.hitCount++;
          const parsed = JSON.parse(value);
          // Also cache in memory for faster subsequent access
          this.setMemory(key, parsed, 60);
          return parsed as T;
        }
      } catch (error) {
        logger.debug('Redis get error, falling back to memory');
      }
    }

    // Try memory cache
    const entry = this.memoryCache.get(key);
    if (entry && entry.expiry > Date.now()) {
      this.hitCount++;
      return entry.value as T;
    }

    this.missCount++;
    this.memoryCache.delete(key);
    return null;
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds || this.config.defaultTTL;
    const serialized = JSON.stringify(value);

    // Set in Redis
    if (this.isConnected && this.redis) {
      try {
        await this.redis.setex(key, ttl, serialized);
      } catch (error) {
        logger.debug('Redis set error');
      }
    }

    // Always set in memory as L1 cache
    this.setMemory(key, value, ttl);
  }

  /**
   * Get or set with callback (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetchFunction();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Delete a key
   */
  async delete(key: string): Promise<void> {
    if (this.isConnected && this.redis) {
      try {
        await this.redis.del(key);
      } catch (error) {
        logger.debug('Redis delete error');
      }
    }
    this.memoryCache.delete(key);
  }

  /**
   * Delete by pattern
   */
  async deleteByPattern(pattern: string): Promise<number> {
    let deleted = 0;

    if (this.isConnected && this.redis) {
      try {
        let cursor = '0';
        do {
          const [newCursor, keys] = await this.redis.scan(
            cursor,
            'MATCH',
            pattern,
            'COUNT',
            100
          );
          cursor = newCursor;

          if (keys.length > 0) {
            await this.redis.del(...keys);
            deleted += keys.length;
          }
        } while (cursor !== '0');
      } catch (error) {
        logger.debug('Redis pattern delete error');
      }
    }

    // Memory cleanup
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Invalidate job-related caches
   */
  async invalidateJobCaches(jobId?: string): Promise<void> {
    const patterns = [
      'cache:jobs:list:*',
      'cache:jobs:featured:*',
      'cache:jobs:recent:*',
    ];

    if (jobId) {
      patterns.push(`cache:job:${jobId}*`);
      patterns.push(`cache:jobs:similar:${jobId}*`);
    }

    for (const pattern of patterns) {
      await this.deleteByPattern(pattern);
    }

    logger.debug('Job caches invalidated', { jobId });
  }

  /**
   * Invalidate hospital-related caches
   */
  async invalidateHospitalCaches(hospitalId: string): Promise<void> {
    await this.deleteByPattern(`cache:hospital:${hospitalId}*`);
    logger.debug('Hospital caches invalidated', { hospitalId });
  }

  /**
   * Invalidate doctor-related caches
   */
  async invalidateDoctorCaches(doctorId: string): Promise<void> {
    await this.deleteByPattern(`cache:doctor:${doctorId}*`);
    logger.debug('Doctor caches invalidated', { doctorId });
  }

  /**
   * Multi-get for batch operations
   */
  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();

    if (this.isConnected && this.redis) {
      try {
        const values = await this.redis.mget(...keys);
        keys.forEach((key, index) => {
          const value = values[index];
          if (value) {
            this.hitCount++;
            results.set(key, JSON.parse(value));
          } else {
            this.missCount++;
            results.set(key, null);
          }
        });
        return results;
      } catch (error) {
        logger.debug('Redis mget error');
      }
    }

    // Memory fallback
    for (const key of keys) {
      const entry = this.memoryCache.get(key);
      if (entry && entry.expiry > Date.now()) {
        this.hitCount++;
        results.set(key, entry.value);
      } else {
        this.missCount++;
        results.set(key, null);
      }
    }

    return results;
  }

  /**
   * Multi-set for batch operations
   */
  async mset(entries: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    if (this.isConnected && this.redis) {
      try {
        const pipeline = this.redis.pipeline();
        for (const { key, value, ttl } of entries) {
          pipeline.setex(key, ttl || this.config.defaultTTL, JSON.stringify(value));
        }
        await pipeline.exec();
      } catch (error) {
        logger.debug('Redis mset error');
      }
    }

    // Memory
    for (const { key, value, ttl } of entries) {
      this.setMemory(key, value, ttl || this.config.defaultTTL);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    hitRate: number;
    hits: number;
    misses: number;
    memorySize: number;
    isConnected: boolean;
  } {
    const total = this.hitCount + this.missCount;
    return {
      hitRate: total > 0 ? this.hitCount / total : 0,
      hits: this.hitCount,
      misses: this.missCount,
      memorySize: this.memoryCache.size,
      isConnected: this.isConnected,
    };
  }

  /**
   * Clear all caches
   */
  async flush(): Promise<void> {
    if (this.isConnected && this.redis) {
      try {
        await this.redis.flushdb();
      } catch (error) {
        logger.warn('Redis flush error');
      }
    }
    this.memoryCache.clear();
    logger.info('Cache flushed');
  }

  /**
   * Health check
   */
  async isHealthy(): Promise<boolean> {
    if (!this.isConnected || !this.redis) return true; // Memory OK

    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Graceful shutdown
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
    this.memoryCache.clear();
  }

  private setMemory(key: string, value: any, ttlSeconds: number): void {
    // Enforce size limit
    if (this.memoryCache.size >= this.config.maxMemoryItems) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) this.memoryCache.delete(firstKey);
    }

    this.memoryCache.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }
}

// Export singleton instance
export const cacheService = new CacheService();

export default cacheService;
