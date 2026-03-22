// src/routes/job.routes.ts
import { Router } from 'express';
import { jobController } from '../controllers/job.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate, validateAll } from '../middleware/validate';
import { applyToJobSchema } from '../validators/doctor.validator';
import { searchJobsQuerySchema } from '../validators/job.validator';

const router = Router();

// ─── Public routes ─────────────────────────────────────────────────────────────

router.get('/', validate(searchJobsQuerySchema, 'query'), jobController.searchJobs);
router.get('/filters', jobController.getFilters);
router.get('/featured', jobController.getFeaturedJobs);
router.get('/recent', jobController.getRecentJobs);
router.get('/:id', jobController.getJobDetails);
router.get('/:id/similar', jobController.getSimilarJobs);

// ─── Doctor actions ────────────────────────────────────────────────────────────

router.post(
  '/:id/apply',
  authenticate,
  authorize('doctor'),
  validate(applyToJobSchema),
  jobController.applyToJob
);

router.delete(
  '/:id/application',
  authenticate,
  authorize('doctor'),
  jobController.withdrawApplication
);

export default router;
