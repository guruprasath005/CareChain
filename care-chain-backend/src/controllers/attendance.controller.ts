// src/controllers/attendance.controller.ts
// Attendance Controller - Doctor self-service attendance

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { ApiResponse } from '../utils/response';
import { attendanceService } from '../services/attendance.service';
import { AttendanceStatus } from '../models/types';

export const attendanceController = {
  /**
   * POST /attendance/check-in
   * Doctor checks in for work
   */
  async checkIn(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { assignmentId, location } = req.body;
      const doctorId = req.user!.id;

      const attendance = await attendanceService.checkIn(
        assignmentId,
        doctorId,
        { location, method: 'app' }
      );

      ApiResponse.success(res, {
        checkInTime: attendance.checkIn?.time,
        attendanceId: attendance.id,
        status: attendance.status,
        approvalStatus: attendanceService.getApprovalStatus(attendance),
        message: 'Check-in recorded. Waiting for hospital confirmation.',
      }, 'Checked in successfully - pending approval');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /attendance/check-out
   * Doctor checks out from work
   */
  async checkOut(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { assignmentId, location, notes } = req.body;
      const doctorId = req.user!.id;

      const attendance = await attendanceService.checkOut(
        assignmentId,
        doctorId,
        location,
        notes
      );

      ApiResponse.success(res, {
        checkOutTime: attendance.checkOut?.time,
        workDuration: attendance.workDuration,
        status: attendance.status,
        approvalStatus: attendanceService.getApprovalStatus(attendance),
        message: 'Check-out recorded. Waiting for hospital confirmation.',
      }, 'Checked out successfully - pending approval');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /attendance/status/:assignmentId
   * Get today's attendance status
   */
  async getTodayStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { assignmentId } = req.params;
      const attendance = await attendanceService.getTodayAttendance(assignmentId);

      let status = 'none';
      let approvalStatus = 'none';
      
      if (attendance) {
        // Determine display status based on detailed status
        switch (attendance.status) {
          case AttendanceStatus.CHECKIN_PENDING:
            status = 'checkin_pending';
            approvalStatus = 'pending';
            break;
          case AttendanceStatus.CHECKIN_CONFIRMED:
            status = 'checked_in';
            approvalStatus = 'confirmed';
            break;
          case AttendanceStatus.CHECKOUT_PENDING:
            status = 'checkout_pending';
            approvalStatus = 'pending';
            break;
          case AttendanceStatus.CHECKOUT_CONFIRMED:
          case AttendanceStatus.HALF_DAY:
            status = 'checked_out';
            approvalStatus = 'confirmed';
            break;
          case AttendanceStatus.PRESENT:
          case AttendanceStatus.LATE:
            status = attendance.checkOut ? 'checked_out' : 'checked_in';
            approvalStatus = 'confirmed';
            break;
          case AttendanceStatus.ABSENT:
            status = 'absent';
            approvalStatus = 'absent';
            break;
          case AttendanceStatus.CANCELLED:
            status = 'cancelled';
            approvalStatus = 'cancelled';
            break;
          default:
            status = attendance.checkOut ? 'checked_out' : 
                    attendance.checkIn ? 'checked_in' : 'none';
        }
      }

      ApiResponse.success(res, {
        status,
        approvalStatus,
        attendance: attendance ? {
          id: attendance.id,
          date: attendance.date,
          checkIn: attendance.checkIn,
          checkOut: attendance.checkOut,
          status: attendance.status,
          workDuration: attendance.workDuration,
          isApproved: attendance.isApproved,
          approvedAt: attendance.approvedAt,
        } : null,
      }, 'Status retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /attendance/history/:assignmentId
   * Get attendance history
   */
  async getHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { assignmentId } = req.params;
      const { page = '1', limit = '10' } = req.query;

      const result = await attendanceService.getAttendance({
        assignmentId,
        page: Number(page),
        limit: Number(limit)
      });

      ApiResponse.paginated(
        res,
        result.data,
        result.meta.page,
        result.meta.limit,
        result.meta.totalItems,
        'History retrieved'
      );
    } catch (error) {
      next(error);
    }
  },
};

export default attendanceController;
