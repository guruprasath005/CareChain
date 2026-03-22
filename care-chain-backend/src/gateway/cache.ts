// src/gateway/cache.ts
// Redis-based Caching Layer for API responses

import Redis from 'ioredis';
import { createRedisConnection, tryConnectRedis } from '../config/redisConnection';
import { logger } from '../utils/logger';

export interface CacheOptions {
  ttl?: number;           // Time to live in seconds
  prefix?: string;        // Key prefix
  compress?: boolean;     // Compress large values
}

/**
 * Gateway Cache using Redis
 * High-performance caching for API responses
 */
export class GatewayCache {
  private redis: Redis | null = null;
  private isConnected: boolean = false;
  private memoryCache: Map<string, { value: any; expiry: number }> = new Map();
  private maxMemoryCacheSize: number = 1000;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Don't auto-connect in constructor, use lazy initialization
    this.startMemoryCleanup();
  }

  private async ensureInitialized(): Promise<void> {
    if (this.isConnected) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.initializeRedis();
    return this.initPromise;
  }

  private async initializeRedis(): Promise<void> {
    try {
      // Create connection with error handlers attached first
      this.redis = createRedisConnection('GatewayCache');

      // Try to connect with timeout
      this.isConnected = await tryConnectRedis(this.redis, 3000);

      if (this.isConnected) {
        logger.info('Gateway cache Redis connected');
      } else {
        logger.debug('Gateway cache using memory-only mode');
        this.redis = null;
      }
    } catch (error) {
      logger.debug('Gateway cache falling back to memory store');
      this.isConnected = false;
      this.redis = null;
    }
  }

  private startMemoryCleanup(): void {
    // Clean up expired memory cache entries every minute
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.memoryCache) {
        if (entry.expiry < now) {
          this.memoryCache.delete(key);
        }
      }
    }, 60000);
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    // Lazy initialize Redis connection
    await this.ensureInitialized();

    if (this.isConnected && this.redis) {
      try {
        const value = await this.redis.get(key);
        if (value) {
          return JSON.parse(value) as T;
        }
      } catch (error) {
        logger.warn('Cache get error:', error);
      }
    }

    // Memory fallback
    const entry = this.memoryCache.get(key);
    if (entry && entry.expiry > Date.now()) {
      return entry.value as T;
    }

    this.memoryCache.delete(key);
    return null;
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, ttlSeconds: number = 60): Promise<void> {
    // Lazy initialize Redis connection
    await this.ensureInitialized();

    const serialized = JSON.stringify(value);

    if (this.isConnected && this.redis) {
      try {
        await this.redis.setex(key, ttlSeconds, serialized);
      } catch (error) {
        logger.warn('Cache set error:', error);
      }
    }

    // Always set in memory as backup
    this.setMemoryCache(key, value, ttlSeconds);
  }

  /**
   * Delete from cache
   */
  async delete(key: string): Promise<void> {
    if (this.isConnected && this.redis) {
      try {
        await this.redis.del(key);
      } catch (error) {
        logger.warn('Cache delete error:', error);
      }
    }

    this.memoryCache.delete(key);
  }

  /**
   * Delete by pattern
   * Uses SCAN instead of KEYS to avoid blocking Redis during iteration
   */
  async deleteByPattern(pattern: string): Promise<number> {
    let deleted = 0;

    if (this.isConnected && this.redis) {
      try {
        let cursor = '0';
        do {
          const [nextCursor, keys] = await this.redis.scan(
            cursor,
            'MATCH',
            pattern,
            'COUNT',
            100
          );
          cursor = nextCursor;

          if (keys.length > 0) {
            await this.redis.del(...keys);
            deleted += keys.length;
          }
        } while (cursor !== '0');
      } catch (error) {
        logger.warn('Cache deleteByPattern error:', error);
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
   * Get or set with callback
   */
  async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttlSeconds: number = 60
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
   * Multi-get for batch operations
   */
  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();

    if (this.isConnected && this.redis) {
      try {
        const values = await this.redis.mget(...keys);
        keys.forEach((key, index) => {
          const value = values[index];
          results.set(key, value ? JSON.parse(value) : null);
        });
        return results;
      } catch (error) {
        logger.warn('Cache mget error:', error);
      }
    }

    // Memory fallback
    for (const key of keys) {
      const entry = this.memoryCache.get(key);
      if (entry && entry.expiry > Date.now()) {
        results.set(key, entry.value);
      } else {
        results.set(key, null);
      }
    }

    return results;
  }

  /**
   * Multi-set for batch operations
   */
  async mset(entries: Map<string, any>, ttlSeconds: number = 60): Promise<void> {
    if (this.isConnected && this.redis) {
      try {
        const pipeline = this.redis.pipeline();
        for (const [key, value] of entries) {
          pipeline.setex(key, ttlSeconds, JSON.stringify(value));
        }
        await pipeline.exec();
      } catch (error) {
        logger.warn('Cache mset error:', error);
      }
    }

    // Memory fallback
    for (const [key, value] of entries) {
      this.setMemoryCache(key, value, ttlSeconds);
    }
  }

  /**
   * Increment counter
   */
  async incr(key: string, ttlSeconds?: number): Promise<number> {
    if (this.isConnected && this.redis) {
      try {
        const value = await this.redis.incr(key);
        if (ttlSeconds) {
          await this.redis.expire(key, ttlSeconds);
        }
        return value;
      } catch (error) {
        logger.warn('Cache incr error:', error);
      }
    }

    // Memory fallback
    const entry = this.memoryCache.get(key);
    const currentValue = (entry?.value as number) || 0;
    const newValue = currentValue + 1;
    this.setMemoryCache(key, newValue, ttlSeconds || 3600);
    return newValue;
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (this.isConnected && this.redis) {
      try {
        return (await this.redis.exists(key)) === 1;
      } catch (error) {
        logger.warn('Cache exists error:', error);
      }
    }

    const entry = this.memoryCache.get(key);
    return entry !== undefined && entry.expiry > Date.now();
  }

  async isHealthy(): Promise<boolean> {
    if (!this.isConnected || !this.redis) return true; // Memory fallback is OK

    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
    this.memoryCache.clear();
  }

  private setMemoryCache(key: string, value: any, ttlSeconds: number): void {
    // Evict oldest entries if cache is full
    if (this.memoryCache.size >= this.maxMemoryCacheSize) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }

    this.memoryCache.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }
}

export default GatewayCache;
