// src/config/database.ts
// Sequelize database configuration and connection

import { Sequelize, Options } from 'sequelize';
import { config } from './index';
import { logger } from '../utils/logger';

const sequelizeOptions: Options = {
  dialect: 'postgres',
  logging: (msg) => logger.debug(msg),
  pool: {
    min: config.db.pool.min,
    max: config.db.pool.max,
    acquire: 30000,
    idle: 10000,
  },
  dialectOptions: config.db.ssl
    ? {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    }
    : {},
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: false,
  },
};

// Support both DATABASE_URL (Render) and individual variables
export const sequelize = config.db.url
  ? new Sequelize(config.db.url, sequelizeOptions)
  : new Sequelize(
    config.db.name,
    config.db.user,
    config.db.password,
    {
      ...sequelizeOptions,
      host: config.db.host,
      port: config.db.port,
    }
  );

// Initialize database connection
export async function initializeDatabase(): Promise<void> {
  try {
    await sequelize.authenticate();
    logger.info('Database connected successfully via Sequelize');

    const isProduction = config.app.env === 'production';
    const syncRequested = process.env.DB_SYNC === 'true';

    if (isProduction && syncRequested) {
      // Hard block: never run alter-sync in production — use proper migrations instead.
      logger.error(
        'DB_SYNC=true is not allowed in production. ' +
          'Use database migrations (e.g. sequelize-cli db:migrate) to apply schema changes safely.'
      );
      throw new Error('DB_SYNC is disabled in production. Use migrations.');
    }

    if (!isProduction && (config.app.env === 'development' || syncRequested)) {
      await sequelize.sync({ alter: true });
      logger.info('Database models synchronized (alter: true)');
    }
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  await sequelize.close();
  logger.info('Database connection closed');
}
