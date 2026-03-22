// src/routes/auth.routes.ts
// Authentication Routes
// All routes for user authentication and session management

import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { authLimiter, otpLimiter, passwordResetLimiter } from '../middleware/rateLimit';
import {
  signupSchema,
  verifyEmailSchema,
  selectRoleSchema,
  resendOtpSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  refreshTokenSchema,
  logoutSchema,
} from '../validators/auth.validator';

const router = Router();

/**
 * @route   POST /api/v1/auth/signup
 * @desc    Register a new user (Step 1 of registration)
 * @access  Public
 * @body    { fullName, email, password }
 * @returns { message: 'OTP sent to email' }
 */
router.post(
  '/signup',
  authLimiter,
  validate(signupSchema),
  authController.signup
);

/**
 * @route   POST /api/v1/auth/verify-email
 * @desc    Verify email with OTP (Step 2 of registration)
 * @access  Public
 * @body    { email, otp }
 * @returns { message: 'Email verified' }
 */
router.post(
  '/verify-email',
  authLimiter,
  validate(verifyEmailSchema),
  authController.verifyEmail
);

/**
 * @route   POST /api/v1/auth/select-role
 * @desc    Select user role - doctor or hospital (Step 3 of registration)
 * @access  Public
 * @body    { email, role: 'doctor' | 'hospital' }
 * @returns { user, accessToken, refreshToken }
 */
router.post(
  '/select-role',
  authLimiter,
  validate(selectRoleSchema),
  authController.selectRole
);

/**
 * @route   POST /api/v1/auth/resend-otp
 * @desc    Resend OTP for email verification or password reset
 * @access  Public
 * @body    { email, type: 'email_verification' | 'password_reset' }
 * @returns { message: 'OTP sent' }
 */
router.post(
  '/resend-otp',
  otpLimiter,
  validate(resendOtpSchema),
  authController.resendOtp
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    User login
 * @access  Public
 * @body    { email, password }
 * @returns { user, accessToken, refreshToken } or { requiresVerification } or { requiresRoleSelection }
 */
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  authController.login
);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current authenticated user
 * @access  Private (requires auth)
 * @headers Authorization: Bearer <accessToken>
 * @returns { user }
 */
router.get(
  '/me',
  authenticate,
  authController.getMe
);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset OTP
 * @access  Public
 * @body    { email }
 * @returns { message: 'OTP sent if email exists' }
 */
router.post(
  '/forgot-password',
  passwordResetLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password using OTP
 * @access  Public
 * @body    { email, otp, newPassword }
 * @returns { message: 'Password reset successful' }
 */
router.post(
  '/reset-password',
  passwordResetLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword
);

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change password (while logged in)
 * @access  Private (requires auth)
 * @headers Authorization: Bearer <accessToken>
 * @body    { currentPassword, newPassword, confirmPassword }
 * @returns { message: 'Password changed' }
 */
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword
);

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Refresh access token using refresh token
 * @access  Public
 * @body    { refreshToken }
 * @returns { accessToken, refreshToken }
 */
router.post(
  '/refresh-token',
  validate(refreshTokenSchema),
  authController.refreshToken
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout current session
 * @access  Private (requires auth)
 * @headers Authorization: Bearer <accessToken>
 * @body    { refreshToken } (optional)
 * @returns { message: 'Logged out' }
 */
router.post(
  '/logout',
  authenticate,
  validate(logoutSchema),
  authController.logout
);

/**
 * @route   POST /api/v1/auth/logout-all
 * @desc    Logout from all devices
 * @access  Private (requires auth)
 * @headers Authorization: Bearer <accessToken>
 * @returns { message: 'Logged out from all devices' }
 */
router.post(
  '/logout-all',
  authenticate,
  authController.logoutAll
);

export default router;
