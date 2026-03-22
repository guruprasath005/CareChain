// src/middleware/rateLimit.ts
// Rate Limiting Middleware
// Prevents abuse and brute force attacks

import rateLimit, { Store, IncrementResponse } from 'express-rate-limit';
import { Request, Response } from 'express';
import { config } from '../config';
import { ApiResponse } from '../utils/response';
import { createRedisConnection, tryConnectRedis } from '../config/redisConnection';
import { logger } from '../utils/logger';
import type Redis from 'ioredis';

/**
 * Minimal Redis store for express-rate-limit.
 * Each instance uses a unique prefix so separate limiters never share counters.
 * Falls back silently to in-memory if Redis is unavailable.
 */
class RedisRateLimitStore implements Store {
  private redis: Redis | null = null;
  private memoryStore: Map<string, { count: number; resetTime: Date }> = new Map();
  private windowMs: number = 15 * 60 * 1000;
  readonly prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
    this.connect();
  }

  private async connect(): Promise<void> {
    try {
      const conn = createRedisConnection('RateLimiter');
      const connected = await tryConnectRedis(conn, 3000);
      if (connected) {
        this.redis = conn;
        logger.info('Rate limiter using Redis store');
      } else {
        logger.debug('Rate limiter using memory store (Redis unavailable)');
      }
    } catch {
      logger.debug('Rate limiter using memory store (Redis unavailable)');
    }
  }

  // Called by express-rate-limit to pass the limiter's windowMs
  init(options: { windowMs: number }): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const windowMs = this.windowMs;

    if (this.redis && this.redis.status === 'ready') {
      try {
        const redisKey = `rl:${this.prefix}:${key}`;
        const count = await this.redis.incr(redisKey);
        if (count === 1) {
          await this.redis.pexpire(redisKey, windowMs);
        }
        const ttl = await this.redis.pttl(redisKey);
        return {
          totalHits: count,
          resetTime: new Date(Date.now() + (ttl > 0 ? ttl : windowMs)),
        };
      } catch {
        // fall through to memory
      }
    }

    // Memory fallback
    const now = Date.now();
    const entry = this.memoryStore.get(key);
    if (!entry || entry.resetTime.getTime() <= now) {
      const resetTime = new Date(now + windowMs);
      this.memoryStore.set(key, { count: 1, resetTime });
      return { totalHits: 1, resetTime };
    }
    entry.count += 1;
    return { totalHits: entry.count, resetTime: entry.resetTime };
  }

  async decrement(key: string): Promise<void> {
    if (this.redis && this.redis.status === 'ready') {
      try {
        await this.redis.decr(`rl:${this.prefix}:${key}`);
        return;
      } catch { /* fall through */ }
    }
    const entry = this.memoryStore.get(key);
    if (entry) entry.count = Math.max(0, entry.count - 1);
  }

  async resetKey(key: string): Promise<void> {
    if (this.redis && this.redis.status === 'ready') {
      try {
        await this.redis.del(`rl:${this.prefix}:${key}`);
        return;
      } catch { /* fall through */ }
    }
    this.memoryStore.delete(key);
  }
}

// Each limiter gets a unique prefix so their Redis counters are independent
const makeStore = (prefix: string) => new RedisRateLimitStore(prefix);

/**
 * General API Rate Limiter
 * Applies to all routes
 */
export const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('general'),
  // Skip rate limiting in development or for authenticated users
  skip: (req: Request) => config.app.env === 'development' || !!(req as any).user,
  handler: (req: Request, res: Response) => {
    ApiResponse.tooManyRequests(res, 'Too many requests, please try again later');
  },
});

/**
 * Auth Rate Limiter - Stricter limits for auth endpoints
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  store: makeStore('auth'),
  handler: (req: Request, res: Response) => {
    ApiResponse.tooManyRequests(res, 'Too many authentication attempts, please try again later');
  },
});

/**
 * OTP Rate Limiter
 */
export const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('otp'),
  handler: (req: Request, res: Response) => {
    ApiResponse.tooManyRequests(res, 'Too many OTP requests, please wait before requesting again');
  },
});

/**
 * Password Reset Rate Limiter
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('password-reset'),
  handler: (req: Request, res: Response) => {
    ApiResponse.tooManyRequests(res, 'Too many password reset attempts, please try again later');
  },
});

/**
 * Upload Rate Limiter
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('upload'),
  handler: (req: Request, res: Response) => {
    ApiResponse.tooManyRequests(res, 'Too many file uploads, please try again later');
  },
});

export default {
  general: generalLimiter,
  auth: authLimiter,
  otp: otpLimiter,
  passwordReset: passwordResetLimiter,
  upload: uploadLimiter,
};
