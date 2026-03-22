// src/services/leave.service.ts
// Leave Request Service

import { LeaveRequest } from '../models/LeaveRequest.model';
import { Assignment } from '../models/Assignment.model';
import { LeaveType, LeaveStatus, AssignmentStatus } from '../models/types';
import { attendanceService } from './attendance.service';
import { assignmentService } from './assignment.service';
import { notificationService } from './notification.service';
import { logger } from '../utils/logger';
import { Op } from 'sequelize';

export interface CreateLeaveData {
    leaveType: LeaveType;
    startDate: Date;
    endDate: Date;
    isHalfDay?: boolean;
    halfDayPeriod?: 'first_half' | 'second_half';
    reason: string;
    documentUrl?: string;
}

export interface LeaveFilters {
    assignmentId?: string;
    doctorId?: string;
    hospitalId?: string;
    status?: LeaveStatus | LeaveStatus[];
    leaveType?: LeaveType;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
}

export interface PaginatedResult<T> {
    data: T[];
    meta: {
        page: number;
        limit: number;
        totalItems: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
}

/**
 * Leave Service
 * Handles leave request workflow
 */
class LeaveService {
    /**
     * Create a leave request
     */
    async createLeaveRequest(
        assignmentId: string,
        doctorId: string,
        data: CreateLeaveData
    ): Promise<LeaveRequest> {
        // Verify assignment exists and is active
        const assignment = await Assignment.findOne({
            where: {
                id: assignmentId,
                doctorId,
                status: { [Op.in]: [AssignmentStatus.ACTIVE, AssignmentStatus.ON_LEAVE] },
            },
        });

        if (!assignment) {
            throw new Error('Active assignment not found');
        }

        // Calculate total days
        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        const timeDiff = endDate.getTime() - startDate.getTime();
        let totalDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1;

        // Half day adjustment
        if (data.isHalfDay) {
            totalDays = 0.5;
        }

        // Check for overlapping requests
        const overlapping = await LeaveRequest.findOne({
            where: {
                assignmentId,
                status: { [Op.notIn]: [LeaveStatus.REJECTED, LeaveStatus.CANCELLED] },
                [Op.or]: [
                    {
                        startDate: { [Op.between]: [startDate, endDate] },
                    },
                    {
                        endDate: { [Op.between]: [startDate, endDate] },
                    },
                    {
                        [Op.and]: [
                            { startDate: { [Op.lte]: startDate } },
                            { endDate: { [Op.gte]: endDate } },
                        ],
                    },
                ],
            },
        });

        if (overlapping) {
            throw new Error('You already have a leave request for these dates');
        }

        // Create leave request
        const leaveRequest = await LeaveRequest.create({
            assignmentId,
            doctorId,
            hospitalId: assignment.hospitalId,
            leaveType: data.leaveType,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            totalDays,
            isHalfDay: data.isHalfDay || false,
            halfDayPeriod: data.halfDayPeriod,
            reason: data.reason,
            status: LeaveStatus.PENDING,
            documents: data.documentUrl ? [{ name: 'Document', url: data.documentUrl, uploadedAt: new Date().toISOString() }] : [],
        });

        logger.info(`Leave request created: ${leaveRequest.id} for assignment ${assignmentId}`);
        return leaveRequest;
    }

    /**
     * Get leave request by ID
     */
    async getLeaveRequestById(leaveRequestId: string): Promise<LeaveRequest | null> {
        return LeaveRequest.findByPk(leaveRequestId, {
            include: [
                { association: 'assignment' },
                { association: 'doctor', attributes: ['id', 'fullName', 'avatarUrl'] },
            ],
        });
    }

    /**
     * Get leave requests with filters
     */
    async getLeaveRequests(filters: LeaveFilters): Promise<PaginatedResult<LeaveRequest>> {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;

        const where: any = {};

        if (filters.assignmentId) {
            where.assignmentId = filters.assignmentId;
        }

        if (filters.doctorId) {
            where.doctorId = filters.doctorId;
        }

        if (filters.hospitalId) {
            where.hospitalId = filters.hospitalId;
        }

        if (filters.status) {
            where.status = Array.isArray(filters.status)
                ? { [Op.in]: filters.status }
                : filters.status;
        }

        if (filters.leaveType) {
            where.leaveType = filters.leaveType;
        }

        if (filters.startDate || filters.endDate) {
            if (filters.startDate) {
                where.startDate = { [Op.gte]: filters.startDate };
            }
            if (filters.endDate) {
                where.endDate = { [Op.lte]: filters.endDate };
            }
        }

        const { count, rows } = await LeaveRequest.findAndCountAll({
            where,
            limit,
            offset,
            include: [
                { association: 'doctor', attributes: ['id', 'fullName', 'avatarUrl'] },
                { association: 'assignment', attributes: ['id', 'jobId'] },
            ],
            order: [['createdAt', 'DESC']],
        });

        const totalPages = Math.ceil(count / limit);

        return {
            data: rows,
            meta: {
                page,
                limit,
                totalItems: count,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
            },
        };
    }

