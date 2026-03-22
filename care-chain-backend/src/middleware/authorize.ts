// src/middleware/authorize.ts
// Role-Based Access Control (RBAC) Middleware
// Restricts routes to specific user roles

import { Response, NextFunction } from 'express';
import { AuthRequest, UserRole } from '../types';
import { ApiResponse } from '../utils/response';
import { logger } from '../utils/logger';

/**
 * Authorization Middleware Factory
 * 
 * Responsibilities:
 * - Verify user is authenticated (must be used after authenticate middleware)
 * - Check if user's role is in the allowed roles list
 * - Return 403 Forbidden if role not authorized
 * 
 * Usage:
 * // Single role
 * router.get('/doctor/profile', authenticate, authorize('doctor'), doctorController.getProfile);
 * 
 * // Multiple roles
 * router.get('/shared', authenticate, authorize('doctor', 'hospital'), controller.method);
 * 
 * @param allowedRoles - Roles that are allowed to access the route
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      // 1. Verify user exists on request (authenticate middleware should have run)
      if (!req.user) {
        ApiResponse.unauthorized(res, 'Authentication required');
        return;
      }

      // 2. Check if user's role is in allowed roles
      const userRole = req.user.role;

      if (!allowedRoles.includes(userRole)) {
        logger.warn(`Access denied: User ${req.user.id} with role ${userRole} attempted to access ${req.method} ${req.path}`);
        ApiResponse.forbidden(res, 'You do not have permission to access this resource');
        return;
      }

      // 3. Additional role-specific checks can be added here
      // For example, check if doctor profile is complete for certain routes
      // if (userRole === 'doctor' && !req.user.isProfileComplete && requiresCompleteProfile) {
      //   return ApiResponse.forbidden(res, 'Please complete your profile first');
      // }

      next();
    } catch (error) {
      logger.error('Authorization error:', error);
      ApiResponse.internalError(res, 'Authorization failed');
    }
  };
}

/**
 * Convenience middleware for doctor-only routes
 */
export const doctorOnly = authorize('doctor');

/**
 * Convenience middleware for hospital-only routes
 */
export const hospitalOnly = authorize('hospital');

/**
 * Convenience middleware for admin-only routes
 */
export const adminOnly = authorize('admin');

/**
 * Middleware to ensure email is verified
 */
export function requireEmailVerified(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    ApiResponse.unauthorized(res, 'Authentication required');
    return;
  }

  if (!req.user.isEmailVerified) {
    ApiResponse.forbidden(res, 'Please verify your email first');
    return;
  }

  next();
}

/**
 * Middleware to ensure profile is complete
 */
export function requireProfileComplete(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    ApiResponse.unauthorized(res, 'Authentication required');
    return;
  }

  if (!req.user.isProfileComplete) {
    ApiResponse.forbidden(res, 'Please complete your profile first');
    return;
  }

  next();
}

export default authorize;
