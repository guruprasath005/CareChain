// src/services/otp.service.ts
// OTP Generation and Verification Service

import crypto from 'crypto';
import { config } from '../config';
import { redis, REDIS_KEYS } from '../config/redis';
import { logger } from '../utils/logger';
import { OtpType } from '../models/types';

export interface OtpData {
    otp: string;
    email: string;
    type: OtpType;
    createdAt: string;
    attempts: number;
}

export interface OtpVerificationResult {
    success: boolean;
    message: string;
    remainingAttempts?: number;
}

/**
 * OTP Service
 * Handles OTP generation, storage, and verification
 */
class OtpService {
    private expiryMinutes: number;
    private maxAttempts: number;
    private resendCooldownSeconds: number;

    // In-memory fallback
    private memoryStore: Map<string, { data: string, expiresAt: number }> = new Map();

    constructor() {
        this.expiryMinutes = config.otp.expiryMinutes;
        this.maxAttempts = config.otp.maxAttempts;
        this.resendCooldownSeconds = config.otp.resendCooldownSeconds;

        // Clean up expired memory items periodically
        setInterval(() => {
            const now = Date.now();
            for (const [key, value] of this.memoryStore.entries()) {
                if (value.expiresAt < now) {
                    this.memoryStore.delete(key);
                }
            }
        }, 60000); // Check every minute
    }

    /**
     * Check if Redis is available
     */
    private async isRedisAvailable(): Promise<boolean> {
        try {
            await redis.ping();
            return redis.status === 'ready';
        } catch {
            return false;
        }
    }

    /**
     * Get value from storage (Redis or memory)
     */
    private async getFromStorage(key: string): Promise<string | null> {
        if (await this.isRedisAvailable()) {
            return await redis.get(key);
        } else {
            const item = this.memoryStore.get(key);
            if (item && item.expiresAt > Date.now()) {
                return item.data;
            } else if (item) {
                this.memoryStore.delete(key);
            }
            return null;
        }
    }

    /**
     * Set value in storage (Redis or memory)
     */
    private async setInStorage(key: string, value: string, ttlSeconds: number): Promise<void> {
        if (await this.isRedisAvailable()) {
            await redis.setex(key, ttlSeconds, value);
        } else {
            this.memoryStore.set(key, {
                data: value,
                expiresAt: Date.now() + (ttlSeconds * 1000)
            });
        }
    }

    /**
     * Delete from storage (Redis or memory)
     */
    private async deleteFromStorage(key: string): Promise<void> {
        if (await this.isRedisAvailable()) {
            await redis.del(key);
        } else {
            this.memoryStore.delete(key);
        }
    }

    /**
     * Check if key exists in storage
     */
    private async existsInStorage(key: string): Promise<boolean> {
        if (await this.isRedisAvailable()) {
            const exists = await redis.exists(key);
            return exists === 1;
        } else {
            const item = this.memoryStore.get(key);
            return !!(item && item.expiresAt > Date.now());
        }
    }

    /**
     * Get TTL for key in storage
     */
    private async getTtlFromStorage(key: string): Promise<number> {
        if (await this.isRedisAvailable()) {
            const ttl = await redis.ttl(key);
            return ttl > 0 ? ttl : 0;
        } else {
            const item = this.memoryStore.get(key);
            if (item && item.expiresAt > Date.now()) {
                return Math.ceil((item.expiresAt - Date.now()) / 1000);
            }
            return 0;
        }
    }

    /**
     * Generate a 6-digit OTP
     */
    generateOtp(): string {
        // Generate cryptographically secure random number
        const randomBytes = crypto.randomBytes(3);
        const number = randomBytes.readUIntBE(0, 3) % 1000000;
        return number.toString().padStart(6, '0');
    }

    /**
     * Create and store OTP for email verification or password reset
     */
    async createOtp(email: string, type: OtpType): Promise<string> {
        const normalizedEmail = email.toLowerCase().trim();

        // Check cooldown
        const canResend = await this.canResendOtp(normalizedEmail, type);
        if (!canResend.allowed) {
            throw new Error(`Please wait ${canResend.remainingSeconds} seconds before requesting a new OTP`);
        }

        const otp = this.generateOtp();

        const otpData: OtpData = {
            otp,
            email: normalizedEmail,
            type,
            createdAt: new Date().toISOString(),
            attempts: 0,
        };

        // Store OTP in storage with expiry
        const otpKey = REDIS_KEYS.OTP(normalizedEmail, type);
        const expirySeconds = this.expiryMinutes * 60;
        
        logger.debug(`Creating OTP for ${normalizedEmail}, key: ${otpKey}, OTP: ${otp}, expiry: ${expirySeconds}s`);
        
        await this.setInStorage(otpKey, JSON.stringify(otpData), expirySeconds);

        // Set cooldown for resend
        const cooldownKey = REDIS_KEYS.OTP_COOLDOWN(normalizedEmail, type);
        await this.setInStorage(cooldownKey, '1', this.resendCooldownSeconds);

        logger.debug(`OTP created for ${normalizedEmail} (type: ${type})`);

        return otp;
    }

