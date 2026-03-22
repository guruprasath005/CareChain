// src/services/auth.service.ts
// Authentication Service - Complete authentication logic

import bcrypt from 'bcryptjs';
import { User } from '../models/User.model';
import { Doctor } from '../models/Doctor.model';
import { Hospital } from '../models/Hospital.model';
import { UserRole, OtpType } from '../models/types';
import { tokenService, TokenPair } from './token.service';
import { otpService } from './otp.service';
import { emailService } from './email.service';
import { pendingSignupService } from './pending-signup.service';
import { cacheService, CACHE_KEYS } from './cache.service';
import { logger } from '../utils/logger';
import { sequelize } from '../config/database';

export interface SignupData {
    fullName: string;
    email: string;
    password: string;
}

export interface LoginResult {
    user: User;
    tokens: TokenPair;
}

export interface SignupResult {
    user: {
        id: string;
        email: string;
        fullName: string;
    };
    message: string;
}

export interface VerifyEmailResult {
    success: boolean;
    message: string;
    requiresRoleSelection?: boolean;
    email?: string;
    fullName?: string;
    user?: User;
    tokens?: TokenPair;
}

export interface SelectRoleResult {
    user: User;
    tokens: TokenPair;
    profile: Doctor | Hospital;
}

export interface LoginCheckResult {
    requiresVerification?: boolean;
    requiresRoleSelection?: boolean;
    email?: string;
    fullName?: string;
    user?: User;
    tokens?: TokenPair;
}

/**
 * Authentication Service
 * Handles user registration, login, verification, and password management
 */
class AuthService {
    /**
     * Register a new user
     */
    async signup(data: SignupData): Promise<SignupResult> {
        const { fullName, email, password } = data;
        const normalizedEmail = email.toLowerCase().trim();

        // Check if email already exists in User table
        const existingUser = await User.findOne({
            where: { email: normalizedEmail },
        });

        if (existingUser) {
            throw new Error('An account with this email already exists');
        }

        // Check if there's already a pending signup for this email
        const hasPending = await pendingSignupService.hasPendingSignup(normalizedEmail);
        if (hasPending) {
            // Delete old pending signup and create new one
            await pendingSignupService.deletePendingSignup(normalizedEmail);
        }

        // Hash password
        const hashedPassword = await this.hashPassword(password);

        // Store pending signup (NOT in database yet)
        await pendingSignupService.storePendingSignup(
            normalizedEmail,
            fullName.trim(),
            hashedPassword
        );

        // Generate and send OTP
        const otp = await otpService.createOtp(normalizedEmail, OtpType.EMAIL_VERIFICATION);

        // Send verification email
        await emailService.sendVerificationOtp(normalizedEmail, otp, fullName);

        logger.info(`Pending signup created for: ${normalizedEmail}`);

        return {
            user: {
                id: '', // No ID yet, user not created
                email: normalizedEmail,
                fullName: fullName.trim(),
            },
            message: 'Registration successful. Please check your email for the verification code.',
        };
    }

    /**
     * Verify email with OTP
     */
    async verifyEmail(email: string, otp: string): Promise<VerifyEmailResult> {
        const normalizedEmail = email.toLowerCase().trim();

        // First, verify the OTP
        const otpResult = await otpService.verifyOtp(normalizedEmail, otp, OtpType.EMAIL_VERIFICATION);

        if (!otpResult.success) {
            throw new Error(otpResult.message);
        }

        // Check if user already exists in database (for existing users)
        let user = await User.findOne({
            where: { email: normalizedEmail },
        });

        if (user) {
            // User already exists, just mark as verified
            if (user.isEmailVerified) {
                return {
                    success: true,
                    message: 'Email is already verified',
                };
            }

            user.isEmailVerified = true;
            await user.save();

            logger.info(`Email verified for existing user: ${normalizedEmail}`);

            // If role is still pending, force role selection step next.
            if (user.role === UserRole.PENDING) {
                return {
                    success: true,
                    message: 'Email verified successfully',
                    requiresRoleSelection: true,
                    email: user.email,
                    fullName: user.fullName,
                };
            }

            // If user already has a role, issue tokens.
            const tokens = await tokenService.generateTokenPair(user.id, user.email, user.role);

            return {
                success: true,
                message: 'Email verified successfully',
                user,
                tokens,
            };
        }

        // User doesn't exist yet - retrieve from pending signup
        const pendingSignup = await pendingSignupService.getPendingSignup(normalizedEmail);

        if (!pendingSignup) {
            throw new Error('No pending signup found. Please sign up again.');
        }

        // Create user in database NOW (after successful verification)
        user = await User.create({
            fullName: pendingSignup.fullName,
            email: pendingSignup.email,
            password: pendingSignup.hashedPassword,
            role: UserRole.PENDING,
            isEmailVerified: true, // Already verified
            isActive: true,
            isProfileComplete: false,
        });

        // Delete pending signup
        await pendingSignupService.deletePendingSignup(normalizedEmail);

        logger.info(`User created after email verification: ${normalizedEmail}`);

        // Return requiresRoleSelection since new user needs to select role
        return {
            success: true,
            message: 'Email verified successfully',
            requiresRoleSelection: true,
            email: user.email,
            fullName: user.fullName,
        };
    }

