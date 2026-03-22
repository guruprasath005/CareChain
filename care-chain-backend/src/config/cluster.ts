// src/config/cluster.ts
// Cluster Mode Configuration for horizontal scaling

import cluster from 'cluster';
import os from 'os';
import { logger } from '../utils/logger';
import { config } from './index';

export interface ClusterConfig {
  enabled: boolean;
  workers: number;
  restartOnExit: boolean;
  gracefulShutdownTimeout: number;
}

const DEFAULT_CONFIG: ClusterConfig = {
  enabled: process.env.CLUSTER_ENABLED === 'true',
  workers: parseInt(process.env.CLUSTER_WORKERS || '0', 10) || os.cpus().length,
  restartOnExit: process.env.CLUSTER_RESTART_ON_EXIT !== 'false',
  gracefulShutdownTimeout: parseInt(process.env.CLUSTER_SHUTDOWN_TIMEOUT || '30000', 10),
};

/**
 * Cluster Manager
 * Manages worker processes for horizontal scaling
 */
export class ClusterManager {
  private config: ClusterConfig;
  private isShuttingDown: boolean = false;
  private workers: Map<number, NodeJS.Process> = new Map();

  constructor(clusterConfig: Partial<ClusterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...clusterConfig };
  }

  /**
   * Check if this is the primary process
   */
  isPrimary(): boolean {
    return cluster.isPrimary;
  }

  /**
   * Check if clustering is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled && this.config.workers > 1;
  }

  /**
   * Start the cluster
   */
  start(workerScript?: () => Promise<void>): void {
    if (!this.isEnabled()) {
      logger.info('Cluster mode disabled, running single process');
      if (workerScript) {
        workerScript();
      }
      return;
    }

    if (this.isPrimary()) {
      this.startPrimary();
    } else if (workerScript) {
      workerScript();
    }
  }

  /**
   * Start the primary process
   */
  private startPrimary(): void {
    logger.info(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   🏥 CareChain Cluster Manager                                 ║
║                                                                ║
║   Mode: Primary                                                ║
║   Workers: ${this.config.workers.toString().padEnd(47)}║
║   CPUs: ${os.cpus().length.toString().padEnd(50)}║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
    `);

    // Fork workers
    for (let i = 0; i < this.config.workers; i++) {
      this.forkWorker();
    }

    // Handle worker exit
    cluster.on('exit', (worker, code, signal) => {
      logger.warn(`Worker ${worker.process.pid} died (${signal || code})`);
      
      if (this.config.restartOnExit && !this.isShuttingDown) {
        logger.info('Restarting worker...');
        setTimeout(() => this.forkWorker(), 1000);
      }
    });

    // Handle worker messages
    cluster.on('message', (worker, message) => {
      this.handleWorkerMessage(worker, message);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
  }

  /**
   * Fork a new worker
   */
  private forkWorker(): void {
    const worker = cluster.fork();
    logger.info(`Worker ${worker.process.pid} started`);
  }

  /**
   * Handle messages from workers
   */
  private handleWorkerMessage(worker: any, message: any): void {
    if (message.type === 'ready') {
      logger.info(`Worker ${worker.process.pid} is ready`);
    }
  }

  /**
   * Graceful shutdown of all workers
   */
  private async gracefulShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info(`\n${signal} received. Shutting down cluster...`);

    // Send shutdown signal to all workers
    for (const id in cluster.workers) {
      const worker = cluster.workers[id];
      if (worker) {
        worker.send({ type: 'shutdown' });
        worker.disconnect();
      }
    }

    // Wait for workers to finish or force kill
    setTimeout(() => {
      logger.warn('Forcing worker shutdown...');
      for (const id in cluster.workers) {
        const worker = cluster.workers[id];
        if (worker) {
          worker.kill('SIGKILL');
        }
      }
      process.exit(0);
    }, this.config.gracefulShutdownTimeout);
  }

  /**
   * Get cluster statistics
   */
  getStats(): {
    isPrimary: boolean;
    workerId: number | undefined;
    workers: number;
    cpus: number;
  } {
    return {
      isPrimary: this.isPrimary(),
      workerId: cluster.isWorker ? cluster.worker?.id : undefined,
      workers: Object.keys(cluster.workers || {}).length,
      cpus: os.cpus().length,
    };
  }
}

export const clusterManager = new ClusterManager();

export default clusterManager;
