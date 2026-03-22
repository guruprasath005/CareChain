// src/routes/payment.routes.ts
import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { authenticate } from '../middleware/authenticate';
import { hospitalOnly } from '../middleware/authorize';

const router = Router();

/** @route GET /api/v1/payment/packs — List credit packs (public) */
router.get('/packs', paymentController.listPacks);

/** @route GET /api/v1/payment/quota — Get current credit balance (Hospital) */
router.get('/quota', authenticate, hospitalOnly, paymentController.getQuota);

/** @route POST /api/v1/payment/order — Create Razorpay order (Hospital) */
router.post('/order', authenticate, hospitalOnly, paymentController.createOrder);

/** @route POST /api/v1/payment/verify — Verify & credit payment (Hospital) */
router.post('/verify', authenticate, hospitalOnly, paymentController.verifyPayment);

export default router;
