// src/services/token.service.ts
// JWT Token Management Service

import jwt, { JwtPayload as JwtLibPayload } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { redis, REDIS_KEYS } from '../config/redis';
import { logger } from '../utils/logger';
import { UserRole } from '../models/types';

export interface TokenPayload {
    userId: string;
    email: string;
    role: UserRole;
    tokenId: string;
}

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    tokenId: string;
    expiresIn: number;
}

export interface DecodedToken extends TokenPayload {
    iat: number;
    exp: number;
}

/**
 * Token Service
 * Handles JWT token generation, verification, and management
 */
class TokenService {
    private accessSecret: string;
    private refreshSecret: string;
    private accessExpiresIn: string;
    private refreshExpiresIn: string;
    // In-memory fallback
    private memoryStore: Map<string, { data: string, expiresAt: number }> = new Map();
    private userSessions: Map<string, Set<string>> = new Map();

    constructor() {
        this.accessSecret = config.jwt.accessSecret;
        this.refreshSecret = config.jwt.refreshSecret;
        this.accessExpiresIn = config.jwt.accessExpiresIn;
        this.refreshExpiresIn = config.jwt.refreshExpiresIn;

        // Clean up expired tokens
        setInterval(() => {
            const now = Date.now();
            for (const [key, value] of this.memoryStore.entries()) {
                if (value.expiresAt < now) {
                    this.memoryStore.delete(key);
                }
            }
        }, 60000 * 5);
    }

    /**
     * Generate access and refresh token pair
     */
    async generateTokenPair(
        userId: string,
        email: string,
        role: UserRole
    ): Promise<TokenPair> {
        const tokenId = uuidv4();

        const payload: TokenPayload = {
            userId,
            email,
            role,
            tokenId,
        };

        // Generate access token (short-lived)
        const accessToken = this.generateAccessToken(payload);

        // Generate refresh token (long-lived)
        const refreshToken = this.generateRefreshToken(payload);

        // Store refresh token in Redis for validation and invalidation
        await this.storeRefreshToken(userId, tokenId, refreshToken);

        // Calculate expiry in seconds for client
        const expiresIn = this.parseExpiry(this.accessExpiresIn);

        logger.debug(`Token pair generated for user: ${userId}`);

        return {
            accessToken,
            refreshToken,
            tokenId,
            expiresIn,
        };
    }

    /**
     * Generate access token
     */
    private generateAccessToken(payload: TokenPayload): string {
        const expirySeconds = this.parseExpiry(this.accessExpiresIn);

        return jwt.sign(payload as object, this.accessSecret, {
            expiresIn: expirySeconds,
            algorithm: 'HS256',
        });
    }

    /**
     * Generate refresh token
     */
    private generateRefreshToken(payload: TokenPayload): string {
        const expirySeconds = this.parseExpiry(this.refreshExpiresIn);

        return jwt.sign(payload as object, this.refreshSecret, {
            expiresIn: expirySeconds,
            algorithm: 'HS256',
        });
    }