    /**
     * Approve leave request
     */
    /**
     * Approve leave request
     */
    async approveLeaveRequest(
        leaveRequestId: string,
        hospitalId: string,
        notes?: string
    ): Promise<LeaveRequest> {
        const leaveRequest = await LeaveRequest.findByPk(leaveRequestId);

        if (!leaveRequest) {
            throw new Error('Leave request not found');
        }

        if (leaveRequest.hospitalId !== hospitalId) {
            throw new Error('Unauthorized to approve this request');
        }

        if (leaveRequest.status !== LeaveStatus.PENDING) {
            throw new Error('Leave request already processed');
        }

        leaveRequest.status = LeaveStatus.APPROVED;
        leaveRequest.approvedBy = hospitalId;
        leaveRequest.approvedAt = new Date();
        leaveRequest.adminNotes = notes || null;
        await leaveRequest.save();

        // Process attendance for leave days
        await attendanceService.processLeaveAttendance(leaveRequest);

        // Update assignment status if leave starts today or is ongoing
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = new Date(leaveRequest.startDate);
        const endDate = new Date(leaveRequest.endDate);

        if (startDate <= today && endDate >= today) {
            await assignmentService.setOnLeave(leaveRequest.assignmentId);
        }

        logger.info(`Leave request approved: ${leaveRequestId}`);

        notificationService.notifyLeaveUpdate(leaveRequest.doctorId, leaveRequestId, 'approved').catch(() => {});
        return leaveRequest;
    }

    /**
     * Reject leave request
     */
    async rejectLeaveRequest(
        leaveRequestId: string,
        hospitalId: string,
        reason: string
    ): Promise<LeaveRequest> {
        const leaveRequest = await LeaveRequest.findByPk(leaveRequestId);

        if (!leaveRequest) {
            throw new Error('Leave request not found');
        }

        if (leaveRequest.hospitalId !== hospitalId) {
            throw new Error('Unauthorized to reject this request');
        }

        if (leaveRequest.status !== LeaveStatus.PENDING) {
            throw new Error('Leave request already processed');
        }

        leaveRequest.status = LeaveStatus.REJECTED;
        leaveRequest.rejectedBy = hospitalId;
        leaveRequest.rejectedAt = new Date();
        leaveRequest.rejectionReason = reason;
        await leaveRequest.save();

        logger.info(`Leave request rejected: ${leaveRequestId}`);

        notificationService.notifyLeaveUpdate(leaveRequest.doctorId, leaveRequestId, 'rejected').catch(() => {});
        return leaveRequest;
    }

    /**
     * Cancel leave request (by doctor)
     */
    async cancelLeaveRequest(leaveRequestId: string, doctorId: string): Promise<LeaveRequest> {
        const leaveRequest = await LeaveRequest.findOne({
            where: { id: leaveRequestId, doctorId },
        });

        if (!leaveRequest) {
            throw new Error('Leave request not found');
        }

        // Can only cancel pending requests or approved requests before they start
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = new Date(leaveRequest.startDate);

        if (leaveRequest.status === LeaveStatus.APPROVED && startDate <= today) {
            throw new Error('Cannot cancel leave that has already started');
        }

        if (leaveRequest.status === LeaveStatus.REJECTED) {
            throw new Error('Cannot cancel a rejected leave request');
        }

        leaveRequest.status = LeaveStatus.CANCELLED;
        await leaveRequest.save();

        logger.info(`Leave request cancelled: ${leaveRequestId}`);
        return leaveRequest;
    }

    /**
     * Get leave balance for doctor
     */
    async getLeaveBalance(
        assignmentId: string,
        doctorId: string
    ): Promise<{
        annual: { total: number; used: number; available: number };
        sick: { total: number; used: number; available: number };
        casual: { total: number; used: number; available: number };
    }> {
        const assignment = await Assignment.findOne({
            where: { id: assignmentId, doctorId },
        });

        if (!assignment) {
            throw new Error('Assignment not found');
        }

        // Get approved leaves
        const approvedLeaves = await LeaveRequest.findAll({
            where: {
                assignmentId,
                status: LeaveStatus.APPROVED,
            },
        });

        // Calculate used leaves by type
        const usedByType = {
            annual: 0,
            sick: 0,
            casual: 0,
        };

        for (const leave of approvedLeaves) {
            if (leave.leaveType === LeaveType.ANNUAL) {
                usedByType.annual += leave.totalDays;
            } else if (leave.leaveType === LeaveType.SICK) {
                usedByType.sick += leave.totalDays;
            } else if (leave.leaveType === LeaveType.CASUAL) {
                usedByType.casual += leave.totalDays;
            }
        }

        // Get balance from assignment
        const balance = assignment.leaveBalance || {
            annual: { total: 12, used: 0 },
            sick: { total: 10, used: 0 },
            casual: { total: 6, used: 0 },
        };

        return {
            annual: {
                total: balance.annual.total,
                used: usedByType.annual,
                available: Math.max(0, balance.annual.total - usedByType.annual),
            },
            sick: {
                total: balance.sick.total,
                used: usedByType.sick,
                available: Math.max(0, balance.sick.total - usedByType.sick),
            },
            casual: {
                total: balance.casual.total,
                used: usedByType.casual,
                available: Math.max(0, balance.casual.total - usedByType.casual),
            },
        };
    }

    /**
     * Get upcoming leaves for a hospital
     */
    async getUpcomingLeaves(hospitalId: string, days: number = 7): Promise<LeaveRequest[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);

        return LeaveRequest.findAll({
            where: {
                hospitalId,
                status: LeaveStatus.APPROVED,
                startDate: {
                    [Op.between]: [today, futureDate],
                },
            },
            include: [
                { association: 'doctor', attributes: ['id', 'fullName'] },
                { association: 'assignment', attributes: ['id', 'jobId'] },
            ],
            order: [['startDate', 'ASC']],
        });
    }

    /**
     * Get doctors currently on leave
     */
    async getDoctorsOnLeave(hospitalId: string): Promise<LeaveRequest[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return LeaveRequest.findAll({
            where: {
                hospitalId,
                status: LeaveStatus.APPROVED,
                startDate: { [Op.lte]: today },
                endDate: { [Op.gte]: today },
            },
            include: [
                { association: 'doctor', attributes: ['id', 'fullName', 'avatarUrl'] },
                { association: 'assignment' },
            ],
        });
    }
}

// Export singleton instance
export const leaveService = new LeaveService();
export default leaveService;
