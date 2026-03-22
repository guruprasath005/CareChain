// src/services/attendance.service.ts
// Attendance Tracking Service

import { Attendance } from '../models/Attendance.model';
import { Assignment } from '../models/Assignment.model';
import { LeaveRequest } from '../models/LeaveRequest.model';
import { User } from '../models/User.model';
import { AttendanceStatus, AssignmentStatus, LeaveStatus, AttendanceApprovalStatus } from '../models/types';
import { logger } from '../utils/logger';
import { Op } from 'sequelize';
import { Coordinates } from '../models/types';
import { emitToUser, emitToAttendanceRoom } from '../config/socket';

export interface CheckInData {
    location?: Coordinates;
    method?: 'app' | 'manual';
    notes?: string;
}

export interface AttendanceFilters {
    assignmentId?: string;
    doctorId?: string;
    hospitalId?: string;
    status?: AttendanceStatus;
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
 * Attendance Service
 * Handles check-in/check-out and attendance tracking
 */
class AttendanceService {
    /**
     * Check in for the day
     * Creates attendance with CHECKIN_PENDING status, waiting for hospital approval
     */
    async checkIn(
        assignmentId: string,
        doctorId: string,
        data: CheckInData
    ): Promise<Attendance> {
        // Verify assignment exists and is active
        const assignment = await Assignment.findOne({
            where: {
                id: assignmentId,
                doctorId,
                status: { [Op.in]: [AssignmentStatus.ACTIVE, AssignmentStatus.ON_LEAVE] },
            },
            include: [
                { association: 'doctor', attributes: ['id', 'fullName'] },
            ],
        });

        if (!assignment) {
            throw new Error('Active assignment not found');
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check if already checked in today
        const todayStr = today.toISOString().split('T')[0];
        const existingAttendance = await Attendance.findOne({
            where: {
                assignmentId,
                date: todayStr,
            },
        });

        if (existingAttendance) {
            if (existingAttendance.checkIn) {
                throw new Error('Already checked in for today');
            }

            // Update existing record (was marked absent or on leave)
            existingAttendance.checkIn = {
                time: new Date().toISOString(),
                location: data.location,
                method: data.method || 'app',
            };
            existingAttendance.status = AttendanceStatus.CHECKIN_PENDING;
            existingAttendance.notes = data.notes || existingAttendance.notes;
            existingAttendance.isApproved = false;
            await existingAttendance.save();

            // Send notification to hospital
            this.notifyHospitalCheckIn(assignment.hospitalId, existingAttendance, (assignment.doctor as any)?.fullName);

            logger.info(`Check-in updated for assignment ${assignmentId} - pending approval`);
            return existingAttendance;
        }

        // Create new attendance record with CHECKIN_PENDING status
        const attendance = await Attendance.create({
            assignmentId,
            doctorId,
            hospitalId: assignment.hospitalId,
            date: todayStr,
            checkIn: {
                time: new Date().toISOString(),
                location: data.location,
                method: data.method || 'app',
            },
            status: AttendanceStatus.CHECKIN_PENDING,
            isApproved: false,
            notes: data.notes,
        });

        // Send notification to hospital
        this.notifyHospitalCheckIn(assignment.hospitalId, attendance, (assignment.doctor as any)?.fullName);

        logger.info(`Check-in recorded for assignment ${assignmentId} - pending approval`);
        return attendance;
    }

    /**
     * Notify hospital about doctor's check-in request
     */
    private notifyHospitalCheckIn(hospitalId: string, attendance: Attendance, doctorName?: string): void {
        try {
            emitToAttendanceRoom(hospitalId, 'attendance:checkin_request', {
                attendanceId: attendance.id,
                assignmentId: attendance.assignmentId,
                doctorId: attendance.doctorId,
                doctorName: doctorName || 'Doctor',
                checkInTime: attendance.checkIn?.time,
                date: attendance.date,
                status: attendance.status,
                message: `${doctorName || 'Doctor'} has requested to check in.`,
            });
            logger.debug(`Check-in notification sent to hospital ${hospitalId}`);
        } catch (error) {
            logger.warn('Failed to send check-in notification:', error);
        }
    }

    /**
     * Check out for the day
     * Creates checkout request with CHECKOUT_PENDING status, waiting for hospital approval
     */
    async checkOut(
        assignmentId: string,
        doctorId: string,
        location?: Coordinates,
        notes?: string
    ): Promise<Attendance> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];

