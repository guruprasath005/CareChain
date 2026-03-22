// src/services/admin.service.ts
// Admin operations: credential verification, user management, platform stats.

import { Op } from 'sequelize';
import { User } from '../models/User.model';
import { Doctor } from '../models/Doctor.model';
import { Hospital } from '../models/Hospital.model';
import { Feedback } from '../models/Feedback.model';
import { Assignment } from '../models/Assignment.model';
import { Job } from '../models/Job.model';
import { VerificationStatus, UserRole } from '../models/types';
import { AppError } from '../middleware';
import { logger } from '../utils/logger';
import { feedbackService } from './feedback.service';

class AdminService {
  // ─── Doctor credential verification ────────────────────────────────────────

  async getPendingDoctors(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const { rows, count } = await Doctor.findAndCountAll({
      where: {
        [Op.or]: [
          { '$user.isProfileComplete$': true },
          // doctors with licenses or education pending review
        ],
      } as any,
      include: [{
        association: 'user',
        where: { role: UserRole.DOCTOR, isActive: true },
        attributes: ['id', 'fullName', 'email', 'createdAt'],
      }],
      order: [['createdAt', 'ASC']],
      limit,
      offset,
    });

    return {
      data: rows,
      meta: {
        page, limit,
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        hasNextPage: offset + limit < count,
        hasPrevPage: page > 1,
      },
    };
  }

  async getDoctorForReview(doctorId: string) {
    const doctor = await Doctor.findOne({
      where: { userId: doctorId },
      include: [{ association: 'user', attributes: ['id', 'fullName', 'email', 'createdAt', 'isActive'] }],
    });
    if (!doctor) throw new AppError('Doctor not found', 404);
    return doctor;
  }

  /**
   * Verify or reject a doctor's medical credentials.
   * Updates the Doctor's platformStats.performanceScore initial seed.
   */
  async verifyDoctor(
    doctorId: string,
    adminId: string,
    action: 'verify' | 'reject',
    notes?: string
  ): Promise<Doctor> {
    const doctor = await Doctor.findOne({ where: { userId: doctorId } });
    if (!doctor) throw new AppError('Doctor not found', 404);

    const user = await User.findByPk(doctorId);
    if (!user) throw new AppError('User not found', 404);

    if (action === 'verify') {
      // Seed an initial quality score of 70 for newly verified doctors
      const stats = doctor.platformStats ?? {
        jobsCompleted: 0, totalShifts: 0, noShows: 0,
        attendanceRate: 0, rating: 0, totalReviews: 0, performanceScore: 0,
      };
      stats.performanceScore = Math.max(stats.performanceScore, 70);
      await doctor.update({ platformStats: stats });
      await user.update({ isProfileComplete: true });
      logger.info(`Admin ${adminId} verified doctor ${doctorId}`);
    } else {
      await user.update({ isActive: false });
      logger.info(`Admin ${adminId} rejected doctor ${doctorId}: ${notes}`);
    }

    return doctor;
  }

  // ─── Hospital credential verification ──────────────────────────────────────

  async getPendingHospitals(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const { rows, count } = await Hospital.findAndCountAll({
      where: { verificationStatus: VerificationStatus.PENDING },
      include: [{
        association: 'user',
        where: { role: UserRole.HOSPITAL, isActive: true },
        attributes: ['id', 'fullName', 'email', 'createdAt'],
      }],
      order: [['createdAt', 'ASC']],
      limit,
      offset,
    });

    return {
      data: rows,
      meta: {
        page, limit,
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        hasNextPage: offset + limit < count,
        hasPrevPage: page > 1,
      },
    };
  }

  async getHospitalForReview(hospitalId: string) {
    const hospital = await Hospital.findOne({
      where: { userId: hospitalId },
      include: [{ association: 'user', attributes: ['id', 'fullName', 'email', 'createdAt'] }],
    });
    if (!hospital) throw new AppError('Hospital not found', 404);
    return hospital;
  }

