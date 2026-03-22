// src/controllers/job.controller.ts
// Job Controller - Full implementations using services

import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { ApiResponse } from '../utils/response';
import { jobService } from '../services/job.service';
import { applicationService } from '../services/application.service';
import { recommendationService } from '../services/recommendation.service';
import { JobType, JobStatus } from '../models/types';

/**
 * Job Controller - Public and Doctor actions
 */
export const jobController = {
  // =====================================
  // PUBLIC JOB ROUTES (No auth required)
  // =====================================

  /**
   * GET /jobs
   * Search/list jobs (public)
   */
  async searchJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        q,
        specialization,
        city,
        state,
        jobType,
        minSalary,
        maxSalary,
        page = '1',
        limit = '20',
      } = req.query;

      const result = await jobService.searchJobs({
        search: q as string,
        specialization: specialization as string,
        city: city as string,
        state: state as string,
        jobType: jobType as JobType,
        minSalary: minSalary ? Number(minSalary) : undefined,
        maxSalary: maxSalary ? Number(maxSalary) : undefined,
        page: Number(page),
        limit: Number(limit),
        status: JobStatus.OPEN,
      });

      ApiResponse.paginated(
        res,
        result.data,
        result.meta.page,
        result.meta.limit,
        result.meta.totalItems,
        'Jobs retrieved'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /jobs/filters
   * Get available filter options
   */
  async getFilters(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const options = await jobService.getFilterOptions();
      ApiResponse.success(res, {
        specializations: options.specializations,
        locations: options.cities,
        jobTypes: options.jobTypes,
        salaryRanges: [
          { min: 0, max: 50000, label: 'Up to ₹50,000' },
          { min: 50000, max: 100000, label: '₹50,000 - ₹1,00,000' },
          { min: 100000, max: 200000, label: '₹1,00,000 - ₹2,00,000' },
          { min: 200000, max: null, label: '₹2,00,000+' },
        ],
      }, 'Filters retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /jobs/featured
   * Get featured jobs
   */
  async getFeaturedJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = Number(req.query.limit) || 10;
      const jobs = await jobService.getFeaturedJobs(limit);
      ApiResponse.success(res, { jobs }, 'Featured jobs retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /jobs/recent
   * Get recently posted jobs
   */
  async getRecentJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = Number(req.query.limit) || 10;
      const result = await jobService.searchJobs({
        status: JobStatus.OPEN,
        page: 1,
        limit,
      });
      ApiResponse.success(res, { jobs: result.data }, 'Recent jobs retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /jobs/:id
   * Get job details (public view)
   */
  async getJobDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const job = await jobService.getJobWithStats(id);

      if (!job) {
        ApiResponse.notFound(res, 'Job not found');
        return;
      }

      // Increment view count asynchronously
      jobService.incrementViews(id).catch(() => { });

      // Transform hospital info for frontend
      const hospitalProfile = (job.hospital as any)?.hospitalProfile;
      const jobData = {
        ...job.toJSON(),
        hospital: {
          id: job.hospital?.id,
          name: hospitalProfile?.hospitalName || job.hospital?.fullName,
          type: hospitalProfile?.hospitalType,
          logo: hospitalProfile?.images?.logo,
          address: hospitalProfile?.address,
        },
        applicationsCount: job.applications?.length || 0,
      };

      ApiResponse.success(res, { job: jobData }, 'Job details retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /jobs/:id/similar
   * Get similar jobs
   */
  async getSimilarJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const limit = Number(req.query.limit) || 5;

      const jobs = await recommendationService.getSimilarJobs(id, limit);
      ApiResponse.success(res, { jobs }, 'Similar jobs retrieved');
    } catch (error) {
      next(error);
    }
  },

  // =====================================
  // DOCTOR JOB ACTIONS (Auth required)
  // =====================================

  /**
   * POST /jobs/:id/apply
   * Apply to a job
   */
  async applyToJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: jobId } = req.params;
      const doctorId = req.user!.id;
      const { coverLetter, expectedCompensation, availableFrom, questionnaireResponses } = req.body;

      const application = await applicationService.applyToJob(doctorId, jobId, {
        coverLetter,
        expectedCompensation,
        availableFrom: availableFrom ? new Date(availableFrom) : undefined,
        questionnaireResponses,
      });

      ApiResponse.created(res, { application }, 'Application submitted successfully');
    } catch (error: any) {
      if (error.message.includes('already applied') || error.message.includes('not accepting')) {
        ApiResponse.badRequest(res, error.message);
        return;
      }
      next(error);
    }
  },

  /**
   * DELETE /jobs/:id/application
   * Withdraw job application
   */
  async withdrawApplication(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: jobId } = req.params;
      const doctorId = req.user!.id;
      const { reason } = req.body;

      // Find the application first
      const applications = await applicationService.getApplications({
        jobId,
        doctorId,
        limit: 1,
      });

      if (applications.data.length === 0) {
        ApiResponse.notFound(res, 'Application not found');
        return;
      }

      const applicationId = applications.data[0].id;
      await applicationService.withdrawApplication(applicationId, doctorId, reason);

      ApiResponse.success(res, null, 'Application withdrawn successfully');
    } catch (error: any) {
      if (error.message.includes('Cannot withdraw')) {
        ApiResponse.badRequest(res, error.message);
        return;
      }
      next(error);
    }
  },
};

export default jobController;
