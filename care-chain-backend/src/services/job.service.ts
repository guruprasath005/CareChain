// src/services/job.service.ts
// Job Management Service

import { Job } from '../models/Job.model';
import { Application } from '../models/Application.model';
import { Hospital } from '../models/Hospital.model';
import { User } from '../models/User.model';
import { JobStatus, JobType, ApplicationStatus } from '../models/types';
import { logger } from '../utils/logger';
import { Op, WhereOptions, Sequelize } from 'sequelize';
import {
    Duration,
    Shift,
    Address,
    Compensation,
    Requirements,
    Facilities,
    ApplicationSettings,
} from '../models/types';

export interface CreateJobData {
    title: string;
    description: string;
    specialization: string;
    department?: string;
    jobType: JobType;
    duration: Duration;
    shift: Shift;
    location: Address;
    compensation: Compensation;
    requirements: Requirements;
    facilities?: Facilities;
    applicationSettings?: ApplicationSettings;
    isUrgent?: boolean;
    isFeatured?: boolean;
    expiresAt?: Date;
}

export interface UpdateJobData extends Partial<CreateJobData> {
    status?: JobStatus;
}

export interface JobSearchFilters {
    specialization?: string;
    city?: string;
    state?: string;
    jobType?: JobType;
    minSalary?: number;
    maxSalary?: number;
    isUrgent?: boolean;
    hospitalId?: string;
    status?: JobStatus;
    search?: string;
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
 * Job Service
 * Handles job posting and management
 */
class JobService {
    /**
     * Create a new job posting
     */
    async createJob(hospitalId: string, data: CreateJobData): Promise<Job> {
        // Validate hospital exists
        const hospital = await Hospital.findOne({ where: { userId: hospitalId } });
        if (!hospital) {
            throw new Error('Hospital not found');
        }

        const job = await Job.create({
            hospitalId,
            ...data,
            status: JobStatus.DRAFT,
            stats: {
                views: 0,
                applications: 0,
                shortlisted: 0,
                interviewed: 0,
                hired: 0,
                rejected: 0,
            },
        });

        // Update hospital stats
        hospital.hospitalStats = {
            ...hospital.hospitalStats,
            totalJobsPosted: (hospital.hospitalStats?.totalJobsPosted || 0) + 1,
        };
        await hospital.save();

        logger.info(`Job created: ${job.id} by hospital ${hospitalId}`);
        return job;
    }

    /**
     * Get job by ID
     */
    async getJobById(jobId: string): Promise<Job | null> {
        return Job.findByPk(jobId, {
            include: [
                {
                    association: 'hospital',
                    include: [{ association: 'hospitalProfile' }],
                },
            ],
        });
    }

    /**
     * Get job with application count
     */
    async getJobWithStats(jobId: string): Promise<Job | null> {
        const job = await Job.findByPk(jobId, {
            include: [
                {
                    association: 'hospital',
                    attributes: ['id', 'fullName'],
                    include: [{
                        association: 'hospitalProfile',
                        attributes: ['hospitalName', 'hospitalType', 'address', 'images'],
                    }],
                },
                {
                    association: 'applications',
                    attributes: ['id', 'status'],
                },
            ],
        });

        return job;
    }

    /**
     * Update job
     */
    async updateJob(jobId: string, hospitalId: string, data: UpdateJobData): Promise<Job> {
        const job = await Job.findOne({
            where: { id: jobId, hospitalId },
        });

        if (!job) {
            throw new Error('Job not found or you do not have permission to edit it');
        }

        // Prevent editing filled/closed jobs
        if ([JobStatus.FILLED, JobStatus.CLOSED, JobStatus.CANCELLED].includes(job.status)) {
            throw new Error('Cannot edit a closed or filled job');
        }

        await job.update(data);

        logger.debug(`Job updated: ${jobId}`);
        return job;
    }

