// src/controllers/payment.controller.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { ApiResponse } from '../utils/response';
import { paymentService } from '../services/payment.service';
import { AppError } from '../middleware';

export const paymentController = {
  /**
   * GET /payment/packs
   * List available credit packs.
   */
  async listPacks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const packs = paymentService.getPacks();
      ApiResponse.success(res, { packs }, 'Credit packs retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /payment/order
   * Create a Razorpay order for purchasing job-post credits.
   * Body: { packId }
   */
  async createOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = req.user!.id;
      const { packId } = req.body;

      if (!packId) throw new AppError('packId is required', 400);

      const order = await paymentService.createOrder(hospitalId, packId);
      ApiResponse.created(res, order, 'Order created');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /payment/verify
   * Verify a completed Razorpay payment and credit the hospital's quota.
   * Body: { razorpayOrderId, razorpayPaymentId, razorpaySignature, packId }
   */
  async verifyPayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = req.user!.id;
      const { razorpayOrderId, razorpayPaymentId, razorpaySignature, packId } = req.body;

      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !packId) {
        throw new AppError('razorpayOrderId, razorpayPaymentId, razorpaySignature, and packId are required', 400);
      }

      const result = await paymentService.verifyPayment({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        hospitalId,
        packId,
      });

      ApiResponse.success(res, result, 'Payment verified — credits added to your account');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /payment/quota
   * Get the hospital's current job-posting credit balance.
   */
  async getQuota(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = req.user!.id;
      const quota = await paymentService.getQuota(hospitalId);
      ApiResponse.success(res, { quota }, 'Credit balance retrieved');
    } catch (error) {
      next(error);
    }
  },
};

export default paymentController;