    /**
     * Verify OTP
     */
    async verifyOtp(
        email: string,
        otp: string,
        type: OtpType
    ): Promise<OtpVerificationResult> {
        const normalizedEmail = email.toLowerCase().trim();
        const otpKey = REDIS_KEYS.OTP(normalizedEmail, type);

        logger.debug(`Verifying OTP for ${normalizedEmail}, key: ${otpKey}, provided OTP: ${otp}`);

        // Get stored OTP data
        const storedData = await this.getFromStorage(otpKey);

        logger.debug(`Stored data for ${otpKey}: ${storedData ? 'found' : 'not found'}`);

        if (!storedData) {
            // Check if we're using Redis or memory
            const isRedisAvailable = await this.isRedisAvailable();
            logger.debug(`Redis available: ${isRedisAvailable}`);
            
            if (isRedisAvailable) {
                // Check if key exists in Redis
                const exists = await redis.exists(otpKey);
                logger.debug(`Key exists in Redis: ${exists}`);
            } else {
                // Check memory store
                logger.debug(`Memory store keys: ${Array.from(this.memoryStore.keys()).join(', ')}`);
            }

            return {
                success: false,
                message: 'OTP has expired or does not exist. Please request a new one.',
            };
        }

        const otpData: OtpData = JSON.parse(storedData);

        // Check max attempts
        if (otpData.attempts >= this.maxAttempts) {
            // Delete OTP after max attempts
            await this.deleteFromStorage(otpKey);
            return {
                success: false,
                message: 'Maximum verification attempts exceeded. Please request a new OTP.',
                remainingAttempts: 0,
            };
        }

        // Verify OTP
        if (otpData.otp !== otp) {
            // Increment attempts
            otpData.attempts += 1;
            const remainingAttempts = this.maxAttempts - otpData.attempts;

            // Get TTL and update with remaining time
            const ttl = await this.getTtlFromStorage(otpKey);
            if (ttl > 0) {
                await this.setInStorage(otpKey, JSON.stringify(otpData), ttl);
            }

            return {
                success: false,
                message: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`,
                remainingAttempts,
            };
        }

        // OTP is valid - delete it
        await this.deleteFromStorage(otpKey);

        logger.debug(`OTP verified for ${normalizedEmail} (type: ${type})`);

        return {
            success: true,
            message: 'OTP verified successfully.',
        };
    }

    async canResendOtp(
        email: string,
        type: OtpType
    ): Promise<{ allowed: boolean; remainingSeconds: number }> {
        const normalizedEmail = email.toLowerCase().trim();
        const cooldownKey = REDIS_KEYS.OTP_COOLDOWN(normalizedEmail, type);

        const ttl = await this.getTtlFromStorage(cooldownKey);
        if (ttl > 0) {
            return {
                allowed: false,
                remainingSeconds: ttl,
            };
        }

        return {
            allowed: true,
            remainingSeconds: 0,
        };
    }

    /**
     * Delete OTP (for cleanup or manual invalidation)
     */
    async deleteOtp(email: string, type: OtpType): Promise<void> {
        const normalizedEmail = email.toLowerCase().trim();
        const otpKey = REDIS_KEYS.OTP(normalizedEmail, type);
        await this.deleteFromStorage(otpKey);
        logger.debug(`OTP deleted for ${normalizedEmail} (type: ${type})`);
    }

    /**
     * Check if OTP exists for email
     */
    async hasActiveOtp(email: string, type: OtpType): Promise<boolean> {
        const normalizedEmail = email.toLowerCase().trim();
        const otpKey = REDIS_KEYS.OTP(normalizedEmail, type);
        return await this.existsInStorage(otpKey);
    }

    /**
     * Get OTP expiry time remaining in seconds
     */
    async getOtpTtl(email: string, type: OtpType): Promise<number> {
        const normalizedEmail = email.toLowerCase().trim();
        const otpKey = REDIS_KEYS.OTP(normalizedEmail, type);
        return await this.getTtlFromStorage(otpKey);
    }

    /**
     * Get remaining attempts for an OTP
     */
    async getRemainingAttempts(email: string, type: OtpType): Promise<number> {
        const normalizedEmail = email.toLowerCase().trim();
        const otpKey = REDIS_KEYS.OTP(normalizedEmail, type);

        const storedData = await this.getFromStorage(otpKey);
        if (!storedData) {
            return 0;
        }

        const otpData: OtpData = JSON.parse(storedData);
        return Math.max(0, this.maxAttempts - otpData.attempts);
    }
}

// Export singleton instance
export const otpService = new OtpService();
export default otpService;