    /**
     * Publish job (make it open/visible)
     */
    async publishJob(jobId: string, hospitalId: string): Promise<Job> {
        const job = await Job.findOne({
            where: { id: jobId, hospitalId },
        });

        if (!job) {
            throw new Error('Job not found');
        }

        if (job.status !== JobStatus.DRAFT && job.status !== JobStatus.PAUSED) {
            throw new Error('Only draft or paused jobs can be published');
        }

        job.status = JobStatus.OPEN;
        job.publishedAt = new Date();
        await job.save();

        // Update hospital active jobs count
        const hospital = await Hospital.findOne({ where: { userId: hospitalId } });
        if (hospital) {
            hospital.hospitalStats = {
                ...hospital.hospitalStats,
                activeJobs: (hospital.hospitalStats?.activeJobs || 0) + 1,
            };
            await hospital.save();
        }

        logger.info(`Job published: ${jobId}`);
        return job;
    }

    /**
     * Pause job
     */
    async pauseJob(jobId: string, hospitalId: string): Promise<Job> {
        const job = await Job.findOne({
            where: { id: jobId, hospitalId },
        });

        if (!job) {
            throw new Error('Job not found');
        }

        if (job.status !== JobStatus.OPEN) {
            throw new Error('Only open jobs can be paused');
        }

        job.status = JobStatus.PAUSED;
        await job.save();

        logger.debug(`Job paused: ${jobId}`);
        return job;
    }

    /**
     * Close job
     */
    async closeJob(jobId: string, hospitalId: string, reason?: string): Promise<Job> {
        const job = await Job.findOne({
            where: { id: jobId, hospitalId },
        });

        if (!job) {
            throw new Error('Job not found');
        }

        job.status = JobStatus.CLOSED;
        job.closedAt = new Date();
        job.closedReason = reason || null;
        await job.save();

        // Update hospital active jobs count
        const hospital = await Hospital.findOne({ where: { userId: hospitalId } });
        if (hospital && hospital.hospitalStats?.activeJobs) {
            hospital.hospitalStats = {
                ...hospital.hospitalStats,
                activeJobs: Math.max(0, hospital.hospitalStats.activeJobs - 1),
            };
            await hospital.save();
        }

        logger.info(`Job closed: ${jobId}`);
        return job;
    }

    /**
     * Mark job as filled
     */
    async markJobAsFilled(jobId: string, hospitalId: string): Promise<Job> {
        const job = await Job.findOne({
            where: { id: jobId, hospitalId },
        });

        if (!job) {
            throw new Error('Job not found');
        }

        job.status = JobStatus.FILLED;
        job.closedAt = new Date();
        await job.save();

        logger.info(`Job marked as filled: ${jobId}`);
        return job;
    }

    /**
     * Increment job view count
     */
    async incrementViews(jobId: string): Promise<void> {
        const job = await Job.findByPk(jobId);
        if (job && job.stats) {
            job.stats = {
                ...job.stats,
                views: (job.stats.views || 0) + 1,
            };
            await job.save();
        }
    }

