// src/routes/admin.routes.ts
import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticate } from '../middleware/authenticate';
import { adminOnly } from '../middleware/authorize';

const router = Router();

router.use(authenticate);
router.use(adminOnly);

// ─── Platform stats ────────────────────────────────────────────────────────────
router.get('/stats', adminController.getPlatformStats);

// ─── User management ──────────────────────────────────────────────────────────
router.get('/users', adminController.listUsers);
router.patch('/users/:userId/toggle-active', adminController.toggleUserActive);

// ─── Doctor verification ──────────────────────────────────────────────────────
router.get('/doctors/pending', adminController.getPendingDoctors);
router.get('/doctors/:id/review', adminController.getDoctorForReview);
router.post('/doctors/:id/verify', adminController.verifyDoctor);

// ─── Hospital verification ─────────────────────────────────────────────────────
router.get('/hospitals/pending', adminController.getPendingHospitals);
router.get('/hospitals/:id/review', adminController.getHospitalForReview);
router.post('/hospitals/:id/verify', adminController.verifyHospital);

// ─── Quality score tools ───────────────────────────────────────────────────────
router.post('/scores/recalculate', adminController.recalculateScore);

// ─── Job-post credit management ────────────────────────────────────────────────
router.post('/credits/adjust', adminController.adjustCredits);

export default router;
