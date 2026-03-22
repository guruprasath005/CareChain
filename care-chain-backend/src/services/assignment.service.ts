// src/services/assignment.service.ts
// Assignment Management Service

import { Assignment } from '../models/Assignment.model';
import { Job } from '../models/Job.model';
import { User } from '../models/User.model';
import { Doctor } from '../models/Doctor.model';
import { Hospital } from '../models/Hospital.model';
import { Attendance } from '../models/Attendance.model';
import { LeaveRequest } from '../models/LeaveRequest.model';
import { AssignmentStatus, AttendanceStatus, LeaveStatus } from '../models/types';
import { logger } from '../utils/logger';
import { Op } from 'sequelize';
import { randomUUID } from 'crypto';

export interface AssignmentFilters {
    doctorId?: string;
    hospitalId?: string;
    jobId?: string;
    status?: AssignmentStatus | AssignmentStatus[];
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
 * Assignment Service
 * Handles active job assignments
 */
class AssignmentService {
    private normalizeScheduleEntries(rawSchedule: any): Array<{
        id: string;
        date: string;
        startTime: string;
        endTime: string;
        isWorkDay: boolean;
        notes?: string;
        createdAt?: string;
        updatedAt?: string;
    }> {
        if (Array.isArray(rawSchedule)) {
            return rawSchedule;
        }

        if (rawSchedule && Array.isArray(rawSchedule.entries)) {
            return rawSchedule.entries;
        }

        return [];
    }

    private buildSchedulePayload(
        existingSchedule: any,
        entries: Array<{
            id: string;
            date: string;
            startTime: string;
            endTime: string;
            isWorkDay: boolean;
            notes?: string;
            createdAt?: string;
            updatedAt?: string;
        }>
    ) {
        const base = existingSchedule && typeof existingSchedule === 'object' && !Array.isArray(existingSchedule)
            ? existingSchedule
            : {};

        return {
            ...base,
            entries,
        };
    }
    /**
     * Get assignment by ID
     */
    async getAssignmentById(assignmentId: string): Promise<Assignment | null> {
        return Assignment.findByPk(assignmentId, {
            include: [
                { association: 'job' },
                { association: 'doctor', include: [{ association: 'doctorProfile' }] },
                { association: 'assignmentHospital', include: [{ association: 'hospitalProfile' }] },
            ],
        });
    }

