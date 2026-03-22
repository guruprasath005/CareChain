// src/gateway/rateLimiter.ts
// Redis-based Rate Limiter for high-scale API access

import Redis from 'ioredis';
import { createRedisConnection, tryConnectRedis } from '../config/redisConnection';
import { logger } from '../utils/logger';

export interface RateLimitConfig {
  windowMs: number;     // Time window in milliseconds
  maxRequests: number;  // Max requests per window
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
}

/**
 * Redis Rate Limiter using Sliding Window algorithm
 * Supports distributed rate limiting across multiple server instances
 */
export class RedisRateLimiter {
  private redis: Redis | null = null;
  private isConnected: boolean = false;
  private memoryFallback: Map<string, { count: number; resetTime: number }> = new Map();
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Don't auto-connect, use lazy initialization
  }

  private async ensureInitialized(): Promise<void> {
    if (this.isConnected || this.initPromise) return this.initPromise || Promise.resolve();

    this.initPromise = this.initializeRedis();
    return this.initPromise;
  }

  private async initializeRedis(): Promise<void> {
    try {
      // Create connection with error handlers attached first
      this.redis = createRedisConnection('RateLimiter');

      // Try to connect with timeout
      this.isConnected = await tryConnectRedis(this.redis, 3000);

      if (this.isConnected) {
        logger.info('Rate limiter Redis connected');
      } else {
        logger.debug('Rate limiter using memory-only mode');
        this.redis = null;
      }
    } catch (error) {
      logger.debug('Rate limiter falling back to memory store');
      this.isConnected = false;
      this.redis = null;
    }
  }

  /**
   * Check rate limit using sliding window counter algorithm
   * This is more accurate than fixed window and handles edge cases better
   */
  async checkLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    // Lazy initialize Redis connection
    await this.ensureInitialized();

    const now = Date.now();
    const windowStart = now - config.windowMs;
    const redisKey = `ratelimit:${key}`;

    if (!this.isConnected || !this.redis) {
      return this.checkLimitMemory(key, config);
    }

    try {
      // Lua script for atomic sliding window rate limiting
      const luaScript = `
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local window = tonumber(ARGV[2])
        local limit = tonumber(ARGV[3])
        local windowStart = now - window

        -- Remove old entries outside the window
        redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

        -- Count current requests in window
        local count = redis.call('ZCARD', key)

        if count < limit then
          -- Add new request with current timestamp
          redis.call('ZADD', key, now, now .. ':' .. math.random())
          redis.call('PEXPIRE', key, window)
          return {1, limit, limit - count - 1, now + window}
        else
          -- Get the oldest timestamp to calculate reset time
          local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
          local resetTime = now + window
          if oldest[2] then
            resetTime = tonumber(oldest[2]) + window
          end
          return {0, limit, 0, resetTime}
        end
      `;

      const result = await this.redis.eval(
        luaScript,
        1,
        redisKey,
        now.toString(),
        config.windowMs.toString(),
        config.maxRequests.toString()
      ) as number[];

      return {
        allowed: result[0] === 1,
        limit: result[1],
        remaining: Math.max(0, result[2]),
        resetTime: result[3],
      };
    } catch (error) {
      logger.warn('Redis rate limit error, using memory fallback:', error);
      return this.checkLimitMemory(key, config);
    }
  }

  /**
   * Memory-based fallback for when Redis is unavailable
   */
  private checkLimitMemory(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const fullKey = `ratelimit:${key}`;
    
    let entry = this.memoryFallback.get(fullKey);

    if (!entry || now > entry.resetTime) {
      // New window
      entry = {
        count: 1,
        resetTime: now + config.windowMs,
      };
      this.memoryFallback.set(fullKey, entry);

      return {
        allowed: true,
        limit: config.maxRequests,
        remaining: config.maxRequests - 1,
        resetTime: entry.resetTime,
      };
    }

    if (entry.count < config.maxRequests) {
      entry.count++;
      return {
        allowed: true,
        limit: config.maxRequests,
        remaining: config.maxRequests - entry.count,
        resetTime: entry.resetTime,
      };
    }

    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Bulk rate limit check for high-volume scenarios
   */
  async checkBulkLimits(
    keys: string[],
    config: RateLimitConfig
  ): Promise<Map<string, RateLimitResult>> {
    const results = new Map<string, RateLimitResult>();

    if (!this.isConnected || !this.redis) {
      for (const key of keys) {
        results.set(key, await this.checkLimitMemory(key, config));
      }
      return results;
    }

    // Use pipeline for batch operations
    const pipeline = this.redis.pipeline();
    const now = Date.now();

    for (const key of keys) {
      const redisKey = `ratelimit:${key}`;
      pipeline.zremrangebyscore(redisKey, '-inf', now - config.windowMs);
      pipeline.zcard(redisKey);
    }

    try {
      const pipelineResults = await pipeline.exec();
      
      for (let i = 0; i < keys.length; i++) {
        const count = (pipelineResults?.[i * 2 + 1]?.[1] as number) || 0;
        
        results.set(keys[i], {
          allowed: count < config.maxRequests,
          limit: config.maxRequests,
          remaining: Math.max(0, config.maxRequests - count),
          resetTime: now + config.windowMs,
        });
      }
    } catch (error) {
      logger.warn('Bulk rate limit check failed:', error);
      for (const key of keys) {
        results.set(key, await this.checkLimitMemory(key, config));
      }
    }

    return results;
  }

  /**
   * Reset rate limit for a specific key
   */
  async resetLimit(key: string): Promise<void> {
    const redisKey = `ratelimit:${key}`;
    
    if (this.isConnected && this.redis) {
      await this.redis.del(redisKey);
    }
    
    this.memoryFallback.delete(redisKey);
  }

  /**
   * Get current usage for a key
   */
  async getUsage(key: string): Promise<number> {
    const redisKey = `ratelimit:${key}`;
    
    if (this.isConnected && this.redis) {
      const count = await this.redis.zcard(redisKey);
      return count;
    }

    const entry = this.memoryFallback.get(redisKey);
    return entry?.count || 0;
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
    this.memoryFallback.clear();
  }
}

export default RedisRateLimiter;
