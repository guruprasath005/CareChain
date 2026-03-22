// src/controllers/recommendation.controller.ts
// Recommendation Controller - Job and candidate matching

import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { ApiResponse } from '../utils/response';
import { recommendationService } from '../services/recommendation.service';

/**
 * Recommendation Controller
 * Handles personalized job and candidate recommendations
 */
export const recommendationController = {
    /**
     * GET /recommendations/jobs
     * Get recommended jobs for doctor
     */
    async getRecommendedJobs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.id;
            const { page = '1', limit = '20' } = req.query;

            const result = await recommendationService.getRecommendedJobsForDoctor(
                userId,
                Number(page),
                Number(limit)
            );

            // Transform for frontend
            const jobs = result.jobs.map(r => ({
                ...r.job.toJSON(),
                matchScore: r.matchScore,
                matchDetails: r.matchDetails,
                hasApplied: r.hasApplied,
            }));

            ApiResponse.paginated(
                res,
                jobs,
                Number(page),
                Number(limit),
                result.total,
                'Recommended jobs retrieved'
            );
        } catch (error: any) {
            if (error.message.includes('not found')) {
                ApiResponse.notFound(res, 'Doctor profile not found. Complete your profile first.');
                return;
            }
            next(error);
        }
    },

    /**
     * GET /recommendations/quick
     * Get quick job recommendations (top matches)
     */
    async getQuickRecommendations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.id;
            const { limit = '5' } = req.query;

            const jobs = await recommendationService.getQuickRecommendations(userId, Number(limit));

            const recommendations = jobs.map(r => ({
                ...r.job.toJSON(),
                matchScore: r.matchScore,
                matchDetails: r.matchDetails,
            }));

            ApiResponse.success(res, { recommendations }, 'Quick recommendations retrieved');
        } catch (error: any) {
            if (error.message.includes('not found')) {
                ApiResponse.success(res, { recommendations: [] }, 'No recommendations available');
                return;
            }
            next(error);
        }
    },

    /**
     * GET /recommendations/candidates/:jobId
     * Get recommended candidates for a job (hospital only)
     */
    async getRecommendedCandidates(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.id;
            const { jobId } = req.params;
            const { page = '1', limit = '20' } = req.query;

            const result = await recommendationService.getRecommendedCandidatesForJob(
                jobId,
                userId,
                Number(page),
                Number(limit)
            );

            // Transform for frontend
            const candidates = result.candidates.map(c => ({
                id: c.doctor.id,
                userId: c.doctor.userId,
                fullName: c.user?.fullName,
                email: c.user?.email,
                avatar: c.user?.avatarUrl,
                specialization: c.doctor.specialization,
                subSpecializations: c.doctor.subSpecializations,
                yearsOfExperience: c.doctor.yearsOfExperience,
                address: c.doctor.address,
                matchScore: c.matchScore,
                matchDetails: c.matchDetails,
            }));

            ApiResponse.paginated(
                res,
                candidates,
                Number(page),
                Number(limit),
                result.total,
                'Recommended candidates retrieved'
            );
        } catch (error: any) {
            if (error.message.includes('not found')) {
                ApiResponse.notFound(res, 'Job not found');
                return;
            }
            next(error);
        }
    },

    /**
     * GET /recommendations/match-score/:jobId
     * Get match score for doctor-job pair
     */
    async getMatchScore(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.id;
            const { jobId } = req.params;

            const result = await recommendationService.getMatchScore(userId, jobId);

            ApiResponse.success(res, {
                matchScore: result.score,
                matchDetails: result.details,
            }, 'Match score retrieved');
        } catch (error: any) {
            if (error.message.includes('not found')) {
                ApiResponse.success(res, { matchScore: null, matchDetails: null }, 'Match score not available');
                return;
            }
            next(error);
        }
    },

    /**
     * GET /recommendations/weights
     * Get current recommendation weights (admin/debug)
     */
    async getWeights(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const weights = recommendationService.getWeights();
            ApiResponse.success(res, { weights }, 'Weights retrieved');
        } catch (error) {
            next(error);
        }
    },
};

export default recommendationController;
