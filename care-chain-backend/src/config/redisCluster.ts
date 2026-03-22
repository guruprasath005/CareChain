// src/config/redisCluster.ts
// Enhanced Redis configuration with connection pooling and cluster support

import Redis, { Cluster, RedisOptions, ClusterOptions } from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';

export interface RedisPoolConfig {
  poolSize: number;
  minPoolSize: number;
  acquireTimeout: number;
  idleTimeout: number;
}

const DEFAULT_POOL_CONFIG: RedisPoolConfig = {
  poolSize: 10,
  minPoolSize: 2,
  acquireTimeout: 5000,
  idleTimeout: 30000,
};

/**
 * Redis Connection Pool Manager
 * Provides high-performance Redis access with connection pooling
 */
export class RedisPool {
  private pool: Redis[] = [];
  private inUse: Set<Redis> = new Set();
  private waitingQueue: Array<{
    resolve: (conn: Redis) => void;
    reject: (err: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];
  private config: RedisPoolConfig;
  private baseOptions: RedisOptions;
  private isShuttingDown: boolean = false;

  constructor(poolConfig: Partial<RedisPoolConfig> = {}) {
    this.config = { ...DEFAULT_POOL_CONFIG, ...poolConfig };
    this.baseOptions = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      db: config.redis.db,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) return null;
        return Math.min(times * 100, 2000);
      },
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: 5000,
      keepAlive: 30000,
      family: 4,
    };
  }

  /**
   * Initialize the connection pool
   */
  async initialize(): Promise<void> {
    logger.info(`Initializing Redis pool with ${this.config.minPoolSize} connections...`);

    const initPromises: Promise<void>[] = [];
    for (let i = 0; i < this.config.minPoolSize; i++) {
      initPromises.push(this.createConnection());
    }

    try {
      await Promise.all(initPromises);
      logger.info(`Redis pool initialized with ${this.pool.length} connections`);
    } catch (error) {
      logger.warn('Failed to initialize some Redis connections:', error);
    }
  }

  /**
   * Create a new Redis connection
   */
  private async createConnection(): Promise<void> {
    if (this.pool.length >= this.config.poolSize) return;

    const connection = new Redis(this.baseOptions);

    connection.on('error', (err) => {
      if (!err.message.includes('ECONNREFUSED')) {
        logger.warn('Redis pool connection error:', err.message);
      }
    });

    connection.on('close', () => {
      // Remove from pool
      const index = this.pool.indexOf(connection);
      if (index > -1) {
        this.pool.splice(index, 1);
      }
      this.inUse.delete(connection);
    });

    try {
      await connection.connect();
      await connection.ping();
      this.pool.push(connection);
    } catch (error) {
      // Connection failed, don't add to pool
      await connection.disconnect();
    }
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<Redis> {
    if (this.isShuttingDown) {
      throw new Error('Pool is shutting down');
    }

    // Find an available connection
    for (const conn of this.pool) {
      if (!this.inUse.has(conn) && conn.status === 'ready') {
        this.inUse.add(conn);
        return conn;
      }
    }

    // Try to create a new connection if pool not full
    if (this.pool.length < this.config.poolSize) {
      await this.createConnection();
      
      // Try again
      for (const conn of this.pool) {
        if (!this.inUse.has(conn) && conn.status === 'ready') {
          this.inUse.add(conn);
          return conn;
        }
      }
    }

    // Wait for a connection to become available
    return new Promise<Redis>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex((w) => w.resolve === resolve);
        if (index > -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error('Acquire timeout'));
      }, this.config.acquireTimeout);

      this.waitingQueue.push({ resolve, reject, timeout });
    });
  }

  /**
   * Release a connection back to the pool
   */
  release(connection: Redis): void {
    this.inUse.delete(connection);

    // Check if anyone is waiting
    if (this.waitingQueue.length > 0 && connection.status === 'ready') {
      const waiter = this.waitingQueue.shift()!;
      clearTimeout(waiter.timeout);
      this.inUse.add(connection);
      waiter.resolve(connection);
    }
  }

  /**
   * Execute a command with automatic connection handling
   */
  async execute<T>(command: (conn: Redis) => Promise<T>): Promise<T> {
    const connection = await this.acquire();
    try {
      return await command(connection);
    } finally {
      this.release(connection);
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    total: number;
    available: number;
    inUse: number;
    waiting: number;
  } {
    return {
      total: this.pool.length,
      available: this.pool.filter((c) => !this.inUse.has(c) && c.status === 'ready').length,
      inUse: this.inUse.size,
      waiting: this.waitingQueue.length,
    };
  }

  /**
   * Health check
   */
  async isHealthy(): Promise<boolean> {
    if (this.pool.length === 0) return false;

    try {
      const conn = this.pool.find((c) => c.status === 'ready');
      if (conn) {
        await conn.ping();
        return true;
      }
    } catch {
      return false;
    }

    return false;
  }

  /**
   * Graceful shutdown
   */
  async close(): Promise<void> {
    this.isShuttingDown = true;

    // Reject all waiting requests
    for (const waiter of this.waitingQueue) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error('Pool shutting down'));
    }
    this.waitingQueue = [];

    // Close all connections
    const closePromises = this.pool.map((conn) => conn.quit());
    await Promise.allSettled(closePromises);

    this.pool = [];
    this.inUse.clear();
    logger.info('Redis pool closed');
  }
}