    /**
     * Verify access token
     */
    verifyAccessToken(token: string): DecodedToken | null {
        try {
            const decoded = jwt.verify(token, this.accessSecret) as DecodedToken;
            return decoded;
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                logger.debug('Access token expired');
            } else if (error instanceof jwt.JsonWebTokenError) {
                logger.debug('Invalid access token');
            }
            return null;
        }
    }

    /**
     * Verify refresh token
     */
    verifyRefreshToken(token: string): DecodedToken | null {
        try {
            const decoded = jwt.verify(token, this.refreshSecret) as DecodedToken;
            return decoded;
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                logger.debug('Refresh token expired');
            } else if (error instanceof jwt.JsonWebTokenError) {
                logger.debug('Invalid refresh token');
            }
            return null;
        }
    }

    /**
     * Store refresh token in Redis
     */
    private async storeRefreshToken(
        userId: string,
        tokenId: string,
        refreshToken: string
    ): Promise<void> {
        const key = REDIS_KEYS.REFRESH_TOKEN(tokenId);
        const expirySeconds = this.parseExpiry(this.refreshExpiresIn);

        const tokenData = JSON.stringify({
            userId,
            refreshToken,
            createdAt: new Date().toISOString(),
        });

        try {
            await redis.setex(key, expirySeconds, tokenData);

            // Also add to user's session list for logout-all functionality
            const userSessionsKey = REDIS_KEYS.USER_SESSIONS(userId);
            await redis.sadd(userSessionsKey, tokenId);
            await redis.expire(userSessionsKey, expirySeconds);
        } catch (e) {
            // Memory fallback
            const now = Date.now();
            this.memoryStore.set(key, {
                data: tokenData,
                expiresAt: now + (expirySeconds * 1000)
            });

            if (!this.userSessions.has(userId)) {
                this.userSessions.set(userId, new Set());
            }
            this.userSessions.get(userId)?.add(tokenId);
        }
    }

    /**
     * Validate refresh token exists in Redis
     */
    async isRefreshTokenValid(tokenId: string): Promise<boolean> {
        const key = REDIS_KEYS.REFRESH_TOKEN(tokenId);

        try {
            const exists = await redis.exists(key);
            if (exists === 1) return true;
        } catch (e) {
            // Memory fallback
            const item = this.memoryStore.get(key);
            return !!(item && item.expiresAt > Date.now());
        }

        // Also check memory if redis didn't fail but returned 0 (in case we switched modes)
        const item = this.memoryStore.get(key);
        return !!(item && item.expiresAt > Date.now());
    }

    /**
     * Refresh tokens - generate new pair and invalidate old
     */
    async refreshTokens(refreshToken: string): Promise<TokenPair | null> {
        // Verify the refresh token
        const decoded = this.verifyRefreshToken(refreshToken);
        if (!decoded) {
            return null;
        }

        // Check if token is still valid in Redis
        const isValid = await this.isRefreshTokenValid(decoded.tokenId);
        if (!isValid) {
            logger.debug(`Refresh token ${decoded.tokenId} not found in Redis`);
            return null;
        }

        // Invalidate old token
        await this.invalidateToken(decoded.tokenId);

        // Generate new token pair
        return this.generateTokenPair(decoded.userId, decoded.email, decoded.role);
    }

    /**
     * Invalidate a specific token (logout)
     */
    async invalidateToken(tokenId: string): Promise<void> {
        const key = REDIS_KEYS.REFRESH_TOKEN(tokenId);
        let userId: string | null = null;

        // Redis attempt
        try {
            const tokenData = await redis.get(key);
            if (tokenData) {
                const parsed = JSON.parse(tokenData);
                userId = parsed.userId;
            }
            await redis.del(key);
            if (userId) {
                const userSessionsKey = REDIS_KEYS.USER_SESSIONS(userId);
                await redis.srem(userSessionsKey, tokenId);
            }
        } catch (e) {
            // Ignore redis errors
        }

        // Memory cleanup
        const memItem = this.memoryStore.get(key);
        if (memItem) {
            const parsed = JSON.parse(memItem.data);
            userId = parsed.userId;
            this.memoryStore.delete(key);
        }

        if (userId) {
            this.userSessions.get(userId)?.delete(tokenId);
        }

        logger.debug(`Token ${tokenId} invalidated`);
    }

    /**
     * Invalidate all tokens for a user (logout all devices)
     */
    async invalidateAllUserTokens(userId: string): Promise<number> {
        let count = 0;

        // Redis
        try {
            const userSessionsKey = REDIS_KEYS.USER_SESSIONS(userId);
            const tokenIds = await redis.smembers(userSessionsKey);
            if (tokenIds.length > 0) {
                const keys = tokenIds.map((id) => REDIS_KEYS.REFRESH_TOKEN(id));
                await redis.del(...keys);
                await redis.del(userSessionsKey);
                count += tokenIds.length;
            }
        } catch (e) {
            // ignore
        }

        // Memory
        const sessionSet = this.userSessions.get(userId);
        if (sessionSet) {
            for (const tokenId of sessionSet) {
                const key = REDIS_KEYS.REFRESH_TOKEN(tokenId);
                this.memoryStore.delete(key);
                count++;
            }
            this.userSessions.delete(userId);
        }

        logger.info(`Invalidated tokens for user ${userId}`);
        return count;
    }

    /**
     * Get all active sessions for a user
     */
    async getUserSessions(userId: string): Promise<string[]> {
        const sessions = new Set<string>();

        try {
            const userSessionsKey = REDIS_KEYS.USER_SESSIONS(userId);
            const redisSessions = await redis.smembers(userSessionsKey);
            redisSessions.forEach(s => sessions.add(s));
        } catch (e) {
            // ignore
        }

        const memSessions = this.userSessions.get(userId);
        if (memSessions) {
            memSessions.forEach(s => sessions.add(s));
        }

        return Array.from(sessions);
    }

    /**
     * Parse expiry string to seconds
     */
    private parseExpiry(expiry: string): number {
        const match = expiry.match(/^(\d+)([smhdw])$/);
        if (!match) {
            return 900; // Default 15 minutes
        }

        const value = parseInt(match[1], 10);
        const unit = match[2];

        switch (unit) {
            case 's':
                return value;
            case 'm':
                return value * 60;
            case 'h':
                return value * 3600;
            case 'd':
                return value * 86400;
            case 'w':
                return value * 604800;
            default:
                return 900;
        }
    }

    /**
     * Decode token without verification (for debugging)
     */
    decodeToken(token: string): JwtLibPayload | null {
        try {
            return jwt.decode(token) as JwtLibPayload;
        } catch {
            return null;
        }
    }
}

// Export singleton instance
export const tokenService = new TokenService();
export default tokenService;
