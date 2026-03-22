// src/routes/attendance.routes.ts
import { Router } from 'express';
import { attendanceController } from '../controllers/attendance.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { checkInSchema, checkOutSchema } from '../validators/doctor.validator';

const router = Router();

router.use(authenticate);
router.use(authorize('doctor'));

router.post('/check-in', validate(checkInSchema), attendanceController.checkIn);
router.post('/check-out', validate(checkOutSchema), attendanceController.checkOut);
router.get('/status/:assignmentId', attendanceController.getTodayStatus);
router.get('/history/:assignmentId', attendanceController.getHistory);

export default router;
