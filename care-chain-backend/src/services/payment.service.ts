// src/services/payment.service.ts
// Razorpay integration for hospital job-posting credits.
//
// Flow:
//   1. Hospital calls createOrder() to initiate a credit purchase.
//   2. Mobile app completes Razorpay checkout and sends back
//      { razorpay_order_id, razorpay_payment_id, razorpay_signature }.
//   3. Backend calls verifyPayment() — validates the signature, then credits
//      the hospital's jobPostQuota by the purchased pack size.

import Razorpay from 'razorpay';
import crypto from 'crypto';
import { Hospital } from '../models/Hospital.model';
import { AppError } from '../middleware';
import { logger } from '../utils/logger';
import { config } from '../config';

// ─── Credit packs ──────────────────────────────────────────────────────────────

export interface CreditPack {
  id: string;
  name: string;
  credits: number;     // number of job posts
  priceINR: number;    // amount in paise (100 paise = ₹1)
  description: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: 'starter', name: 'Starter', credits: 5,  priceINR: 49900,  description: '5 job posts' },
  { id: 'growth',  name: 'Growth',  credits: 15, priceINR: 129900, description: '15 job posts — best value' },
  { id: 'pro',     name: 'Pro',     credits: 50, priceINR: 349900, description: '50 job posts' },
];

export interface CreateOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  pack: CreditPack;
  keyId: string;
}

export interface VerifyPaymentData {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  hospitalId: string;
  packId: string;
}

// ─── Service ───────────────────────────────────────────────────────────────────

class PaymentService {
  private razorpay: Razorpay | null = null;

  private get client(): Razorpay {
    if (!this.razorpay) {
      const keyId = config.payment?.razorpayKeyId;
      const keySecret = config.payment?.razorpayKeySecret;

      if (!keyId || !keySecret) {
        throw new AppError('Payment gateway not configured. Please contact support.', 503);
      }

      this.razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    }
    return this.razorpay;
  }

  /**
   * Create a Razorpay order for purchasing job-post credits.
   */
  async createOrder(hospitalId: string, packId: string): Promise<CreateOrderResult> {
    const pack = CREDIT_PACKS.find((p) => p.id === packId);
    if (!pack) throw new AppError(`Unknown credit pack "${packId}"`, 400);

    const hospital = await Hospital.findOne({ where: { userId: hospitalId } });
    if (!hospital) throw new AppError('Hospital profile not found', 404);

    const order = await this.client.orders.create({
      amount: pack.priceINR,
      currency: 'INR',
      receipt: `hp_${hospitalId.slice(0, 8)}_${Date.now()}`,
      notes: { hospitalId, packId, credits: String(pack.credits) },
    });

    logger.info(`Razorpay order created: ${order.id} for hospital ${hospitalId}`);

    return {
      orderId: order.id,
      amount: pack.priceINR,
      currency: 'INR',
      pack,
      keyId: config.payment?.razorpayKeyId ?? '',
    };
  }

  /**
   * Verify a completed Razorpay payment and credit the hospital's quota.
   */
  async verifyPayment(data: VerifyPaymentData): Promise<{ success: boolean; newQuota: number }> {
    // 1. Validate signature
    const secret = config.payment?.razorpayKeySecret ?? '';
    const body = `${data.razorpayOrderId}|${data.razorpayPaymentId}`;
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    if (expectedSig !== data.razorpaySignature) {
      logger.warn(`Payment signature mismatch for order ${data.razorpayOrderId}`);
      throw new AppError('Invalid payment signature', 400);
    }

    // 2. Find credit pack
    const pack = CREDIT_PACKS.find((p) => p.id === data.packId);
    if (!pack) throw new AppError('Unknown credit pack', 400);

    // 3. Credit the hospital
    const hospital = await Hospital.findOne({ where: { userId: data.hospitalId } });
    if (!hospital) throw new AppError('Hospital not found', 404);

    const currentQuota = (hospital as any).jobPostQuota ?? 0;
    const newQuota = currentQuota + pack.credits;
    await (hospital as any).update({ jobPostQuota: newQuota });

    logger.info(
      `Payment verified: hospital ${data.hospitalId} credited ${pack.credits} posts (new quota: ${newQuota})`
    );

    return { success: true, newQuota };
  }

  /**
   * Consume one job-post credit. Returns false if quota is exhausted.
   */
  async consumeJobCredit(hospitalId: string): Promise<boolean> {
    const hospital = await Hospital.findOne({ where: { userId: hospitalId } });
    if (!hospital) return false;

    const quota = (hospital as any).jobPostQuota ?? 0;
    if (quota <= 0) return false;

    await (hospital as any).update({ jobPostQuota: quota - 1 });
    logger.debug(`Job credit consumed for hospital ${hospitalId}: remaining ${quota - 1}`);
    return true;
  }

  /**
   * Get the current job-posting quota for a hospital.
   */
  async getQuota(hospitalId: string): Promise<number> {
    const hospital = await Hospital.findOne({
      where: { userId: hospitalId },
      attributes: ['jobPostQuota'] as any,
    });
    return (hospital as any)?.jobPostQuota ?? 0;
  }

  /**
   * List available credit packs.
   */
  getPacks(): CreditPack[] {
    return CREDIT_PACKS;
  }
}

export const paymentService = new PaymentService();
export default paymentService;
