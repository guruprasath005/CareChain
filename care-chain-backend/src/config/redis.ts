// src/config/redis.ts
// Redis configuration for OTPs, sessions, and caching

import Redis from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';

const normalizeRedisHost = (host: string): string => {
  const trimmed = (host || '').trim();
  return trimmed === 'localhost' ? '127.0.0.1' : trimmed;
};

const baseRedisOptions = {
  password: config.redis.password || undefined,
  db: config.redis.db,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  enableOfflineQueue: false,
  connectTimeout: 5000,
  retryStrategy: (times: number) => {
    if (times > 3) {
      return null; // Stop retrying after 3 attempts
    }
    return Math.min(times * 100, 2000);
  },
} as const;

const redisClient = config.redis.url
  ? new Redis(config.redis.url, { ...baseRedisOptions })
  : new Redis({
    host: normalizeRedisHost(config.redis.host),
    port: config.redis.port,
    ...baseRedisOptions,
  });

export const redis = redisClient;

// Connection event handlers
redis.on('connect', () => {
  logger.info('Redis client connected');
});

redis.on('error', (err: any) => {
  // Suppress connection errors as we have memory fallback
  // This is expected behavior when running without a Redis server
  const message = typeof err?.message === 'string' ? err.message : '';
  if (
    err?.name === 'AggregateError' ||
    message.includes('ECONNREFUSED') ||
    message.includes('ENOTFOUND') ||
    message.includes('ETIMEDOUT') ||
    message.toLowerCase().includes('connect')
  ) {
    return;
  }
  logger.error('Redis client error:', err);
});

redis.on('ready', () => {
  logger.info('Redis client ready');
});

// Initialize Redis connection (optional)
export async function initializeRedis(): Promise<boolean> {
  try {
    // Set a timeout for connection attempt
    const connectPromise = redis.connect();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), 5000)
    );

    await Promise.race([connectPromise, timeoutPromise]);
    await redis.ping();
    logger.info('Redis connection verified');
    return true;
  } catch (error) {
    logger.warn('Redis not available, continuing without it');
    // Disconnect to stop retry attempts
    await redis.disconnect();
    return false;
  }
}

// Graceful shutdown
export async function closeRedisConnection(): Promise<void> {
  try {
    if (redis.status === 'ready' || redis.status === 'connect') {
      await redis.quit();
      logger.info('Redis connection closed');
    }
  } catch (error) {
    logger.debug('Redis disconnect skipped (not connected)');
  }
}

// Redis key prefixes for different purposes
export const REDIS_KEYS = {
  OTP: (email: string, type: string) => `otp:${type}:${email}`,
  OTP_ATTEMPTS: (email: string, type: string) => `otp_attempts:${type}:${email}`,
  OTP_COOLDOWN: (email: string, type: string) => `otp_cooldown:${type}:${email}`,
  SESSION: (userId: string, tokenId: string) => `session:${userId}:${tokenId}`,
  USER_SESSIONS: (userId: string) => `user_sessions:${userId}`,
  REFRESH_TOKEN: (tokenId: string) => `refresh_token:${tokenId}`,
  RATE_LIMIT: (ip: string, endpoint: string) => `rate_limit:${endpoint}:${ip}`,
  CACHE: (key: string) => `cache:${key}`,
} as const;

export default redis;