    /**
     * Resend OTP
     */
    async resendOtp(email: string, type: OtpType): Promise<{ message: string }> {
        const normalizedEmail = email.toLowerCase().trim();

        // Check if user exists in database
        const user = await User.findOne({
            where: { email: normalizedEmail },
        });

        // If user exists, validate based on type
        if (user) {
            if (type === OtpType.EMAIL_VERIFICATION && user.isEmailVerified) {
                throw new Error('Email is already verified');
            }

            // Generate and send OTP
            const otp = await otpService.createOtp(normalizedEmail, type);

            if (type === OtpType.EMAIL_VERIFICATION) {
                await emailService.sendVerificationOtp(normalizedEmail, otp, user.fullName);
            } else if (type === OtpType.PASSWORD_RESET) {
                await emailService.sendPasswordResetOtp(normalizedEmail, otp, user.fullName);
            }

            logger.debug(`OTP resent to existing user ${normalizedEmail} (type: ${type})`);
            return { message: 'A new verification code has been sent to your email.' };
        }

        // User not in database, check pending signups
        if (type === OtpType.EMAIL_VERIFICATION) {
            const pendingSignup = await pendingSignupService.getPendingSignup(normalizedEmail);

            if (pendingSignup) {
                // Generate and send OTP for pending signup
                const otp = await otpService.createOtp(normalizedEmail, type);
                await emailService.sendVerificationOtp(normalizedEmail, otp, pendingSignup.fullName);

                logger.debug(`OTP resent to pending signup ${normalizedEmail}`);
                return { message: 'A new verification code has been sent to your email.' };
            }
        }

        // Return success message even if user/pending signup doesn't exist (security)
        return { message: 'If an account exists with this email, a new code has been sent.' };
    }