        const attendance = await Attendance.findOne({
            where: {
                assignmentId,
                doctorId,
                date: todayStr,
            },
            include: [
                { association: 'doctor', attributes: ['id', 'fullName'] },
            ],
        });

        if (!attendance) {
            throw new Error('No check-in record found for today');
        }

        if (!attendance.checkIn) {
            throw new Error('Must check in before checking out');
        }

        if (attendance.checkOut) {
            throw new Error('Already checked out for today');
        }

        // Only allow checkout if check-in was confirmed
        if (attendance.status !== AttendanceStatus.CHECKIN_CONFIRMED &&
            attendance.status !== AttendanceStatus.PRESENT) {
            throw new Error('Check-in must be confirmed before checking out');
        }

        const checkOutTime = new Date();
        attendance.checkOut = {
            time: checkOutTime.toISOString(),
            location,
        };

        if (notes) {
            attendance.notes = notes;
        }

        // Calculate work duration
        const checkInTime = new Date(attendance.checkIn.time);
        const durationMs = checkOutTime.getTime() - checkInTime.getTime();
        const hours = Math.floor(durationMs / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

        attendance.workDuration = { hours, minutes };
        attendance.status = AttendanceStatus.CHECKOUT_PENDING;

        await attendance.save();

        // Get doctor name for notification
        const assignment = await Assignment.findByPk(assignmentId, {
            include: [{ association: 'doctor', attributes: ['id', 'fullName'] }],
        });

        // Send notification to hospital
        this.notifyHospitalCheckOut(attendance.hospitalId, attendance, (assignment?.doctor as any)?.fullName);

        logger.info(`Check-out recorded for assignment ${assignmentId} - pending approval`);
        return attendance;
    }

    /**
     * Notify hospital about doctor's check-out request
     */
    private notifyHospitalCheckOut(hospitalId: string, attendance: Attendance, doctorName?: string): void {
        try {
            emitToAttendanceRoom(hospitalId, 'attendance:checkout_request', {
                attendanceId: attendance.id,
                assignmentId: attendance.assignmentId,
                doctorId: attendance.doctorId,
                doctorName: doctorName || 'Doctor',
                checkInTime: attendance.checkIn?.time,
                checkOutTime: attendance.checkOut?.time,
                workDuration: attendance.workDuration,
                date: attendance.date,
                status: attendance.status,
                message: `${doctorName || 'Doctor'} has requested to check out.`,
            });
            logger.debug(`Check-out notification sent to hospital ${hospitalId}`);
        } catch (error) {
            logger.warn('Failed to send check-out notification:', error);
        }
    }

    /**
     * Hospital confirms doctor's check-in
     */
    async confirmCheckIn(
        attendanceId: string,
        hospitalId: string
    ): Promise<Attendance> {
        const attendance = await Attendance.findOne({
            where: {
                id: attendanceId,
                hospitalId,
            },
            include: [
                { association: 'doctor', attributes: ['id', 'fullName'] },
            ],
        });

        if (!attendance) {
            throw new Error('Attendance record not found');
        }

        if (attendance.status !== AttendanceStatus.CHECKIN_PENDING) {
            throw new Error('Check-in is not pending approval');
        }

        attendance.status = AttendanceStatus.CHECKIN_CONFIRMED;
        attendance.isApproved = true;
        attendance.approvedBy = hospitalId;
        attendance.approvedAt = new Date();
        await attendance.save();

        // Notify doctor about confirmation
        this.notifyDoctorStatus(attendance.doctorId, attendance, 'checkin_confirmed',
            'Your check-in has been confirmed by the hospital.');

        logger.info(`Check-in confirmed for attendance ${attendanceId}`);
        return attendance;
    }