/**
 * Redis Cluster Manager
 * For production environments with Redis Cluster
 */
export class RedisClusterManager {
  private cluster: Cluster | null = null;
  private isConnected: boolean = false;

  constructor(
    private nodes: Array<{ host: string; port: number }> = []
  ) {}

  /**
   * Initialize cluster connection
   */
  async initialize(): Promise<boolean> {
    if (this.nodes.length === 0) {
      logger.info('No cluster nodes configured, using single Redis instance');
      return false;
    }

    try {
      const clusterOptions: ClusterOptions = {
        clusterRetryStrategy: (times: number) => {
          if (times > 3) return null;
          return Math.min(times * 100, 2000);
        },
        redisOptions: {
          password: config.redis.password || undefined,
          connectTimeout: 5000,
          maxRetriesPerRequest: 3,
        },
        enableReadyCheck: true,
        scaleReads: 'slave', // Read from replicas
        natMap: {}, // For NAT/Docker environments
      };

      this.cluster = new Cluster(this.nodes, clusterOptions);

      this.cluster.on('connect', () => {
        this.isConnected = true;
        logger.info('Redis Cluster connected');
      });

      this.cluster.on('error', (err) => {
        logger.warn('Redis Cluster error:', err.message);
      });

      this.cluster.on('node error', (err, node) => {
        logger.warn(`Redis Cluster node ${node.options.host}:${node.options.port} error:`, err.message);
      });

      await this.cluster.ping();
      this.isConnected = true;
      return true;
    } catch (error) {
      logger.warn('Redis Cluster initialization failed:', error);
      return false;
    }
  }

  getCluster(): Cluster | null {
    return this.cluster;
  }

  isHealthy(): boolean {
    return this.isConnected && this.cluster !== null;
  }

  async close(): Promise<void> {
    if (this.cluster) {
      await this.cluster.quit();
      this.isConnected = false;
    }
  }
}

// ─── Conditional cluster bootstrap ───────────────────────────────────────────
//
// Set REDIS_CLUSTER_NODES to a comma-separated list of "host:port" pairs to
// enable Redis Cluster mode (e.g. "node1:7000,node2:7001,node3:7002").
// When absent the app uses the single-node ioredis client from config/redis.ts.
//
// The pool and cluster instances are NOT auto-instantiated here to avoid
// creating connections at import-time. Import these factory functions instead:

export function createRedisPool(poolConfig?: Partial<RedisPoolConfig>): RedisPool {
  return new RedisPool(poolConfig);
}

export function createRedisCluster(nodes: Array<{ host: string; port: number }>): RedisClusterManager {
  return new RedisClusterManager(nodes);
}

export default { RedisPool, RedisClusterManager, createRedisPool, createRedisCluster };
