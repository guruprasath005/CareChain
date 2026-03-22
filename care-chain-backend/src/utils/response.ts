// src/utils/response.ts
// Standardized API response helpers

import { Response } from 'express';
import { ApiResponse as ApiResponseType, PaginationMeta, ValidationError } from '../types';

/**
 * Success response helper
 */
export function success<T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode: number = 200,
  meta?: PaginationMeta
): Response {
  const response: ApiResponseType<T> = {
    success: true,
    message,
    data,
    meta,
    statusCode,
    timestamp: new Date().toISOString(),
  };
  return res.status(statusCode).json(response);
}

/**
 * Created response helper (201)
 */
export function created<T>(res: Response, data?: T, message?: string): Response {
  return success(res, data, message || 'Resource created successfully', 201);
}

/**
 * Paginated response helper
 */
export function paginated<T>(
  res: Response,
  data: T[],
  page: number,
  limit: number,
  totalItems: number,
  message?: string
): Response {
  const totalPages = Math.ceil(totalItems / limit);
  const meta: PaginationMeta = {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
  return success(res, data, message, 200, meta);
}

/**
 * Error response helper
 */
export function error(
  res: Response,
  message: string,
  statusCode: number = 500,
  errors?: ValidationError[]
): Response {
  const response: ApiResponseType = {
    success: false,
    error: message,
    errors,
    statusCode,
    timestamp: new Date().toISOString(),
  };
  return res.status(statusCode).json(response);
}

/**
 * Bad request response (400)
 */
export function badRequest(res: Response, message: string, errors?: ValidationError[]): Response {
  return error(res, message, 400, errors);
}

/**
 * Unauthorized response (401)
 */
export function unauthorized(res: Response, message: string = 'Unauthorized'): Response {
  return error(res, message, 401);
}

/**
 * Forbidden response (403)
 */
export function forbidden(res: Response, message: string = 'Forbidden'): Response {
  return error(res, message, 403);
}

/**
 * Not found response (404)
 */
export function notFound(res: Response, message: string = 'Resource not found'): Response {
  return error(res, message, 404);
}

/**
 * Conflict response (409)
 */
export function conflict(res: Response, message: string): Response {
  return error(res, message, 409);
}

/**
 * Too many requests response (429)
 */
export function tooManyRequests(res: Response, message: string = 'Too many requests'): Response {
  return error(res, message, 429);
}

/**
 * Accepted response (202) - Request queued for processing
 */
export function accepted<T>(res: Response, data?: T, message?: string): Response {
  return success(res, data, message || 'Request accepted for processing', 202);
}

/**
 * Service unavailable response (503)
 */
export function serviceUnavailable(res: Response, message: string = 'Service temporarily unavailable'): Response {
  return error(res, message, 503);
}

/**
 * Internal server error response (500)
 */
export function internalError(res: Response, message: string = 'Internal server error'): Response {
  return error(res, message, 500);
}

export const ApiResponseHelper = {
  success,
  created,
  accepted,
  paginated,
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  tooManyRequests,
  serviceUnavailable,
  internalError,
};

// Alias for backward compatibility
export { ApiResponseHelper as ApiResponse };

export default ApiResponseHelper;
