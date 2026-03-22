// src/controllers/admin.controller.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { ApiResponse } from '../utils/response';
import { adminService } from '../services/admin.service';
import { AppError } from '../middleware';

export const adminController = {
  // ─── Platform overview ──────────────────────────────────────────────────────

  async getPlatformStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await adminService.getPlatformStats();
      ApiResponse.success(res, stats, 'Platform statistics retrieved');
    } catch (error) { next(error); }
  },

  // ─── Users ──────────────────────────────────────────────────────────────────

  async listUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = '1', limit = '20', role, search } = req.query;
      const result = await adminService.listUsers(
        Number(page), Number(limit),
        role as string | undefined,
        search as string | undefined
      );
      ApiResponse.paginated(res, result.data, result.meta.page, result.meta.limit, result.meta.totalItems, 'Users retrieved');
    } catch (error) { next(error); }
  },

  async toggleUserActive(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.id;
      const { userId } = req.params;
      const user = await adminService.toggleUserActive(userId, adminId);
      ApiResponse.success(res, { id: user.id, isActive: user.isActive }, `User ${user.isActive ? 'activated' : 'deactivated'}`);
    } catch (error) { next(error); }
  },

  // ─── Doctor verification ────────────────────────────────────────────────────

  async getPendingDoctors(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = '1', limit = '20' } = req.query;
      const result = await adminService.getPendingDoctors(Number(page), Number(limit));
      ApiResponse.paginated(res, result.data, result.meta.page, result.meta.limit, result.meta.totalItems, 'Pending doctors retrieved');
    } catch (error) { next(error); }
  },

  async getDoctorForReview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const doctor = await adminService.getDoctorForReview(req.params.id);
      ApiResponse.success(res, doctor, 'Doctor profile retrieved');
    } catch (error) { next(error); }
  },

  async verifyDoctor(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.id;
      const { id } = req.params;
      const { action, notes } = req.body;

      if (!['verify', 'reject'].includes(action)) {
        throw new AppError('action must be "verify" or "reject"', 400);
      }

      const doctor = await adminService.verifyDoctor(id, adminId, action, notes);
      ApiResponse.success(res, doctor, `Doctor ${action}d`);
    } catch (error) { next(error); }
  },

  // ─── Hospital verification ──────────────────────────────────────────────────

  async getPendingHospitals(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = '1', limit = '20' } = req.query;
      const result = await adminService.getPendingHospitals(Number(page), Number(limit));
      ApiResponse.paginated(res, result.data, result.meta.page, result.meta.limit, result.meta.totalItems, 'Pending hospitals retrieved');
    } catch (error) { next(error); }
  },

  async getHospitalForReview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospital = await adminService.getHospitalForReview(req.params.id);
      ApiResponse.success(res, hospital, 'Hospital profile retrieved');
    } catch (error) { next(error); }
  },

  async verifyHospital(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.id;
      const { id } = req.params;
      const { action, notes } = req.body;

      if (!['verify', 'reject', 'in_review'].includes(action)) {
        throw new AppError('action must be "verify", "reject", or "in_review"', 400);
      }

      const hospital = await adminService.verifyHospital(id, adminId, action, notes);
      ApiResponse.success(res, hospital, `Hospital ${action}d`);
    } catch (error) { next(error); }
  },

  // ─── Quality scores ─────────────────────────────────────────────────────────

  async recalculateScore(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, role } = req.body;
      if (!userId || !['doctor', 'hospital'].includes(role)) {
        throw new AppError('userId and role ("doctor"|"hospital") are required', 400);
      }
      const score = await adminService.recalculateUserScore(userId, role);
      ApiResponse.success(res, { userId, role, score }, 'Quality score recalculated');
    } catch (error) { next(error); }
  },

  // ─── Credit management ──────────────────────────────────────────────────────

  async adjustCredits(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.id;
      const { hospitalId, delta, reason } = req.body;

      if (!hospitalId || typeof delta !== 'number') {
        throw new AppError('hospitalId and numeric delta are required', 400);
      }

      const newQuota = await adminService.adjustJobCredits(hospitalId, adminId, delta, reason ?? 'admin adjustment');
      ApiResponse.success(res, { hospitalId, newQuota }, 'Credits adjusted');
    } catch (error) { next(error); }
  },
};

export default adminController;
