// src/controllers/auth.controller.ts
// Authentication Controller - Stub implementations
// TODO: Implement actual business logic

import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { ApiResponse } from '../utils/response';
import { authService } from '../services/auth.service';

/**
 * Auth Controller
 * 
 * All methods are stubs - implement actual logic
 */
export const authController = {
  /**
   * POST /auth/signup
   * Step 1: User registration
   */
  async signup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.signup(req.body);
      ApiResponse.created(res, result, result.message);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /auth/verify-email
   * Step 2: Verify email with OTP
   */
  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp } = req.body;
      const result = await authService.verifyEmail(email, otp);
      if ((result as any).tokens && (result as any).user) {
        const r = result as any;
        ApiResponse.success(
          res,
          {
            success: r.success,
            message: r.message,
            requiresRoleSelection: r.requiresRoleSelection,
            email: r.email,
            fullName: r.fullName,
            user: r.user,
            accessToken: r.tokens.accessToken,
            refreshToken: r.tokens.refreshToken,
            expiresIn: r.tokens.expiresIn,
          },
          result.message
        );
        return;
      }

      ApiResponse.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /auth/select-role
   * Step 3: Select user role (doctor/hospital)
   */
  async selectRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, role } = req.body;
      const result = await authService.selectRole(email, role);

      // Set refresh token in cookie (optional, for better security)
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      ApiResponse.success(
        res,
        {
          user: result.user,
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          expiresIn: result.tokens.expiresIn,
          profile: result.profile,
        },
        'Role selected and logged in successfully'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /auth/resend-otp
   */
  async resendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, type } = req.body;
      const result = await authService.resendOtp(email, type);
      ApiResponse.success(res, null, result.message);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /auth/login
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);

      if (result.requiresRoleSelection) {
        ApiResponse.success(
          res,
          {
            requiresRoleSelection: true,
            email: result.email,
            fullName: result.fullName,
          },
          'Role selection required'
        );
        return;
      }

      if (result.requiresVerification) {
        ApiResponse.success(
          res,
          {
            requiresVerification: true,
            email: result.email,
            fullName: result.fullName,
          },
          'Email verification required'
        );
        return;
      }

      if (result.tokens) {
        // Set refresh token in cookie
        res.cookie('refreshToken', result.tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
      }

      ApiResponse.success(
        res,
        {
          user: result.user,
          accessToken: result.tokens!.accessToken,
          refreshToken: result.tokens!.refreshToken,
          expiresIn: result.tokens!.expiresIn,
        },
        'Login successful'
      );
    } catch (error: any) {
      const msg: string = error?.message || '';
      if (msg.includes('Invalid email or password')) {
        ApiResponse.unauthorized(res, msg);
      } else if (msg.includes('deactivated')) {
        ApiResponse.forbidden(res, msg);
      } else {
        next(error);
      }
    }
  },

  /**
   * GET /auth/me
   */
  async getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new Error('User not authenticated');
      }

      const user = await authService.getCurrentUser(req.user.id);
      if (!user) {
        throw new Error('User not found');
      }

      ApiResponse.success(res, { user }, 'User retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /auth/forgot-password
   */
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      const result = await authService.forgotPassword(email);
      ApiResponse.success(res, null, result.message);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /auth/reset-password
   */
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp, newPassword } = req.body;
      const result = await authService.resetPassword(email, otp, newPassword);
      ApiResponse.success(res, null, result.message);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /auth/change-password
   */
  async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new Error('User not authenticated');
      }

      const { currentPassword, newPassword } = req.body;
      const result = await authService.changePassword(
        req.user.id,
        currentPassword,
        newPassword
      );
      ApiResponse.success(res, null, result.message);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /auth/refresh-token
   */
  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const tokens = await authService.refreshToken(refreshToken);

      if (!tokens) {
        throw new Error('Invalid or expired refresh token');
      }

      // Update cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      ApiResponse.success(res, tokens, 'Token refreshed successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /auth/logout
   */
  async logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Get token ID from current access token if available
      // The authenticate middleware attaches the decoded token to req.tokenId
      if (req.tokenId) {
        await authService.logout(req.tokenId);
      } else if (req.body.refreshToken) {
        // Fallback to checking refresh token body if for some reason access token invalidation isn't enough
        // But authService.logout expects tokenId (from access token usually)
        // If we only have refresh token, we might need to decode it to get tokenId, 
        // but let's assume standard logout uses the active session
      }

      res.clearCookie('refreshToken');
      ApiResponse.success(res, null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /auth/logout-all
   */
  async logoutAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new Error('User not authenticated');
      }

      await authService.logoutAll(req.user.id);
      res.clearCookie('refreshToken');
      ApiResponse.success(res, null, 'Logged out from all devices successfully');
    } catch (error) {
      next(error);
    }
  },
};

export default authController;
