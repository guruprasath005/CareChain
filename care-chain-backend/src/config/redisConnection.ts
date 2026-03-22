// src/config/redisConnection.ts
// Shared Redis Connection Manager - Prevents multiple connection issues

import Redis, { RedisOptions } from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';

// Singleton Redis connection for general use
let sharedConnection: Redis | null = null;
let isConnecting: boolean = false;
let connectionPromise: Promise<Redis | null> | null = null;

// Connection options for standard Redis client
const normalizeRedisHost = (host: string): string => {
  const trimmed = (host || '').trim();
  return trimmed === 'localhost' ? '127.0.0.1' : trimmed;
};

const getRedisOptions = (options: Partial<RedisOptions> = {}): RedisOptions => ({
  host: normalizeRedisHost(config.redis.host),
  port: config.redis.port,
  password: config.redis.password || undefined,
  db: config.redis.db,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    if (times > 3) {
      logger.debug(`Redis connection failed after ${times} attempts, giving up`);
      return null;
    }
    return Math.min(times * 200, 3000);
  },
  lazyConnect: true,
  enableOfflineQueue: false,
  connectTimeout: 5000,
  keepAlive: 30000,
  ...options,
});

// Connection options for BullMQ (special requirements)
const getBullMQRedisOptions = (): RedisOptions => ({
  host: normalizeRedisHost(config.redis.host),
  port: config.redis.port,
  password: config.redis.password || undefined,
  db: config.redis.db,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy: (times: number) => {
    if (times > 3) return null;
    return Math.min(times * 200, 3000);
  },
});

/**
 * Create a Redis connection with proper error handling
 * Error handlers are attached BEFORE connection attempt
 */
export function createRedisConnection(
  name: string = 'Redis',
  options: Partial<RedisOptions> = {}
): Redis {
  const redis = config.redis.url
    ? new Redis(config.redis.url, {
      ...getRedisOptions(options),
      lazyConnect: true,
    })
    : new Redis({
      ...getRedisOptions(options),
      lazyConnect: true, // Always lazy connect
    });

  // Attach error handler BEFORE any connection attempt
  redis.on('error', (err: any) => {
    // Suppress common connection errors
    const message = typeof err?.message === 'string' ? err.message : '';
    if (
      err?.name === 'AggregateError' ||
      message.includes('ECONNREFUSED') ||
      message.includes('ENOTFOUND') ||
      message.includes('ETIMEDOUT') ||
      message.includes('Connection is closed') ||
      err?.code === 'ECONNRESET'
    ) {
      // Log only once at debug level
      logger.debug(`${name}: Connection unavailable`);
      return;
    }
    logger.warn(`${name} error:`, message || String(err));
  });

  redis.on('connect', () => {
    logger.debug(`${name}: Connected`);
  });

  redis.on('ready', () => {
    logger.debug(`${name}: Ready`);
  });

  redis.on('close', () => {
    logger.debug(`${name}: Connection closed`);
  });

  redis.on('reconnecting', () => {
    logger.debug(`${name}: Reconnecting...`);
  });

  return redis;
}

/**
 * Create a BullMQ-compatible Redis connection
 */
export function createBullMQConnection(name: string = 'BullMQ'): Redis {
  const redis = config.redis.url
    ? new Redis(config.redis.url, {
      ...getBullMQRedisOptions(),
      lazyConnect: true,
    })
    : new Redis({
      ...getBullMQRedisOptions(),
      lazyConnect: true,
    });

  // Attach error handler BEFORE any connection attempt
  redis.on('error', (err: any) => {
    const message = typeof err?.message === 'string' ? err.message : '';
    if (
      err?.name === 'AggregateError' ||
      message.includes('ECONNREFUSED') ||
      message.includes('ENOTFOUND') ||
      message.includes('ETIMEDOUT') ||
      err?.code === 'ECONNRESET'
    ) {
      return; // Suppress
    }
    logger.warn(`${name} error:`, message || String(err));
  });

  return redis;
}

/**
 * Get shared Redis connection (singleton pattern)
 * Returns null if Redis is not available
 */
export async function getSharedRedisConnection(): Promise<Redis | null> {
  if (sharedConnection && sharedConnection.status === 'ready') {
    return sharedConnection;
  }

  // If already connecting, wait for that promise
  if (isConnecting && connectionPromise) {
    return connectionPromise;
  }

  isConnecting = true;
  connectionPromise = (async () => {
    try {
      sharedConnection = createRedisConnection('SharedRedis');
      
      // Try to connect with timeout
      const connectPromise = sharedConnection.connect();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      );

      await Promise.race([connectPromise, timeoutPromise]);
      await sharedConnection.ping();
      
      logger.info('Shared Redis connection established');
      return sharedConnection;
    } catch (error) {
      logger.debug('Shared Redis not available, services will use memory fallback');
      if (sharedConnection) {
        sharedConnection.disconnect();
        sharedConnection = null;
      }
      return null;
    } finally {
      isConnecting = false;
    }
  })();

  return connectionPromise;
}

/**
 * Try to connect Redis with timeout and fallback
 * Returns true if connected, false otherwise
 */
export async function tryConnectRedis(
  redis: Redis,
  timeoutMs: number = 5000
): Promise<boolean> {
  try {
    const connectPromise = redis.connect();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), timeoutMs)
    );

    await Promise.race([connectPromise, timeoutPromise]);
    await redis.ping();
    return true;
  } catch {
    // Disconnect to stop retry attempts
    try {
      redis.disconnect();
    } catch {
      // Ignore disconnect errors
    }
    return false;
  }
}

/**
 * Check if Redis is available (quick check)
 */
export async function isRedisAvailable(): Promise<boolean> {
  if (sharedConnection && sharedConnection.status === 'ready') {
    try {
      await sharedConnection.ping();
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Close shared connection
 */
export async function closeSharedConnection(): Promise<void> {
  if (sharedConnection) {
    try {
      await sharedConnection.quit();
    } catch {
      // Ignore close errors
    }
    sharedConnection = null;
  }
}

export default {
  createRedisConnection,
  createBullMQConnection,
  getSharedRedisConnection,
  tryConnectRedis,
  isRedisAvailable,
  closeSharedConnection,
};