    /**
     * Search and filter jobs
     */
    async searchJobs(filters: JobSearchFilters): Promise<PaginatedResult<Job>> {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;

        const where: WhereOptions<Job> = {
            status: filters.status || JobStatus.OPEN,
        };

        if (filters.hospitalId) {
            (where as any).hospitalId = filters.hospitalId;
        }

        if (filters.specialization) {
            (where as any).specialization = filters.specialization;
        }

        if (filters.jobType) {
            (where as any).jobType = filters.jobType;
        }

        if (filters.isUrgent !== undefined) {
            (where as any).isUrgent = filters.isUrgent;
        }

        if (filters.search) {
            (where as any)[Op.or] = [
                { title: { [Op.iLike]: `%${filters.search}%` } },
                { description: { [Op.iLike]: `%${filters.search}%` } },
                { specialization: { [Op.iLike]: `%${filters.search}%` } },
            ];
        }

        // Run sequentially
        const count = await Job.count({ where: { ...where } });
        const rows = await Job.findAll({
            where,
            limit,
            offset,
            include: [
                {
                    association: 'hospital',
                    attributes: ['id', 'fullName'],
                    include: [{
                        association: 'hospitalProfile',
                        attributes: ['hospitalName', 'address', 'images'],
                    }],
                },
            ],
            order: [
                ['isUrgent', 'DESC'],
                ['isFeatured', 'DESC'],
                ['createdAt', 'DESC'],
            ],
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
     * Get featured jobs
     */
    async getFeaturedJobs(limit: number = 10): Promise<Job[]> {
        return Job.findAll({
            where: {
                status: JobStatus.OPEN,
                isFeatured: true,
            },
            limit,
            include: [
                {
                    association: 'hospital',
                    attributes: ['id', 'fullName'],
                    include: [{
                        association: 'hospitalProfile',
                        attributes: ['hospitalName', 'address', 'images'],
                    }],
                },
            ],
            order: [['createdAt', 'DESC']],
        });
    }

    /**
     * Get urgent jobs
     */
    async getUrgentJobs(limit: number = 10): Promise<Job[]> {
        return Job.findAll({
            where: {
                status: JobStatus.OPEN,
                isUrgent: true,
            },
            limit,
            include: [
                {
                    association: 'hospital',
                    attributes: ['id', 'fullName'],
                    include: [{
                        association: 'hospitalProfile',
                        attributes: ['hospitalName', 'address'],
                    }],
                },
            ],
            order: [['createdAt', 'DESC']],
        });
    }

    /**
     * Get jobs by hospital
     */
    async getHospitalJobs(
        hospitalId: string,
        status?: JobStatus,
        page: number = 1,
        limit: number = 20,
        searchQuery?: string,
        filters?: {
            status?: string;
            datePosted?: string;
            minApplicants?: number;
            maxApplicants?: number;
        }
    ): Promise<PaginatedResult<Job>> {
        const offset = (page - 1) * limit;

        const where: any = { hospitalId: String(hospitalId) };
        if (status) {
            where.status = status;
        }

        // Add search query filter (Requirements 14.1, 14.3, 14.4)
        if (searchQuery && searchQuery.trim()) {
            const query = searchQuery.trim();
            // Case-insensitive partial matching on title and specialization
            where[Op.or] = [
                Sequelize.where(
                    Sequelize.fn('LOWER', Sequelize.col('title')),
                    { [Op.like]: `%${query.toLowerCase()}%` }
                ),
                Sequelize.where(
                    Sequelize.fn('LOWER', Sequelize.col('specialization')),
                    { [Op.like]: `%${query.toLowerCase()}%` }
                ),
            ];
        }

        // Add filter parameters (Requirement 14.2)
        if (filters) {
            // Status filter
            if (filters.status) {
                where.status = filters.status;
            }

            // Date posted filter
            if (filters.datePosted) {
                const now = new Date();
                let startDate: Date;

                switch (filters.datePosted) {
                    case 'last_24h':
                        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                        break;
                    case 'last_7d':
                        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        break;
                    case 'last_30d':
                        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        break;
                    case 'last_3m':
                        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                        break;
                    default:
                        startDate = new Date(0); // Beginning of time
                }

                where.createdAt = { [Op.gte]: startDate };
            }

            // Applicant count filter - need to use a subquery or join
            if (filters.minApplicants !== undefined || filters.maxApplicants !== undefined) {
                // We'll filter this after fetching since it requires counting applications
                // This is a limitation of the current schema - ideally we'd have a cached count
            }
        }

        // Run sequentially to prevent any race conditions or transaction issues
        try {
            const count = await Job.count({ where: { ...where } });
            const rows = await Job.findAll({
                where,
                limit,
                offset,
                order: [['createdAt', 'DESC']],
                include: [
                    {
                        model: Application,
                        as: 'applications',
                        attributes: ['id', 'status'],
                        required: false,
                    },
                ],
            });

            // Filter by applicant count if needed (post-query filtering)
            let filteredRows = rows;
            if (filters?.minApplicants !== undefined || filters?.maxApplicants !== undefined) {
                filteredRows = rows.filter((job: any) => {
                    const applicantCount = job.applications?.length || 0;
                    if (filters.minApplicants !== undefined && applicantCount < filters.minApplicants) {
                        return false;
                    }
                    if (filters.maxApplicants !== undefined && applicantCount > filters.maxApplicants) {
                        return false;
                    }
                    return true;
                });
            }

            const totalPages = Math.ceil(count / limit);

            return {
                data: filteredRows,
                meta: {
                    page,
                    limit,
                    totalItems: filteredRows.length,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1,
                },
            };
        } catch (error) {
            logger.error(`Error fetching hospital jobs: ${error}`);
            throw error;
        }
    }

    /**
     * Get filter options for job search
     */
    async getFilterOptions(): Promise<{
        specializations: string[];
        jobTypes: string[];
        cities: string[];
    }> {
        // Get distinct specializations
        const specializations = await Job.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('specialization')), 'specialization']],
            where: { status: JobStatus.OPEN },
            raw: true,
        });

