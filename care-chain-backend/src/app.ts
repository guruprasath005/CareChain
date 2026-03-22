// src/app.ts
// Express Application Setup

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { config } from './config';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimit';
import { logger } from './utils/logger';

// ─── Production safety guard ───────────────────────────────────────────────────
// Warn loudly if weak default JWT secrets reach production.
if (config.app.env === 'production') {
  const weakSecrets = ['default_access_secret', 'default_refresh_secret'];
  if (
    weakSecrets.includes(config.jwt.accessSecret) ||
    weakSecrets.includes(config.jwt.refreshSecret)
  ) {
    logger.error(
      'FATAL: JWT secrets are set to insecure default values in production. ' +
        'Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET to strong random strings and restart.'
    );
    process.exit(1);
  }
}

const app: Application = express();

// Disable Express fingerprinting before anything else
app.disable('x-powered-by');

// Trust proxy (required for Render/Heroku to handle X-Forwarded-For correctly)
app.set('trust proxy', 1);

// ─── Security middleware ───────────────────────────────────────────────────────

const isProduction = config.app.env === 'production';

// Helmet — security headers
// Production: full strict policy. Development: permissive for local API clients.
if (isProduction) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          scriptSrc: ["'none'"],
          styleSrc: ["'none'"],
          imgSrc: ["'none'"],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      crossOriginEmbedderPolicy: false, // REST + mobile clients
      // Default CORP same-origin breaks some iOS / RN fetch stacks (403 + empty body on LAN HTTP)
      crossOriginResourcePolicy: false,
    })
  );
} else {
  // Development: just set the basics so local Postman/Expo clients aren't blocked
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: false,
    })
  );
}

// CORS — Cross-Origin Resource Sharing
app.use(
  cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400, // 24 h preflight cache
  })
);

// Rate limiting — applied globally before route handlers
app.use(generalLimiter);

// ─── Parsing middleware ────────────────────────────────────────────────────────

// JSON body size: 1 MB in production to limit abuse; 10 MB locally for dev convenience
const bodyLimit = isProduction ? '1mb' : '10mb';

app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));
app.use(cookieParser());

// ─── Optimisation middleware ───────────────────────────────────────────────────

app.use(compression());

// ─── Request logging ───────────────────────────────────────────────────────────

// Structured access log: method + path + status + duration, always on
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'debug';
    logger[level](`${req.method} ${req.path} ${res.statusCode} — ${durationMs}ms`);
  });
  next();
});

// ─── Static files ──────────────────────────────────────────────────────────────

// Serve uploaded files (only in non-production — in prod use Cloudinary/CDN)
if (!isProduction) {
  app.use('/uploads', express.static(config.upload.dir));
}

// ─── API routes ────────────────────────────────────────────────────────────────

app.use(config.app.apiPrefix, routes);

// ─── Error handling ────────────────────────────────────────────────────────────

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