    /**
     * Select user role and create profile
     */
    async selectRole(email: string, role: 'doctor' | 'hospital'): Promise<SelectRoleResult> {
        const normalizedEmail = email.toLowerCase().trim();

        // Find user
        const user = await User.findOne({
            where: { email: normalizedEmail },
        });

        if (!user) {
            throw new Error('User not found');
        }

        if (!user.isEmailVerified) {
            throw new Error('Please verify your email first');
        }

        if (user.role !== UserRole.PENDING) {
            throw new Error('Role has already been selected');
        }

        // Start transaction
        const transaction = await sequelize.transaction();

        try {
            // Update user role
            user.role = role === 'doctor' ? UserRole.DOCTOR : UserRole.HOSPITAL;
            await user.save({ transaction });

            let profile: Doctor | Hospital;

            // Create profile based on role
            if (role === 'doctor') {
                profile = await Doctor.create(
                    {
                        userId: user.id,
                        isSearchable: true,
                    },
                    { transaction }
                );
            } else {
                profile = await Hospital.create(
                    {
                        userId: user.id,
                        isSearchable: true,
                    },
                    { transaction }
                );
            }

            await transaction.commit();

            // Generate tokens
            const tokens = await tokenService.generateTokenPair(
                user.id,
                user.email,
                user.role
            );

            // Send welcome email
            await emailService.sendWelcomeEmail(user.email, user.fullName, role);

            logger.info(`Role selected for user ${normalizedEmail}: ${role}`);

            return {
                user,
                tokens,
                profile,
            };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * User login
     */
    async login(email: string, password: string): Promise<LoginCheckResult> {
        const normalizedEmail = email.toLowerCase().trim();

        // Find user
        const user = await User.findOne({
            where: { email: normalizedEmail },
        });

        if (!user) {
            throw new Error('Invalid email or password');
        }

        if (!user.isActive) {
            throw new Error('Your account has been deactivated. Please contact support.');
        }

        // Verify password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            throw new Error('Invalid email or password');
        }

        // Check if email is verified
        if (!user.isEmailVerified) {
            // Generate new OTP
            const otp = await otpService.createOtp(normalizedEmail, OtpType.EMAIL_VERIFICATION);
            await emailService.sendVerificationOtp(normalizedEmail, otp, user.fullName);

            return {
                requiresVerification: true,
                email: user.email,
                fullName: user.fullName,
            };
        }

        // Check if role is selected
        if (user.role === UserRole.PENDING) {
            return {
                requiresRoleSelection: true,
                email: user.email,
                fullName: user.fullName,
            };
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate tokens
        const tokens = await tokenService.generateTokenPair(
            user.id,
            user.email,
            user.role
        );

        logger.info(`User logged in: ${normalizedEmail}`);

        return {
            user,
            tokens,
        };
    }

    /**
     * Get current user with profile
     */
    async getCurrentUser(userId: string): Promise<User | null> {
        const user = await User.findByPk(userId, {
            include: [
                { association: 'doctorProfile' },
                { association: 'hospitalProfile' },
            ],
        });

        return user;
    }

    /**
     * Forgot password - send reset OTP
     */
    async forgotPassword(email: string): Promise<{ message: string }> {
        const normalizedEmail = email.toLowerCase().trim();

        // Find user
        const user = await User.findOne({
            where: { email: normalizedEmail },
        });

        // Always return success message (security)
        const message = 'If an account exists with this email, a password reset code has been sent.';

        if (!user) {
            return { message };
        }

        // Generate and send OTP
        const otp = await otpService.createOtp(normalizedEmail, OtpType.PASSWORD_RESET);
        await emailService.sendPasswordResetOtp(normalizedEmail, otp, user.fullName);

        logger.debug(`Password reset OTP sent to ${normalizedEmail}`);

        return { message };
    }

    /**
     * Reset password with OTP
     */
    async resetPassword(
        email: string,
        otp: string,
        newPassword: string
    ): Promise<{ message: string }> {
        const normalizedEmail = email.toLowerCase().trim();

        // Find user
        const user = await User.findOne({
            where: { email: normalizedEmail },
        });

        if (!user) {
            throw new Error('User not found');
        }

        // Verify OTP
        const result = await otpService.verifyOtp(
            normalizedEmail,
            otp,
            OtpType.PASSWORD_RESET
        );

        if (!result.success) {
            throw new Error(result.message);
        }

        // Update password (hashing handled by model hook)
        user.password = newPassword;
        user.passwordChangedAt = new Date();
        await user.save();

        // Invalidate all existing sessions
        await tokenService.invalidateAllUserTokens(user.id);

        logger.info(`Password reset for user: ${normalizedEmail}`);

        return { message: 'Password reset successfully. Please login with your new password.' };
    }

    /**
     * Change password (authenticated)
     */
    async changePassword(
        userId: string,
        currentPassword: string,
        newPassword: string
    ): Promise<{ message: string }> {
        // Find user
        const user = await User.findByPk(userId);

        if (!user) {
            throw new Error('User not found');
        }

        // Verify current password
        const isPasswordValid = await user.comparePassword(currentPassword);
        if (!isPasswordValid) {
            throw new Error('Current password is incorrect');
        }

        // Check if new password is same as current
        const isSamePassword = await user.comparePassword(newPassword);
        if (isSamePassword) {
            throw new Error('New password must be different from the current password');
        }

        // Update password (hashing handled by model hook)
        user.password = newPassword;
        user.passwordChangedAt = new Date();
        await user.save();

        logger.info(`Password changed for user: ${user.email}`);

        return { message: 'Password changed successfully' };
    }

    /**
     * Refresh access token
     */
    async refreshToken(refreshToken: string): Promise<TokenPair | null> {
        return tokenService.refreshTokens(refreshToken);
    }

    /**
     * Logout - invalidate current session
     */
    async logout(tokenId: string): Promise<void> {
        await tokenService.invalidateToken(tokenId);
        logger.debug(`User logged out, token: ${tokenId}`);
    }

    /**
     * Logout from all devices
     */
    async logoutAll(userId: string): Promise<{ sessionsInvalidated: number }> {
        const count = await tokenService.invalidateAllUserTokens(userId);
        // Invalidate cached user so auth middleware re-fetches on next request
        await cacheService.delete(CACHE_KEYS.AUTH_USER(userId));
        logger.info(`User ${userId} logged out from all devices (${count} sessions)`);
        return { sessionsInvalidated: count };
    }

    /**
     * Verify user exists and return basic info
     */
    async verifyUserExists(email: string): Promise<{
        exists: boolean;
        isEmailVerified?: boolean;
        hasRole?: boolean;
    }> {
        const normalizedEmail = email.toLowerCase().trim();

        const user = await User.findOne({
            where: { email: normalizedEmail },
            attributes: ['id', 'isEmailVerified', 'role'],
        });

        if (!user) {
            return { exists: false };
        }

        return {
            exists: true,
            isEmailVerified: user.isEmailVerified,
            hasRole: user.role !== UserRole.PENDING,
        };
    }

    /**
     * Hash password (utility method)
     */
    async hashPassword(password: string): Promise<string> {
        const salt = await bcrypt.genSalt(12);
        return bcrypt.hash(password, salt);
    }

    /**
     * Compare password (utility method)
     */
    async comparePassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;
