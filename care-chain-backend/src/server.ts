// src/server.ts
// Server Entry Point

import { createServer } from 'http';
import app from './app';
import { config } from './config';
import { initializeDatabase, closeDatabaseConnection } from './config/database';
import { initializeRedis, closeRedisConnection } from './config/redis';
import { initializeSocketIO } from './config/socket';
import { apiGateway } from './gateway';
import { jobQueueService } from './services/jobQueue.service';
import { notificationService } from './services/notification.service';
import { cacheService } from './services/cache.service';
import { logger } from './utils/logger';

// Import models to initialize associations
import './models';

const PORT = config.app.port;

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  try {
    // Initialize database connection
    logger.info('Connecting to PostgreSQL...');
    await initializeDatabase();

    // Initialize Redis connection (optional)
    logger.info('Connecting to Redis...');
    const redisConnected = await initializeRedis();
    if (!redisConnected) {
      logger.warn('⚠️  Running without Redis - some features may be limited');
    }

    // Optional services — do not block startup (matches Documents: DB + Redis → listen)
    // If these fail (e.g. Redis down), server still accepts requests; auth/login works.
    try {
      logger.info('Initializing API Gateway...');
      await apiGateway.initialize();
    } catch (e) {
      logger.warn('API Gateway init failed (server will still run):', e);
    }
    try {
      logger.info('Initializing Job Queue Service...');
      await jobQueueService.initialize();
    } catch (e) {
      logger.warn('Job Queue init failed (server will still run):', e);
    }
    try {
      logger.info('Initializing Notification Service...');
      await notificationService.init();
    } catch (e) {
      logger.warn('Notification Service init failed (server will still run):', e);
    }

    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize Socket.IO
    logger.info('Initializing Socket.IO...');
    await initializeSocketIO(httpServer);

    // Start HTTP server - bind to 0.0.0.0 to accept connections from Android emulator
    httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   🏥 CareChain Backend API                                     ║
║                                                                ║
║   Environment: ${config.app.env.padEnd(43)}║
║   Port: ${PORT.toString().padEnd(50)}║
║   Host: 0.0.0.0 (accessible from emulator)                     ║
║   API: ${(config.app.apiPrefix).padEnd(51)}║
║   Socket.IO: Enabled                                           ║
║                                                                ║
║   Ready to accept connections!                                 ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info(`\n${signal} received. Starting graceful shutdown...`);

      // Stop accepting new connections
      httpServer.close(async () => {
        logger.info('HTTP server closed');

        try {
          try { await apiGateway.shutdown(); } catch (e) { logger.warn('Gateway shutdown:', e); }
          try { await jobQueueService.shutdown(); } catch (e) { logger.warn('JobQueue shutdown:', e); }
          try { await notificationService.close(); } catch (e) { logger.warn('Notification close:', e); }
          try { await cacheService.close(); } catch (e) { logger.warn('Cache close:', e); }
          await closeDatabaseConnection();
          await closeRedisConnection();
          logger.info('All connections closed. Exiting...');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    // Listen for shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