    /**
     * Hospital confirms doctor's check-out
     */
    async confirmCheckOut(
        attendanceId: string,
        hospitalId: string
    ): Promise<Attendance> {
        const attendance = await Attendance.findOne({
            where: {
                id: attendanceId,
                hospitalId,
            },
            include: [
                { association: 'doctor', attributes: ['id', 'fullName'] },
            ],
        });

        if (!attendance) {
            throw new Error('Attendance record not found');
        }

        if (attendance.status !== AttendanceStatus.CHECKOUT_PENDING) {
            throw new Error('Check-out is not pending approval');
        }

        // Determine if half day based on work duration
        if (attendance.workDuration && attendance.workDuration.hours < 4) {
            attendance.status = AttendanceStatus.HALF_DAY;
        } else {
            attendance.status = AttendanceStatus.CHECKOUT_CONFIRMED;
        }

        attendance.isApproved = true;
        attendance.approvedBy = hospitalId;
        attendance.approvedAt = new Date();
        await attendance.save();

        // Notify doctor about confirmation
        this.notifyDoctorStatus(attendance.doctorId, attendance, 'checkout_confirmed',
            'Your check-out has been confirmed. Attendance completed for today.');

        logger.info(`Check-out confirmed for attendance ${attendanceId}`);
        return attendance;
    }

    /**
     * Hospital cancels attendance (check-in or check-out)
     */
    async cancelAttendance(
        attendanceId: string,
        hospitalId: string,
        reason?: string
    ): Promise<Attendance> {
        const attendance = await Attendance.findOne({
            where: {
                id: attendanceId,
                hospitalId,
            },
            include: [
                { association: 'doctor', attributes: ['id', 'fullName'] },
            ],
        });

        if (!attendance) {
            throw new Error('Attendance record not found');
        }

        const previousStatus = attendance.status;
        attendance.status = AttendanceStatus.CANCELLED;
        attendance.isApproved = false;
        attendance.notes = reason ? `${attendance.notes || ''}\nCancelled: ${reason}`.trim() : attendance.notes;
        await attendance.save();

        // Notify doctor about cancellation
        this.notifyDoctorStatus(attendance.doctorId, attendance, 'attendance_cancelled',
            `Your attendance has been cancelled. ${reason || ''}`);

        logger.info(`Attendance cancelled for ${attendanceId}, previous status: ${previousStatus}`);
        return attendance;
    }

    /**
     * Hospital marks doctor as absent
     */
    async markAsAbsent(
        attendanceId: string,
        hospitalId: string,
        reason?: string
    ): Promise<Attendance> {
        const attendance = await Attendance.findOne({
            where: {
                id: attendanceId,
                hospitalId,
            },
            include: [
                { association: 'doctor', attributes: ['id', 'fullName'] },
            ],
        });

        if (!attendance) {
            throw new Error('Attendance record not found');
        }

        attendance.status = AttendanceStatus.ABSENT;
        attendance.isApproved = false;
        attendance.notes = reason ? `${attendance.notes || ''}\nMarked absent: ${reason}`.trim() : attendance.notes;
        attendance.approvedBy = hospitalId;
        attendance.approvedAt = new Date();
        await attendance.save();

        // Notify doctor about being marked absent
        this.notifyDoctorStatus(attendance.doctorId, attendance, 'marked_absent',
            `You have been marked as absent. ${reason || ''}`);

        logger.info(`Marked absent for attendance ${attendanceId}`);
        return attendance;
    }

