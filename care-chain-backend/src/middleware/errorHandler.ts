// src/middleware/errorHandler.ts
// Global Error Handler Middleware
// Catches all errors and returns standardized response

import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/response';
import { logger } from '../utils/logger';
import { config } from '../config';

/**
 * Custom Application Error class
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

/**
 * Validation Error (400)
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed') {
    super(message, 400);
  }
}

/**
 * Authentication Error (401)
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401);
  }
}

/**
 * Authorization Error (403)
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403);
  }
}

/**
 * Conflict Error (409)
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409);
  }
}

/**
 * Rate Limit Error (429)
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429);
  }
}

/**
 * Global Error Handler Middleware
 * 
 * Responsibilities:
 * - Log all errors
 * - Handle operational errors (expected errors)
 * - Handle programming errors (unexpected errors)
 * - Send appropriate error response
 * - Hide error details in production
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Default error values
  let statusCode = 500;
  let message = 'Internal server error';
  let isOperational = false;

  // Handle AppError instances
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
  }

  // Handle specific error types
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
  }

  // In production, don't leak error details for non-operational errors
  if (config.app.env === 'production' && !isOperational) {
    message = 'An unexpected error occurred';
  }

  ApiResponse.error(res, message, statusCode);
}

/**
 * 404 Not Found Handler
 * Use this for undefined routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  ApiResponse.notFound(res, `Route ${req.method} ${req.path} not found`);
}

export default errorHandler;
