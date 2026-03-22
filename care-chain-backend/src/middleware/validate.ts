// src/middleware/validate.ts
// Request Validation Middleware using Zod
// Validates request body, query, and params against schemas

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ApiResponse } from '../utils/response';
import { ValidationError } from '../types';

type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Validation Middleware Factory
 * 
 * Responsibilities:
 * - Validate request data against Zod schema
 * - Transform validated data back to request object
 * - Return 400 Bad Request with validation errors if invalid
 * 
 * Usage:
 * import { z } from 'zod';
 * 
 * const loginSchema = z.object({
 *   email: z.string().email(),
 *   password: z.string().min(8),
 * });
 * 
 * router.post('/login', validate(loginSchema), authController.login);
 * 
 * @param schema - Zod schema to validate against
 * @param target - Which part of request to validate (body, query, params)
 */
export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const dataToValidate = req[target];
      
      // Parse and validate
      const result = schema.safeParse(dataToValidate);

      if (!result.success) {
        const errors = formatZodErrors(result.error);
        ApiResponse.badRequest(res, 'Validation failed', errors);
        return;
      }

      // Replace request data with validated/transformed data
      req[target] = result.data;
      
      next();
    } catch (error) {
      ApiResponse.internalError(res, 'Validation error');
    }
  };
}

/**
 * Validate multiple targets at once
 */
export function validateAll(schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const allErrors: ValidationError[] = [];

    for (const [target, schema] of Object.entries(schemas)) {
      if (!schema) continue;

      const result = schema.safeParse(req[target as ValidationTarget]);
      
      if (!result.success) {
        const errors = formatZodErrors(result.error, target);
        allErrors.push(...errors);
      } else {
        req[target as ValidationTarget] = result.data;
      }
    }

    if (allErrors.length > 0) {
      ApiResponse.badRequest(res, 'Validation failed', allErrors);
      return;
    }

    next();
  };
}

/**
 * Format Zod errors into our ValidationError format
 */
function formatZodErrors(error: ZodError, prefix?: string): ValidationError[] {
  return error.errors.map((err) => ({
    field: prefix ? `${prefix}.${err.path.join('.')}` : err.path.join('.'),
    message: err.message,
  }));
}

export default validate;