    /**
     * Create attendance record for marking absent (when no check-in exists)
     */
    async createAbsentRecord(
        assignmentId: string,
        hospitalId: string,
        date: string,
        reason?: string
    ): Promise<Attendance> {
        const assignment = await Assignment.findOne({
            where: {
                id: assignmentId,
                hospitalId,
            },
            include: [
                { association: 'doctor', attributes: ['id', 'fullName'] },
            ],
        });

        if (!assignment) {
            throw new Error('Assignment not found');
        }

        const existingAttendance = await Attendance.findOne({
            where: { assignmentId, date },
        });

        if (existingAttendance) {
            // Update existing record
            existingAttendance.status = AttendanceStatus.ABSENT;
            existingAttendance.notes = reason || existingAttendance.notes;
            existingAttendance.approvedBy = hospitalId;
            existingAttendance.approvedAt = new Date();
            await existingAttendance.save();

            // Notify doctor
            this.notifyDoctorStatus(assignment.doctorId, existingAttendance, 'marked_absent',
                `You have been marked as absent for ${date}. ${reason || ''}`);

            return existingAttendance;
        }

        const attendance = await Attendance.create({
            assignmentId,
            doctorId: assignment.doctorId,
            hospitalId,
            date,
            status: AttendanceStatus.ABSENT,
            notes: reason,
            approvedBy: hospitalId,
            approvedAt: new Date(),
        });

        // Notify doctor
        this.notifyDoctorStatus(assignment.doctorId, attendance, 'marked_absent',
            `You have been marked as absent for ${date}. ${reason || ''}`);

        logger.info(`Created absent record for assignment ${assignmentId}`);
        return attendance;
    }

    /**
     * Notify doctor about attendance status change
     */
    private notifyDoctorStatus(doctorId: string, attendance: Attendance, event: string, message: string): void {
        try {
            emitToUser(doctorId, `attendance:${event}`, {
                attendanceId: attendance.id,
                assignmentId: attendance.assignmentId,
                date: attendance.date,
                status: attendance.status,
                checkInTime: attendance.checkIn?.time,
                checkOutTime: attendance.checkOut?.time,
                workDuration: attendance.workDuration,
                message,
            });
            logger.debug(`Attendance notification sent to doctor ${doctorId}: ${event}`);
        } catch (error) {
            logger.warn('Failed to send attendance notification to doctor:', error);
        }
    }

