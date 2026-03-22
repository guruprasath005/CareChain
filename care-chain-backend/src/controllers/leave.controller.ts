// src/controllers/leave.controller.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { ApiResponse } from '../utils/response';
import { leaveService } from '../services/leave.service';
import { LeaveStatus, LeaveType } from '../models/types';

export const leaveController = {
  // ─── Doctor: submit a leave request ──────────────────────────────────────────

  /**
   * POST /leave/request
   * Create a new leave request for an active assignment.
   */
  async createLeaveRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const doctorId = req.user!.id;
      const { assignmentId, leaveType, startDate, endDate, reason, isHalfDay, halfDayPeriod } = req.body;

      const leaveRequest = await leaveService.createLeaveRequest(assignmentId, doctorId, {
        leaveType: leaveType as LeaveType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        isHalfDay,
        halfDayPeriod,
      });

      ApiResponse.created(res, { leaveRequest }, 'Leave request submitted');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('overlap') || msg.includes('not found')) {
        ApiResponse.badRequest(res, msg);
        return;
      }
      next(error);
    }
  },

  /**
   * GET /leave/my-requests
   * Get doctor's own leave requests (paginated).
   */
  async getMyRequests(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const doctorId = req.user!.id;
      const { assignmentId, status, page = '1', limit = '20' } = req.query;

      const result = await leaveService.getLeaveRequests({
        doctorId,
        assignmentId: assignmentId as string | undefined,
        status: status as LeaveStatus | undefined,
        page: Number(page),
        limit: Number(limit),
      });

      ApiResponse.paginated(
        res,
        result.data,
        result.meta.page,
        result.meta.limit,
        result.meta.totalItems,
        'Leave requests retrieved'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /leave/request/:id
   * Cancel a pending leave request (doctor only).
   */
  async cancelLeaveRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const doctorId = req.user!.id;
      const { id } = req.params;

      await leaveService.cancelLeaveRequest(id, doctorId);
      ApiResponse.success(res, null, 'Leave request cancelled');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('Cannot cancel') || msg.includes('not found')) {
        ApiResponse.badRequest(res, msg);
        return;
      }
      next(error);
    }
  },

  // ─── Doctor: read leave balance ───────────────────────────────────────────────

  /**
   * GET /leave/balance/:assignmentId
   * Get leave balance for an active assignment.
   */
  async getLeaveBalance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const doctorId = req.user!.id;
      const { assignmentId } = req.params;

      const balance = await leaveService.getLeaveBalance(assignmentId, doctorId);
      ApiResponse.success(res, balance, 'Leave balance retrieved');
    } catch (error) {
      next(error);
    }
  },
};

export default leaveController;