        return {
            specializations: specializations.map((s: any) => s.specialization).filter(Boolean),
            jobTypes: Object.values(JobType),
            cities: [], // Would need to aggregate from location JSONB
        };
    }

    /**
     * Update job statistics
     */
    async updateJobStats(
        jobId: string,
        field: keyof Job['stats'],
        increment: number = 1
    ): Promise<void> {
        const job = await Job.findByPk(jobId);
        if (!job || !job.stats) return;

        job.stats = {
            ...job.stats,
            [field]: ((job.stats[field] as number) || 0) + increment,
        };
        await job.save();
    }

    /**
     * Check if job is accepting applications
     */
    isAcceptingApplications(job: Job): boolean {
        if (job.status !== JobStatus.OPEN) {
            return false;
        }

        // Check max applicants
        if (job.applicationSettings?.maxApplicants) {
            if (job.stats?.applications >= job.applicationSettings.maxApplicants) {
                return false;
            }
        }

        // Check expiry
        if (job.expiresAt && new Date() > job.expiresAt) {
            return false;
        }

        return true;
    }

    /**
     * Delete job (soft delete by setting status to trash)
     */
    async deleteJob(jobId: string, hospitalId: string): Promise<void> {
        const job = await Job.findOne({
            where: { id: jobId, hospitalId },
        });

        if (!job) {
            throw new Error('Job not found');
        }

        // We allow moving to trash even if there are active assignments
        // The check for active assignments is only needed for permanent deletion

        job.status = JobStatus.TRASH;
        await job.save();

        logger.info(`Job moved to trash: ${jobId}`);
    }

    /**
     * Restore job from trash
     */
    async restoreJob(jobId: string, hospitalId: string): Promise<Job> {
        const job = await Job.findOne({
            where: { id: jobId, hospitalId },
        });

        if (!job) {
            throw new Error('Job not found');
        }

        if (job.status !== JobStatus.TRASH) {
            throw new Error('Job is not in trash');
        }

        // Restore to DRAFT or OPEN? Let's restore to DRAFT for safety, or previous status if we tracked it.
        // For now, restoring to DRAFT is safer.
        job.status = JobStatus.DRAFT;
        await job.save();

        logger.info(`Job restored from trash: ${jobId}`);
        return job;
    }

    /**
     * Permanently delete job
     */
    async deleteJobPermanently(jobId: string, hospitalId: string): Promise<void> {
        const job = await Job.findOne({
            where: { id: jobId, hospitalId },
        });

        if (!job) {
            throw new Error('Job not found');
        }

        if (job.status !== JobStatus.TRASH) {
            throw new Error('Only trashed jobs can be permanently deleted');
        }

        // We allow permanent deletion even if there are active assignments
        // Database foreign keys should handle cascading deletes if configured, 
        // or it will throw a constraint error which is fine (or we catch it).
        // For now, per user request, we remove the explicit block.

        await job.destroy();

        logger.info(`Job permanently deleted: ${jobId}`);
    }

    /**
     * Get similar jobs
     */
    async getSimilarJobs(jobId: string, limit: number = 5): Promise<Job[]> {
        const job = await Job.findByPk(jobId);
        if (!job) {
            return [];
        }

        return Job.findAll({
            where: {
                id: { [Op.ne]: jobId },
                status: JobStatus.OPEN,
                specialization: job.specialization,
            },
            limit,
            order: [['createdAt', 'DESC']],
        });
    }
}

// Export singleton instance
export const jobService = new JobService();
export default jobService;
