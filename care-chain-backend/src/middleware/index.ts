// src/middleware/index.ts
// Central export for all middleware

export { authenticate } from './authenticate';
export { 
  authorize, 
  doctorOnly, 
  hospitalOnly, 
  adminOnly,
  requireEmailVerified,
  requireProfileComplete 
} from './authorize';
export { validate, validateAll } from './validate';
export { 
  errorHandler, 
  notFoundHandler,
  AppError,
  NotFoundError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  RateLimitError 
} from './errorHandler';
export { 
  generalLimiter, 
  authLimiter, 
  otpLimiter, 
  passwordResetLimiter,
  uploadLimiter 
} from './rateLimit';
