// src/services/feedback.service.ts
//
// Quality Score — ported exactly from CareChainX feedback/models.py
//
// Hospital → Doctor feedback dimensions (each 1–5):
//   competence | ethics | teamwork | conduct
//
// Doctor → Hospital feedback dimensions (each 1–5):
//   professionalism | workEnvironment | ethics | team
//
// quality_score_for_job = mean(4 dimension scores)
//   • If the doctor was a no-show for the assignment → quality_score_for_job = 1.0 (floor)
//
// average_quality_score (stored in Doctor.platformStats.rating, default 4.0)
//   = mean of all quality_score_for_job values across all completed assignments
//   Used as a MULTIPLIER in the matching algorithm: final_score *= avg_quality_score

import { Op } from 'sequelize';
import { Feedback } from '../models/Feedback.model';
import { Assignment } from '../models/Assignment.model';
import { Attendance } from '../models/Attendance.model';
import { Doctor } from '../models/Doctor.model';
import { Hospital } from '../models/Hospital.model';
import { User } from '../models/User.model';
import { FeedbackType, AttendanceStatus } from '../models/types';
import { AppError } from '../middleware';
import { logger } from '../utils/logger';

// ─── CareChainX default quality score ─────────────────────────────────────────
/** Default rating for new doctors / hospitals with no feedback history. */
const DEFAULT_QUALITY_SCORE = 4.0;

/** Minimum quality score awarded even for a no-show (floor, not zero). */
const NO_SHOW_QUALITY_FLOOR = 1.0;

// ─── Doctor feedback dimension keys (Hospital → Doctor) ───────────────────────
const DOCTOR_DIMENSIONS: string[] = ['competence', 'ethics', 'teamwork', 'conduct'];

// ─── Hospital feedback dimension keys (Doctor → Hospital) ─────────────────────
const HOSPITAL_DIMENSIONS: string[] = ['professionalism', 'workEnvironment', 'ethics', 'team'];

// ─── Public input type ─────────────────────────────────────────────────────────

export interface SubmitFeedbackData {
  assignmentId: string;
  rating: number;         // overall 1–5 (used as fallback if detailedRatings absent)
  comment?: string;
  testimonial?: string;
  /**
   * For Hospital → Doctor:  { competence, ethics, teamwork, conduct }
   * For Doctor → Hospital:  { professionalism, workEnvironment, ethics, team }
   * All values must be 1–5.
   */
  detailedRatings?: Record<string, number>;
}

class FeedbackService {
  // ─── Submit ─────────────────────────────────────────────────────────────────

  /**
   * Submit feedback for a completed assignment.
   * Computes quality_score_for_job and asynchronously updates average_quality_score.
   */
  async submitFeedback(
    reviewerId: string,
    reviewerRole: string,
    data: SubmitFeedbackData
  ): Promise<Feedback> {
    const assignment = await Assignment.findByPk(data.assignmentId);
    if (!assignment) throw new AppError('Assignment not found', 404);

    const isDoctor = assignment.doctorId === reviewerId;
    const isHospital = assignment.hospitalId === reviewerId;

    if (!isDoctor && !isHospital) throw new AppError('You are not a participant in this assignment', 403);
    if (reviewerRole === 'doctor' && !isDoctor) throw new AppError('Forbidden', 403);
    if (reviewerRole === 'hospital' && !isHospital) throw new AppError('Forbidden', 403);

    const existing = await Feedback.findOne({ where: { assignmentId: data.assignmentId, reviewerId } });
    if (existing) throw new AppError('Feedback already submitted for this assignment', 400);

    const type =
      reviewerRole === 'hospital'
        ? FeedbackType.HOSPITAL_TO_DOCTOR
        : FeedbackType.DOCTOR_TO_HOSPITAL;

    const revieweeId =
      type === FeedbackType.HOSPITAL_TO_DOCTOR ? assignment.doctorId : assignment.hospitalId;

    // ── Compute quality_score_for_job (CareChainX formula) ──────────────────
    const wasNoShow = await this.checkNoShow(assignment.doctorId, data.assignmentId);
    const qualityScoreForJob = wasNoShow
      ? NO_SHOW_QUALITY_FLOOR
      : this.computeQualityScoreForJob(
          data.detailedRatings,
          type === FeedbackType.HOSPITAL_TO_DOCTOR ? DOCTOR_DIMENSIONS : HOSPITAL_DIMENSIONS,
          data.rating
        );

    const feedback = await Feedback.create({
      assignmentId: data.assignmentId,
      reviewerId,
      revieweeId,
      type,
      rating: data.rating,
      comment: data.comment,
      detailedRatings: data.detailedRatings ?? null,
      testimonial: data.testimonial,
      qualityScoreForJob,
    });

    // Recalculate average_quality_score asynchronously (non-blocking)
    this.recalculateAverageQualityScore(revieweeId, type).catch((err) =>
      logger.warn(`avg_quality_score update failed for ${revieweeId}:`, err)
    );

    return feedback;
  }

  // ─── Read ────────────────────────────────────────────────────────────────────

