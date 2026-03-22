// src/routes/recommendation.routes.ts
import { Router } from 'express';
import { recommendationController } from '../controllers/recommendation.controller';
import { authenticate } from '../middleware/authenticate';
import { doctorOnly, hospitalOnly, adminOnly } from '../middleware/authorize';

const router = Router();

// ─── Doctor recommendation routes ─────────────────────────────────────────────

/** @route GET /api/v1/recommendations/jobs — Personalized job feed (Doctor) */
router.get('/jobs', authenticate, doctorOnly, recommendationController.getRecommendedJobs);

/** @route GET /api/v1/recommendations/quick — Top-5 quick matches (Doctor) */
router.get('/quick', authenticate, doctorOnly, recommendationController.getQuickRecommendations);

/** @route GET /api/v1/recommendations/match-score/:jobId — Match score for one job (Doctor) */
router.get('/match-score/:jobId', authenticate, doctorOnly, recommendationController.getMatchScore);

// ─── Hospital recommendation routes ───────────────────────────────────────────

/** @route GET /api/v1/recommendations/candidates/:jobId — Recommended candidates for a job (Hospital) */
router.get('/candidates/:jobId', authenticate, hospitalOnly, recommendationController.getRecommendedCandidates);

// ─── Admin / debug routes ──────────────────────────────────────────────────────

/** @route GET /api/v1/recommendations/weights — Current matching weights (Admin only) */
router.get('/weights', authenticate, adminOnly, recommendationController.getWeights);

export default router;
