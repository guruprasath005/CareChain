// src/config/index.ts
// Central configuration loader - reads from environment variables

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * CORS allowed origins.
 * In development, default to reflecting the request `Origin` so Expo Go / physical devices work
 * (they send origins like exp://… or http://192.168.x.x:8081, not localhost:3000).
 */
function getCorsOrigin(): boolean | string | string[] {
  if (process.env.CORS_ORIGIN === '*') return '*';
  if (process.env.CORS_ORIGIN?.trim()) {
    return process.env.CORS_ORIGIN.split(',').map((s) => s.trim());
  }
  if (NODE_ENV === 'development') return true;
  return ['http://localhost:3000'];
}

export const config = {
  // Application
  app: {
    env: NODE_ENV,
    // Default 5001: macOS Monterey+ binds AirPlay Receiver to 5000 — not our API
    port: parseInt(process.env.PORT || '5001', 10),
    apiVersion: process.env.API_VERSION || 'v1',
    apiPrefix: process.env.API_PREFIX || '/api/v1',
    /** Base URL for links in emails (CORS origin may be `true` in dev, which is not a single URL) */
    publicWebUrl: process.env.APP_PUBLIC_URL || process.env.WEB_APP_URL || 'http://localhost:3000',
  },

  // Database (PostgreSQL)
  // Supports DATABASE_URL (Render format) or individual variables
  db: {
    url: process.env.DATABASE_URL || null,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'carechain',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true' || !!process.env.DATABASE_URL,
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    },
  },

  // Redis
  redis: {
    // Prefer REDIS_URL when provided (e.g., Render/Upstash/local docker)
    url: process.env.REDIS_URL || null,
    // Default to IPv4 loopback to avoid Windows/Node multi-address 'localhost' AggregateError
    host: (process.env.REDIS_HOST || '127.0.0.1').trim(),
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  // JWT Authentication
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'default_access_secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default_refresh_secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // OTP Configuration
  otp: {
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10),
    resendCooldownSeconds: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60', 10),
  },

  // Email (SMTP)
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.zoho.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    // Secure: true for 465, false for 587
    secure: process.env.SMTP_SECURE === 'true' || (process.env.SMTP_PORT === '465'),
    user: process.env.SMTP_USER || '',
    // Back-compat: some env files used SMTP_PASS
    password: process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '',
    from: {
      // Back-compat: some env files used EMAIL_FROM_NAME / EMAIL_FROM
      name: process.env.SMTP_FROM_NAME || process.env.EMAIL_FROM_NAME || 'CareChain',
      email: process.env.SMTP_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@carechain.com',
    },
  },

  // File Upload
  upload: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10),
    allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/webp,application/pdf').split(','),
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // CORS
  cors: {
    origin: getCorsOrigin(),
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    format: process.env.LOG_FORMAT || 'combined',
  },

  // Cloudinary (File Storage)
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || 'care_chain_uploads',
  },

  // Cluster Mode (for scaling)
  cluster: {
    enabled: process.env.CLUSTER_ENABLED === 'true',
    workers: parseInt(process.env.CLUSTER_WORKERS || '0', 10), // 0 = auto (CPU count)
    restartOnExit: process.env.CLUSTER_RESTART_ON_EXIT !== 'false',
    shutdownTimeout: parseInt(process.env.CLUSTER_SHUTDOWN_TIMEOUT || '30000', 10),
  },

  // API Gateway
  gateway: {
    enableRateLimiting: process.env.GATEWAY_RATE_LIMITING !== 'false',
    enableCircuitBreaker: process.env.GATEWAY_CIRCUIT_BREAKER !== 'false',
    enableCaching: process.env.GATEWAY_CACHING !== 'false',
    enableRequestQueue: process.env.GATEWAY_REQUEST_QUEUE !== 'false',
  },

  // Job Queue
  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '50', 10),
    bulkBatchSize: parseInt(process.env.QUEUE_BULK_BATCH_SIZE || '100', 10),
    maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES || '3', 10),
  },

  // Razorpay Payment Gateway
  payment: {
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
    // When false, job posting requires a purchased credit; useful for free trials
    requireJobPostCredits: process.env.REQUIRE_JOB_POST_CREDITS === 'true',
  },
};

export default config;