    /**
     * Get pending attendance requests for hospital
     */
    async getPendingAttendanceRequests(
        hospitalId: string,
        page: number = 1,
        limit: number = 20
    ): Promise<PaginatedResult<Attendance>> {
        const offset = (page - 1) * limit;
        const today = new Date().toISOString().split('T')[0];

        const { count, rows } = await Attendance.findAndCountAll({
            where: {
                hospitalId,
                date: today,
                status: {
                    [Op.in]: [AttendanceStatus.CHECKIN_PENDING, AttendanceStatus.CHECKOUT_PENDING],
                },
            },
            include: [
                { association: 'doctor', attributes: ['id', 'fullName', 'avatarUrl'] },
                { association: 'assignment', attributes: ['id', 'schedule'] },
            ],
            order: [['createdAt', 'DESC']],
            limit,
            offset,
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
     * Get attendance by ID
     */
    async getAttendanceById(attendanceId: string): Promise<Attendance | null> {
        return Attendance.findByPk(attendanceId, {
            include: [
                { association: 'assignment' },
                { association: 'doctor', attributes: ['id', 'fullName'] },
            ],
        });
    }

    /**
     * Get today's attendance for an assignment
     */
    async getTodayAttendance(assignmentId: string): Promise<Attendance | null> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];

        return Attendance.findOne({
            where: {
                assignmentId,
                date: todayStr,
            },
            include: [
                { association: 'doctor', attributes: ['id', 'fullName', 'avatarUrl'] },
            ],
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
            include: [
                { association: 'doctor', attributes: ['id', 'fullName', 'avatarUrl'] },
            ],
        });

        const map = new Map<string, Attendance>();
        for (const record of records) {
            map.set(record.assignmentId, record);
        }
        return map;
    }

    /**
     * Get attendance approval status
     */
    getApprovalStatus(attendance: Attendance): AttendanceApprovalStatus {
        switch (attendance.status) {
            case AttendanceStatus.CHECKIN_PENDING:
            case AttendanceStatus.CHECKOUT_PENDING:
                return AttendanceApprovalStatus.PENDING;
            case AttendanceStatus.CHECKIN_CONFIRMED:
            case AttendanceStatus.CHECKOUT_CONFIRMED:
            case AttendanceStatus.PRESENT:
            case AttendanceStatus.HALF_DAY:
            case AttendanceStatus.LATE:
                return AttendanceApprovalStatus.CONFIRMED;
            case AttendanceStatus.CANCELLED:
                return AttendanceApprovalStatus.CANCELLED;
            case AttendanceStatus.ABSENT:
                return AttendanceApprovalStatus.ABSENT;
            default:
                return AttendanceApprovalStatus.PENDING;
        }
    }


    /**
     * Get attendance with filters
     */
    async getAttendance(filters: AttendanceFilters): Promise<PaginatedResult<Attendance>> {
        const page = filters.page || 1;
        const limit = filters.limit || 30;
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
            where.status = filters.status;
        }

        if (filters.startDate || filters.endDate) {
            where.date = {};
            if (filters.startDate) {
                where.date[Op.gte] = filters.startDate;
            }
            if (filters.endDate) {
                where.date[Op.lte] = filters.endDate;
            }
        }

        const { count, rows } = await Attendance.findAndCountAll({
            where,
            limit,
            offset,
            include: [
                { association: 'doctor', attributes: ['id', 'fullName'] },
            ],
            order: [['date', 'DESC']],
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
     * Get attendance for a date range
     */
    async getAttendanceForRange(
        assignmentId: string,
        startDate: Date,
        endDate: Date
    ): Promise<Attendance[]> {
        return Attendance.findAll({
            where: {
                assignmentId,
                date: {
                    [Op.between]: [startDate, endDate],
                },
            },
            order: [['date', 'ASC']],
        });
    }

    /**
     * Mark attendance manually (by hospital)
     */

    async markAttendance(
        assignmentId: string,
        hospitalId: string,
        date: Date,
        statusStr: string,
        notes?: string
    ): Promise<Attendance> {
        // Verify assignment belongs to hospital
        const assignment = await Assignment.findOne({
            where: { id: assignmentId, hospitalId },
        });

        if (!assignment) {
            throw new Error('Assignment not found');
        }

        const dateOnly = new Date(date);
        dateOnly.setHours(0, 0, 0, 0);

        const dateStr = dateOnly.toISOString().split('T')[0];

        // Map status string to Enum and checkIn/checkOut data
        let status: AttendanceStatus = AttendanceStatus.PRESENT; // Default
        let checkInUpdate: any = null;
        let checkOutUpdate: any = null;

        if (statusStr === 'checked_in') {
            status = AttendanceStatus.PRESENT;
            checkInUpdate = {
                time: new Date().toISOString(),
                method: 'manual',
            };
        } else if (statusStr === 'checked_out') {
            status = AttendanceStatus.PRESENT;
            checkOutUpdate = {
                time: new Date().toISOString(),
                method: 'manual',
            };
        } else if (statusStr === 'absent') {
            status = AttendanceStatus.ABSENT;
        } else if (Object.values(AttendanceStatus).includes(statusStr as AttendanceStatus)) {
            status = statusStr as AttendanceStatus;
        }

        // Check for existing record
        let attendance = await Attendance.findOne({
            where: {
                assignmentId,
                date: dateStr,
            },
        });

        if (attendance) {
            attendance.status = status;
            attendance.notes = notes || attendance.notes;
            attendance.approvedBy = hospitalId;

            if (checkInUpdate) {
                attendance.checkIn = { ...attendance.checkIn, ...checkInUpdate };
            }
            if (checkOutUpdate) {
                // If checking out, ensure we have a checkIn, if not set it to start of day or now
                if (!attendance.checkIn) {
                    attendance.checkIn = {
                        time: new Date(new Date().setHours(9, 0, 0, 0)).toISOString(), // Default 9 AM
                        method: 'manual-auto'
                    };
                }
                attendance.checkOut = { ...attendance.checkOut, ...checkOutUpdate };
            }

            await attendance.save();
        } else {
            // Create New
            const newCheckIn = checkInUpdate || (checkOutUpdate ? {
                time: new Date(new Date().setHours(9, 0, 0, 0)).toISOString(),
                method: 'manual-auto'
            } : null);

            attendance = await Attendance.create({
                assignmentId,
                doctorId: assignment.doctorId,
                hospitalId,
                date: dateStr,
                status,
                notes,
                approvedBy: hospitalId,
                checkIn: newCheckIn,
                checkOut: checkOutUpdate,
            });
        }

        logger.debug(`Attendance marked manually for assignment ${assignmentId} as ${statusStr}`);
        return attendance;
    }

    /**
     * Process leave attendance (mark days as on leave)
     */
    async processLeaveAttendance(leaveRequest: LeaveRequest): Promise<void> {
        if (leaveRequest.status !== LeaveStatus.APPROVED) {
            return;
        }

        const startDate = new Date(leaveRequest.startDate);
        const endDate = new Date(leaveRequest.endDate);
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            const dateOnly = new Date(currentDate);
            dateOnly.setHours(0, 0, 0, 0);
            const dateStr = dateOnly.toISOString().split('T')[0];

            await Attendance.findOrCreate({
                where: {
                    assignmentId: leaveRequest.assignmentId,
                    date: dateStr,
                },
                defaults: {
                    assignmentId: leaveRequest.assignmentId,
                    doctorId: leaveRequest.doctorId,
                    hospitalId: leaveRequest.hospitalId,
                    date: dateStr,
                    status: AttendanceStatus.ON_LEAVE,
                    leaveRequestId: leaveRequest.id,
                },
            });

            currentDate.setDate(currentDate.getDate() + 1);
        }

        logger.debug(`Leave attendance processed for leave request ${leaveRequest.id}`);
    }

    /**
     * Get attendance summary for a month
     */
    async getMonthlyAttendanceSummary(
        assignmentId: string,
        year: number,
        month: number
    ): Promise<{
        present: number;
        absent: number;
        late: number;
        halfDay: number;
        onLeave: number;
        holiday: number;
        totalDays: number;
        attendanceRate: number;
    }> {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        const attendances = await Attendance.findAll({
            where: {
                assignmentId,
                date: {
                    [Op.between]: [startDate, endDate],
                },
            },
        });

        const summary = {
            present: 0,
            absent: 0,
            late: 0,
            halfDay: 0,
            onLeave: 0,
            holiday: 0,
            totalDays: endDate.getDate(),
            attendanceRate: 0,
        };

        for (const attendance of attendances) {
            switch (attendance.status) {
                case AttendanceStatus.PRESENT:
                    summary.present++;
                    break;
                case AttendanceStatus.ABSENT:
                    summary.absent++;
                    break;
                case AttendanceStatus.LATE:
                    summary.late++;
                    summary.present++; // Late still counts as present
                    break;
                case AttendanceStatus.HALF_DAY:
                    summary.halfDay++;
                    break;
                case AttendanceStatus.ON_LEAVE:
                    summary.onLeave++;
                    break;
                case AttendanceStatus.HOLIDAY:
                    summary.holiday++;
                    break;
            }
        }

        // Calculate attendance rate (excluding leaves and holidays)
        const workingDays = summary.totalDays - summary.onLeave - summary.holiday;
        if (workingDays > 0) {
            summary.attendanceRate = Math.round(
                ((summary.present + summary.halfDay * 0.5) / workingDays) * 100
            );
        }

        return summary;
    }

    /**
     * Get doctor's overall attendance stats
     */
    async getDoctorAttendanceStats(doctorId: string): Promise<{
        totalDays: number;
        presentDays: number;
        absentDays: number;
        leaveDays: number;
        averageAttendanceRate: number;
    }> {
        const attendances = await Attendance.findAll({
            where: { doctorId },
        });

        const stats = {
            totalDays: attendances.length,
            presentDays: attendances.filter(a =>
                [AttendanceStatus.PRESENT, AttendanceStatus.LATE].includes(a.status)
            ).length,
            absentDays: attendances.filter(a => a.status === AttendanceStatus.ABSENT).length,
            leaveDays: attendances.filter(a => a.status === AttendanceStatus.ON_LEAVE).length,
            averageAttendanceRate: 0,
        };

        const workingDays = stats.totalDays - stats.leaveDays;
        if (workingDays > 0) {
            stats.averageAttendanceRate = Math.round((stats.presentDays / workingDays) * 100);
        }

        return stats;
    }
}

// Export singleton instance
export const attendanceService = new AttendanceService();
export default attendanceService;