  async getAssignmentFeedback(assignmentId: string, requesterId: string): Promise<Feedback[]> {
    const assignment = await Assignment.findByPk(assignmentId);
    if (!assignment) throw new AppError('Assignment not found', 404);

    if (assignment.doctorId !== requesterId && assignment.hospitalId !== requesterId) {
      throw new AppError('Not authorized to view feedback for this assignment', 403);
    }

    return Feedback.findAll({
      where: { assignmentId },
      include: [
        { model: User, as: 'reviewer', attributes: ['id', 'fullName', 'avatar'] },
        { model: User, as: 'reviewee', attributes: ['id', 'fullName', 'avatar'] },
      ],
      order: [['createdAt', 'DESC']],
    });
  }

  async getUserFeedbacks(targetUserId: string): Promise<Feedback[]> {
    return Feedback.findAll({
      where: { revieweeId: targetUserId },
      include: [{ model: User, as: 'reviewer', attributes: ['id', 'fullName', 'avatar'] }],
      order: [['createdAt', 'DESC']],
    });
  }

  // ─── Core quality score logic (CareChainX exact) ─────────────────────────────

  /**
   * Compute quality_score_for_job from dimension scores.
   *
   * Formula: simple arithmetic mean of the known dimension values (1–5 each).
   * Falls back to the overall `rating` field when no recognised dimensions are present.
   *
   * Matches CareChainX: each of the 4 fields contributes equally to the per-job score.
   */
  private computeQualityScoreForJob(
    detailedRatings: Record<string, number> | undefined | null,
    dimensions: string[],
    fallbackRating: number
  ): number {
    if (!detailedRatings) return fallbackRating;

    const values = dimensions
      .map((dim) => detailedRatings[dim])
      .filter((v): v is number => typeof v === 'number' && v >= 1 && v <= 5);

    if (values.length === 0) return fallbackRating;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.round(mean * 100) / 100; // round to 2 dp
  }

  /**
   * Check whether the doctor was a no-show for this assignment.
   * A no-show = an ABSENT attendance record exists for the assignment.
   */
  private async checkNoShow(doctorId: string, assignmentId: string): Promise<boolean> {
    const count = await Attendance.count({
      where: {
        doctorId,
        assignmentId,
        status: AttendanceStatus.ABSENT,
      },
    });
    return count > 0;
  }

  /**
   * Recalculate and persist average_quality_score for a user after new feedback.
   *
   * Formula (CareChainX):
   *   average_quality_score = mean(all quality_score_for_job values for this user)
   *
   * Stored in:
   *   Doctor  → platformStats.rating   (0–5 scale, default 4.0)
   *   Hospital → hospitalStats.rating  (0–5 scale, default 4.0)
   */
  async recalculateAverageQualityScore(
    userId: string,
    feedbackType: FeedbackType
  ): Promise<number> {
    const feedbacks = await Feedback.findAll({
      where: { revieweeId: userId, type: feedbackType },
      attributes: ['qualityScoreForJob'],
    });

    if (feedbacks.length === 0) return DEFAULT_QUALITY_SCORE;

    const scores = feedbacks
      .map((f) => f.qualityScoreForJob ?? 0)
      .filter((s) => s > 0);

    const avgScore =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : DEFAULT_QUALITY_SCORE;

    const rounded = Math.round(avgScore * 100) / 100;

    await this.persistAverageQualityScore(userId, feedbackType, rounded, feedbacks.length);

    logger.debug(
      `avg_quality_score for ${userId}: ${rounded} (${feedbacks.length} feedbacks)`
    );
    return rounded;
  }

  /** Write average_quality_score to the correct profile model. */
  private async persistAverageQualityScore(
    userId: string,
    feedbackType: FeedbackType,
    avgScore: number,
    totalReviews: number
  ): Promise<void> {
    if (feedbackType === FeedbackType.HOSPITAL_TO_DOCTOR) {
      const doctor = await Doctor.findOne({ where: { userId } });
      if (!doctor) return;

      const stats = doctor.platformStats ?? {
        jobsCompleted: 0, totalShifts: 0, noShows: 0,
        attendanceRate: 100, rating: DEFAULT_QUALITY_SCORE,
        totalReviews: 0, performanceScore: 0,
      };
      stats.rating = avgScore;                           // 0–5 scale for matching multiplier
      stats.performanceScore = Math.round(avgScore / 5 * 100); // 0–100 for display
      stats.totalReviews = totalReviews;

      await doctor.update({ platformStats: stats });
    } else {
      const hospital = await Hospital.findOne({ where: { userId } });
      if (!hospital) return;

      const stats = hospital.hospitalStats ?? {
        totalEmployees: 0, activeJobs: 0, totalJobsPosted: 0,
        totalHires: 0, rating: DEFAULT_QUALITY_SCORE, totalReviews: 0,
      };
      stats.rating = avgScore;
      stats.totalReviews = totalReviews;

      await hospital.update({ hospitalStats: stats });
    }
  }

  /**
   * Externally-callable refresh (used by admin module).
   */
  async refreshUserScore(userId: string, role: 'doctor' | 'hospital'): Promise<void> {
    const type =
      role === 'doctor'
        ? FeedbackType.HOSPITAL_TO_DOCTOR
        : FeedbackType.DOCTOR_TO_HOSPITAL;

    await this.recalculateAverageQualityScore(userId, type).catch((err) =>
      logger.warn(`Manual score refresh failed for ${userId}:`, err)
    );
  }
}

export const feedbackService = new FeedbackService();
export default feedbackService;