  async verifyHospital(
    hospitalId: string,
    adminId: string,
    action: 'verify' | 'reject' | 'in_review',
    notes?: string
  ): Promise<Hospital> {
    const hospital = await Hospital.findOne({ where: { userId: hospitalId } });
    if (!hospital) throw new AppError('Hospital not found', 404);

    const statusMap = {
      verify: VerificationStatus.VERIFIED,
      reject: VerificationStatus.REJECTED,
      in_review: VerificationStatus.IN_REVIEW,
    };

    await hospital.update({
      verificationStatus: statusMap[action],
      verificationNotes: notes ?? null,
      verifiedAt: action === 'verify' ? new Date() : null,
      verifiedBy: action === 'verify' ? adminId : null,
    });

    // Grant initial job-posting credits on verification
    if (action === 'verify') {
      const existing = hospital.jobPostQuota ?? 0;
      if (existing === 0) {
        await (hospital as any).update({ jobPostQuota: 3 }); // 3 free trial posts
      }
    }

    logger.info(`Admin ${adminId} set hospital ${hospitalId} verification to ${action}`);
    return hospital;
  }

  // ─── User management ────────────────────────────────────────────────────────

  async listUsers(page = 1, limit = 20, role?: string, search?: string) {
    const offset = (page - 1) * limit;
    const where: any = {};
    if (role) where.role = role;
    if (search) {
      where[Op.or] = [
        { fullName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { rows, count } = await User.findAndCountAll({
      where,
      attributes: ['id', 'fullName', 'email', 'role', 'isActive', 'isEmailVerified', 'isProfileComplete', 'createdAt', 'lastLogin'],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return {
      data: rows,
      meta: {
        page, limit,
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        hasNextPage: offset + limit < count,
        hasPrevPage: page > 1,
      },
    };
  }

  async toggleUserActive(targetUserId: string, adminId: string): Promise<User> {
    const user = await User.findByPk(targetUserId);
    if (!user) throw new AppError('User not found', 404);
    if (user.role === UserRole.ADMIN) throw new AppError('Cannot deactivate another admin', 403);

    await user.update({ isActive: !user.isActive });
    logger.info(`Admin ${adminId} toggled user ${targetUserId} active → ${user.isActive}`);
    return user;
  }

  // ─── Platform statistics ────────────────────────────────────────────────────

  async getPlatformStats() {
    const [
      totalDoctors, totalHospitals, totalJobs, totalAssignments,
      verifiedHospitals, pendingHospitals, activeAssignments,
    ] = await Promise.all([
      User.count({ where: { role: UserRole.DOCTOR } }),
      User.count({ where: { role: UserRole.HOSPITAL } }),
      Job.count(),
      Assignment.count(),
      Hospital.count({ where: { verificationStatus: VerificationStatus.VERIFIED } }),
      Hospital.count({ where: { verificationStatus: VerificationStatus.PENDING } }),
      Assignment.count({ where: { status: 'active' as any } }),
    ]);

    return {
      users: { totalDoctors, totalHospitals },
      jobs: { totalJobs, activeAssignments },
      verification: { verifiedHospitals, pendingHospitals },
      timestamp: new Date().toISOString(),
    };
  }

  // ─── Quality score admin tools ──────────────────────────────────────────────

  /**
   * Trigger a full quality-score recalculation for a specific user.
   * Useful after manually correcting feedback records.
   */
  async recalculateUserScore(userId: string, role: 'doctor' | 'hospital'): Promise<number> {
    await feedbackService.refreshUserScore(userId, role);
    const profile = role === 'doctor'
      ? await Doctor.findOne({ where: { userId } })
      : await Hospital.findOne({ where: { userId } });

    if (!profile) throw new AppError('Profile not found', 404);
    return role === 'doctor'
      ? (profile as Doctor).platformStats?.performanceScore ?? 0
      : (profile as Hospital).hospitalStats?.rating ?? 0;
  }

  // ─── Credit management ──────────────────────────────────────────────────────

  /**
   * Manually adjust a hospital's job-post credit quota (e.g., for promotions).
   */
  async adjustJobCredits(hospitalId: string, adminId: string, delta: number, reason: string): Promise<number> {
    const hospital = await Hospital.findOne({ where: { userId: hospitalId } });
    if (!hospital) throw new AppError('Hospital not found', 404);

    const current = (hospital as any).jobPostQuota ?? 0;
    const newQuota = Math.max(0, current + delta);
    await (hospital as any).update({ jobPostQuota: newQuota });

    logger.info(`Admin ${adminId} adjusted hospital ${hospitalId} credits by ${delta} (${reason}). New quota: ${newQuota}`);
    return newQuota;
  }
}

export const adminService = new AdminService();
export default adminService;
