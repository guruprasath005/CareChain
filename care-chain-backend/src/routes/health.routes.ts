// src/routes/health.routes.ts
import { Router } from 'express';
import { healthController } from '../controllers/health.controller';
import { authenticate } from '../middleware/authenticate';
import { adminOnly } from '../middleware/authorize';

const router = Router();

/** @route GET /api/v1/health — Basic liveness (public, used by load balancers) */
router.get('/', healthController.check);

/** @route GET /api/v1/health/ready — Dependency readiness (public) */
router.get('/ready', healthController.ready);

/** @route GET /api/v1/health/live — Kubernetes liveness probe (public) */
router.get('/live', healthController.live);

/** @route GET /api/v1/health/detailed — Full system metrics (admin only) */
router.get('/detailed', authenticate, adminOnly, healthController.detailed);

/** @route GET /api/v1/health/metrics — Prometheus-style metrics (admin only) */
router.get('/metrics', authenticate, adminOnly, healthController.metrics);

export default router;
