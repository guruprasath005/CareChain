// src/routes/leave.routes.ts
import { Router } from 'express';
import { leaveController } from '../controllers/leave.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createLeaveRequestSchema } from '../validators/doctor.validator';

const router = Router();

router.use(authenticate);
router.use(authorize('doctor'));

/** @route POST /api/v1/leave/request — Submit a leave request */
router.post('/request', validate(createLeaveRequestSchema), leaveController.createLeaveRequest);

/** @route GET /api/v1/leave/my-requests — Paginated list of own requests */
router.get('/my-requests', leaveController.getMyRequests);

/** @route GET /api/v1/leave/balance/:assignmentId — Leave balance */
router.get('/balance/:assignmentId', leaveController.getLeaveBalance);

/** @route DELETE /api/v1/leave/request/:id — Cancel a pending request */
router.delete('/request/:id', leaveController.cancelLeaveRequest);

export default router;
