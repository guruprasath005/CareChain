// src/controllers/feedback.controller.ts
import { Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/response';
import { feedbackService } from '../services/feedback.service';
import { AuthRequest } from '../types';

export const feedbackController = {
  /**
   * POST /feedback/submit
   * Submit feedback for an assignment.
   * The caller must be a direct participant (doctor or hospital) of the assignment.
   */
  async submitFeedback(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const reviewerId = req.user!.id;
      const reviewerRole = req.user!.role as string;
      const { assignmentId, rating, comment, detailedRatings, testimonial } = req.body;

      const feedback = await feedbackService.submitFeedback(reviewerId, reviewerRole, {
        assignmentId,
        rating,
        comment,
        detailedRatings,
        testimonial,
      });

      ApiResponse.created(res, feedback, 'Feedback submitted successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /feedback/assignment/:assignmentId
   * Get feedback for a specific assignment.
   * Only the doctor or hospital on the assignment may read it.
   */
  async getAssignmentFeedback(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { assignmentId } = req.params;
      const requesterId = req.user!.id;

      const feedbacks = await feedbackService.getAssignmentFeedback(assignmentId, requesterId);
      ApiResponse.success(res, feedbacks, 'Feedbacks retrieved successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /feedback/user/:userId?
   * Get feedbacks received by a user.
   * A user may only fetch their own received feedback.
   */
  async getUserFeedbacks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const requesterId = req.user!.id;
      const targetUserId = req.params.userId || requesterId;

      if (targetUserId !== requesterId) {
        // Allow hospitals to view a doctor's public feedback
        // but never allow arbitrary cross-user reads
        const { AppError } = await import('../middleware');
        throw new AppError('You can only view your own received feedback', 403);
      }

      const feedbacks = await feedbackService.getUserFeedbacks(targetUserId);
      ApiResponse.success(res, feedbacks, 'User feedbacks retrieved successfully');
    } catch (error) {
      next(error);
    }
  },
};

export default feedbackController;
