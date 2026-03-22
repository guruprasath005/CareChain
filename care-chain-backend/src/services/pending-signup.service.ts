// src/services/pending-signup.service.ts
// Temporarily stores pending signups before email OTP verification.
// Uses Redis with a 24-hour TTL so data is shared across all cluster nodes.
// Falls back to an in-memory Map if Redis is unavailable (single-instance only).

import { redis } from '../config/redis';
import { logger } from '../utils/logger';

interface PendingSignup {
  fullName: string;
  email: string;
  hashedPassword: string;
  createdAt: string; // ISO string — safe to serialise through JSON/Redis
}

const REDIS_KEY = (email: string) => `pending_signup:${email.toLowerCase().trim()}`;
const TTL_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Pending Signup Service
 *
 * Stores signup data temporarily until email OTP is verified.
 * Backed by Redis so multiple server instances share state consistently.
 * Degrades gracefully to in-memory when Redis is unreachable.
 */
class PendingSignupService {
  // In-memory fallback — only used when Redis is unavailable
  private fallback: Map<string, PendingSignup & { expiresAt: number }> = new Map();

  private get isRedisReady(): boolean {
    return redis.status === 'ready';
  }

  /**
   * Store a pending signup.
   */
  async storePendingSignup(
    email: string,
    fullName: string,
    hashedPassword: string
  ): Promise<void> {
    const normalised = email.toLowerCase().trim();
    const data: PendingSignup = {
      fullName,
      email: normalised,
      hashedPassword,
      createdAt: new Date().toISOString(),
    };

    if (this.isRedisReady) {
      try {
        await redis.setex(REDIS_KEY(normalised), TTL_SECONDS, JSON.stringify(data));
        logger.debug(`Stored pending signup in Redis for: ${normalised}`);
        return;
      } catch (err) {
        logger.warn(`Redis write failed for pending signup (${normalised}), using memory fallback:`, err);
      }
    }

    // Memory fallback
    this.fallback.set(normalised, {
      ...data,
      expiresAt: Date.now() + TTL_SECONDS * 1000,
    });
    logger.debug(`Stored pending signup in memory for: ${normalised}`);
  }

  /**
   * Retrieve a pending signup by email. Returns null if not found or expired.
   */
  async getPendingSignup(email: string): Promise<PendingSignup | null> {
    const normalised = email.toLowerCase().trim();

    if (this.isRedisReady) {
      try {
        const raw = await redis.get(REDIS_KEY(normalised));
        if (!raw) return null;
        return JSON.parse(raw) as PendingSignup;
      } catch (err) {
        logger.warn(`Redis read failed for pending signup (${normalised}), falling back to memory:`, err);
      }
    }

    // Memory fallback
    const entry = this.fallback.get(normalised);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.fallback.delete(normalised);
      return null;
    }

    const { expiresAt: _expiresAt, ...data } = entry;
    return data;
  }

  /**
   * Delete a pending signup after successful verification.
   */
  async deletePendingSignup(email: string): Promise<void> {
    const normalised = email.toLowerCase().trim();

    if (this.isRedisReady) {
      try {
        await redis.del(REDIS_KEY(normalised));
        logger.debug(`Deleted pending signup from Redis for: ${normalised}`);
        return;
      } catch (err) {
        logger.warn(`Redis delete failed for pending signup (${normalised}):`, err);
      }
    }

    this.fallback.delete(normalised);
    logger.debug(`Deleted pending signup from memory for: ${normalised}`);
  }

  /**
   * Check if a pending signup exists for the given email.
   */
  async hasPendingSignup(email: string): Promise<boolean> {
    const data = await this.getPendingSignup(email);
    return data !== null;
  }
}

export const pendingSignupService = new PendingSignupService();
export default pendingSignupService;