    /**
     * Get assignments with filters
     */
    async getAssignments(filters: AssignmentFilters): Promise<PaginatedResult<Assignment>> {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;

        const where: any = {};

        if (filters.doctorId) {
            where.doctorId = filters.doctorId;
        }

        if (filters.hospitalId) {
            where.hospitalId = filters.hospitalId;
        }

        if (filters.jobId) {
            where.jobId = filters.jobId;
        }

        if (filters.status) {
            where.status = Array.isArray(filters.status)
                ? { [Op.in]: filters.status }
                : filters.status;
        }

        const { count, rows } = await Assignment.findAndCountAll({
            where,
            limit,
            offset,
            include: [
                { association: 'job', attributes: ['id', 'title', 'specialization', 'shift'] },
                { association: 'doctor', attributes: ['id', 'fullName'] },
                { association: 'assignmentHospital', attributes: ['id', 'fullName'] },
            ],
            order: [['startDate', 'DESC']],
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
     * Get doctor's active assignments
     */
    async getDoctorActiveAssignments(doctorId: string): Promise<Assignment[]> {
        return Assignment.findAll({
            where: {
                doctorId,
                status: { [Op.in]: [AssignmentStatus.ACTIVE, AssignmentStatus.ON_LEAVE] },
            },
            include: [
                { association: 'job', attributes: ['id', 'title', 'specialization', 'shift', 'location'] },
                {
                    association: 'assignmentHospital',
                    attributes: ['id', 'fullName'],
                    include: [{ association: 'hospitalProfile', attributes: ['hospitalName', 'address'] }],
                },
            ],
            order: [['startDate', 'DESC']],
        });
    }

    /**
     * Get hospital's employees (active assignments)
     */
    async getHospitalEmployees(hospitalId: string, status?: AssignmentStatus): Promise<Assignment[]> {
        const where: any = { hospitalId };

        if (status) {
            where.status = status;
        } else {
            where.status = { [Op.in]: [AssignmentStatus.ACTIVE, AssignmentStatus.ON_LEAVE] };
        }

        return Assignment.findAll({
            where,
            include: [
                { association: 'job', attributes: ['id', 'title', 'specialization', 'department', 'jobType'] },
                {
                    association: 'doctor',
                    attributes: ['id', 'fullName', 'avatarUrl', 'email', 'phoneNumber', 'phoneCountryCode'],
                    include: [
                        { association: 'doctorProfile', attributes: ['specialization'] }
                    ]
                },
            ],
            order: [['startDate', 'ASC']],
        });
    }

    /**
     * Update assignment status
     */
    async updateStatus(
        assignmentId: string,
        hospitalId: string,
        status: AssignmentStatus,
        reason?: string
    ): Promise<Assignment> {
        const assignment = await Assignment.findOne({
            where: { id: assignmentId, hospitalId },
        });

        if (!assignment) {
            throw new Error('Assignment not found');
        }

        const previousStatus = assignment.status;
        assignment.status = status;

        // Handle termination
        if (status === AssignmentStatus.TERMINATED) {
            assignment.termination = {
                terminatedAt: new Date().toISOString(),
                terminatedBy: hospitalId,
                reason,
                type: 'terminated',
            };
            assignment.endDate = new Date();
        }

        // Handle completion
        if (status === AssignmentStatus.COMPLETED) {
            assignment.endDate = new Date();

            // Update doctor's platform stats
            const doctor = await Doctor.findOne({ where: { userId: assignment.doctorId } });
            if (doctor) {
                doctor.platformStats = {
                    ...doctor.platformStats,
                    jobsCompleted: (doctor.platformStats?.jobsCompleted || 0) + 1,
                };
                await doctor.save();
            }
        }

        await assignment.save();

        logger.info(`Assignment ${assignmentId} status changed from ${previousStatus} to ${status}`);
        return assignment;
    }

    /**
     * Pause assignment
     */
    async pauseAssignment(assignmentId: string, hospitalId: string, reason?: string): Promise<Assignment> {
        return this.updateStatus(assignmentId, hospitalId, AssignmentStatus.PAUSED, reason);
    }

    /**
     * Resume assignment
     */
    async resumeAssignment(assignmentId: string, hospitalId: string): Promise<Assignment> {
        return this.updateStatus(assignmentId, hospitalId, AssignmentStatus.ACTIVE);
    }

    /**
     * Complete assignment
     */
    async completeAssignment(assignmentId: string, hospitalId: string): Promise<Assignment> {
        return this.updateStatus(assignmentId, hospitalId, AssignmentStatus.COMPLETED);
    }

    /**
     * Terminate assignment
     */
    async terminateAssignment(
        assignmentId: string,
        hospitalId: string,
        reason: string
    ): Promise<Assignment> {
        return this.updateStatus(assignmentId, hospitalId, AssignmentStatus.TERMINATED, reason);
    }

    /**
     * Set assignment on leave status
     */
    async setOnLeave(assignmentId: string): Promise<Assignment> {
        const assignment = await Assignment.findByPk(assignmentId);
        if (!assignment) {
            throw new Error('Assignment not found');
        }

        assignment.status = AssignmentStatus.ON_LEAVE;
        await assignment.save();

        return assignment;
    }

    /**
     * End leave and return to active
     */
    async endLeave(assignmentId: string): Promise<Assignment> {
        const assignment = await Assignment.findByPk(assignmentId);
        if (!assignment) {
            throw new Error('Assignment not found');
        }

        if (assignment.status !== AssignmentStatus.ON_LEAVE) {
            throw new Error('Assignment is not on leave');
        }

        assignment.status = AssignmentStatus.ACTIVE;
        await assignment.save();

        return assignment;
    }

    /**
     * Get assignment statistics for a doctor
     */
    async getDoctorAssignmentStats(doctorId: string): Promise<{
        total: number;
        active: number;
        completed: number;
        terminated: number;
    }> {
        const [total, active, completed, terminated] = await Promise.all([
            Assignment.count({ where: { doctorId } }),
            Assignment.count({ where: { doctorId, status: AssignmentStatus.ACTIVE } }),
            Assignment.count({ where: { doctorId, status: AssignmentStatus.COMPLETED } }),
            Assignment.count({ where: { doctorId, status: AssignmentStatus.TERMINATED } }),
        ]);

        return { total, active, completed, terminated };
    }

    /**
     * Get assignment statistics for a hospital
     */
    async getHospitalAssignmentStats(hospitalId: string): Promise<{
        total: number;
        active: number;
        onLeave: number;
        completed: number;
    }> {
        const [total, active, onLeave, completed] = await Promise.all([
            Assignment.count({ where: { hospitalId } }),
            Assignment.count({ where: { hospitalId, status: AssignmentStatus.ACTIVE } }),
            Assignment.count({ where: { hospitalId, status: AssignmentStatus.ON_LEAVE } }),
            Assignment.count({ where: { hospitalId, status: AssignmentStatus.COMPLETED } }),
        ]);

        return { total, active, onLeave, completed };
    }

    /**
     * Get today's attendance status for an assignment
     */
    async getTodayAttendance(assignmentId: string): Promise<Attendance | null> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return Attendance.findOne({
            where: {
                assignmentId,
                date: today,
            },
        });
    }

    /**
     * Batch fetch today's attendance for multiple assignments in a single query.
     * Returns a Map keyed by assignmentId for O(1) lookup.
     */
    async getBulkTodayAttendance(assignmentIds: string[]): Promise<Map<string, Attendance>> {
        if (assignmentIds.length === 0) return new Map();

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];

        const records = await Attendance.findAll({
            where: {
                assignmentId: { [Op.in]: assignmentIds },
                date: todayStr,
            },
        });

        const map = new Map<string, Attendance>();
        for (const record of records) {
            map.set(record.assignmentId, record);
        }
        return map;
    }

    /**
     * Batch fetch pending leave request counts for multiple assignments in a single query.
     * Returns a Map keyed by assignmentId for O(1) lookup.
     */
    async getBulkPendingLeaveCount(assignmentIds: string[]): Promise<Map<string, number>> {
        if (assignmentIds.length === 0) return new Map();

        const leaves = await LeaveRequest.findAll({
            where: {
                assignmentId: { [Op.in]: assignmentIds },
                status: LeaveStatus.PENDING,
            },
            attributes: ['assignmentId'],
        });

        const map = new Map<string, number>();
        for (const leave of leaves) {
            map.set(leave.assignmentId, (map.get(leave.assignmentId) ?? 0) + 1);
        }
        return map;
    }

    /**
     * Get pending leave requests for an assignment
     */
    async getPendingLeaveRequests(assignmentId: string): Promise<LeaveRequest[]> {
        return LeaveRequest.findAll({
            where: {
                assignmentId,
                status: LeaveStatus.PENDING,
            },
            order: [['createdAt', 'DESC']],
        });
    }

    /**
     * Update schedule for assignment
     */
    async updateSchedule(
        assignmentId: string,
        hospitalId: string,
        schedule: { shiftStart: string; shiftEnd: string; workingDays: string[] }
    ): Promise<Assignment> {
        const assignment = await Assignment.findOne({
            where: { id: assignmentId, hospitalId },
        });

        if (!assignment) {
            throw new Error('Assignment not found');
        }

        const existingSchedule = assignment.schedule || {};
        assignment.schedule = {
            ...(typeof existingSchedule === 'object' && !Array.isArray(existingSchedule) ? existingSchedule : {}),
            ...schedule,
        };
        await assignment.save();

        logger.debug(`Assignment ${assignmentId} schedule updated`);
        return assignment;
    }

    async getScheduleEntries(assignmentId: string, hospitalId?: string): Promise<{
        entries: Array<{
            id: string;
            date: string;
            startTime: string;
            endTime: string;
            isWorkDay: boolean;
            notes?: string;
            createdAt?: string;
            updatedAt?: string;
        }>;
        meta: any;
    }> {
        const where: any = { id: assignmentId };
        if (hospitalId) {
            where.hospitalId = hospitalId;
        }

        const assignment = await Assignment.findOne({ where });
        if (!assignment) {
            throw new Error('Assignment not found');
        }

        const schedule = assignment.schedule || {};
        const entries = this.normalizeScheduleEntries(schedule)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const meta = Array.isArray(schedule) ? {} : schedule;
        return { entries, meta };
    }

    async upsertScheduleEntry(
        assignmentId: string,
        hospitalId: string,
        entry: {
            date: string;
            startTime: string;
            endTime: string;
            isWorkDay: boolean;
            notes?: string;
        }
    ): Promise<{ entry: any; entries: any[] }> {
        const assignment = await Assignment.findOne({
            where: { id: assignmentId, hospitalId },
        });

        if (!assignment) {
            throw new Error('Assignment not found');
        }

        const schedule = assignment.schedule || {};
        const entries = this.normalizeScheduleEntries(schedule);
        const now = new Date().toISOString();

        const existingIndex = entries.findIndex((item) => item.date === entry.date);
        if (existingIndex >= 0) {
            entries[existingIndex] = {
                ...entries[existingIndex],
                ...entry,
                updatedAt: now,
            };
        } else {
            entries.push({
                id: randomUUID(),
                ...entry,
                createdAt: now,
                updatedAt: now,
            });
        }

        const updatedSchedule = this.buildSchedulePayload(schedule, entries);
        if (!updatedSchedule.shiftStart && entry.startTime) {
            updatedSchedule.shiftStart = entry.startTime;
        }
        if (!updatedSchedule.shiftEnd && entry.endTime) {
            updatedSchedule.shiftEnd = entry.endTime;
        }

        assignment.schedule = updatedSchedule;
        await assignment.save();

        return {
            entry: entries.find((item) => item.date === entry.date),
            entries,
        };
    }

    async upsertScheduleEntries(
        assignmentId: string,
        hospitalId: string,
        entriesInput: Array<{
            date: string;
            startTime: string;
            endTime: string;
            isWorkDay: boolean;
            notes?: string;
        }>
    ): Promise<{ entries: any[] }> {
        const assignment = await Assignment.findOne({
            where: { id: assignmentId, hospitalId },
        });

        if (!assignment) {
            throw new Error('Assignment not found');
        }

        const schedule = assignment.schedule || {};
        const entries = this.normalizeScheduleEntries(schedule);
        const now = new Date().toISOString();

        entriesInput.forEach((entry) => {
            const existingIndex = entries.findIndex((item) => item.date === entry.date);
            if (existingIndex >= 0) {
                entries[existingIndex] = {
                    ...entries[existingIndex],
                    ...entry,
                    updatedAt: now,
                };
            } else {
                entries.push({
                    id: randomUUID(),
                    ...entry,
                    createdAt: now,
                    updatedAt: now,
                });
            }
        });

        const updatedSchedule = this.buildSchedulePayload(schedule, entries);
        if (!updatedSchedule.shiftStart && entriesInput[0]?.startTime) {
            updatedSchedule.shiftStart = entriesInput[0].startTime;
        }
        if (!updatedSchedule.shiftEnd && entriesInput[0]?.endTime) {
            updatedSchedule.shiftEnd = entriesInput[0].endTime;
        }

        assignment.schedule = updatedSchedule;
        assignment.changed('schedule', true);
        await assignment.save();

        return { entries };
    }

    async updateScheduleEntry(
        assignmentId: string,
        hospitalId: string,
        scheduleId: string,
        data: Partial<{
            startTime: string;
            endTime: string;
            isWorkDay: boolean;
            notes?: string;
        }>
    ): Promise<{ entry: any; entries: any[] }> {
        const assignment = await Assignment.findOne({
            where: { id: assignmentId, hospitalId },
        });

        if (!assignment) {
            throw new Error('Assignment not found');
        }

        const schedule = assignment.schedule || {};
        const entries = this.normalizeScheduleEntries(schedule);
        const index = entries.findIndex((item) => item.id === scheduleId);

        if (index === -1) {
            throw new Error('Schedule entry not found');
        }

        entries[index] = {
            ...entries[index],
            ...data,
            updatedAt: new Date().toISOString(),
        };

        assignment.schedule = this.buildSchedulePayload(schedule, entries);
        await assignment.save();

        return { entry: entries[index], entries };
    }

    async deleteScheduleEntry(
        assignmentId: string,
        hospitalId: string,
        scheduleId: string
    ): Promise<{ entries: any[] }> {
        const assignment = await Assignment.findOne({
            where: { id: assignmentId, hospitalId },
        });

        if (!assignment) {
            throw new Error('Assignment not found');
        }

        const schedule = assignment.schedule || {};
        const entries = this.normalizeScheduleEntries(schedule);
        const filtered = entries.filter((item) => item.id !== scheduleId);

        assignment.schedule = this.buildSchedulePayload(schedule, filtered);
        await assignment.save();

        return { entries: filtered };
    }

    /**
     * Calculate performance for an assignment
     */
    async calculatePerformance(assignmentId: string): Promise<{
        daysPresent: number;
        daysAbsent: number;
        totalShifts: number;
        attendanceRate: number;
    }> {
        const assignment = await Assignment.findByPk(assignmentId);
        if (!assignment) {
            throw new Error('Assignment not found');
        }

        const attendances = await Attendance.findAll({
            where: { assignmentId },
        });

        const daysPresent = attendances.filter(a =>
            [AttendanceStatus.PRESENT, AttendanceStatus.LATE].includes(a.status)
        ).length;

        const daysAbsent = attendances.filter(a =>
            a.status === AttendanceStatus.ABSENT
        ).length;

        const totalShifts = attendances.length;
        const attendanceRate = totalShifts > 0
            ? Math.round((daysPresent / totalShifts) * 100)
            : 100;

        // Update assignment performance
        assignment.performance = {
            daysPresent,
            daysAbsent,
            totalShifts,
            completedShifts: daysPresent,
            attendanceRate,
            rating: assignment.performance?.rating || 0,
        };
        await assignment.save();

        return { daysPresent, daysAbsent, totalShifts, attendanceRate };
    }
}

// Export singleton instance
export const assignmentService = new AssignmentService();
export default assignmentService;
