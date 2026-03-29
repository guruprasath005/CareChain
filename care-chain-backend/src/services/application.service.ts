// src/services/application.service.ts
// Job Application Service

import { Application } from '../models/Application.model';
import { Job } from '../models/Job.model';
import { User } from '../models/User.model';
import { Doctor } from '../models/Doctor.model';
import { Hospital } from '../models/Hospital.model';
import { Assignment } from '../models/Assignment.model';
import { ApplicationStatus, JobStatus, AssignmentStatus } from '../models/types';
import { jobService } from './job.service';
import { emailService } from './email.service';
import { logger } from '../utils/logger';
import { sequelize } from '../config/database';
import { Op } from 'sequelize';
import { Compensation, Interview, Offer, OfferStatus } from '../models/types';
import { messageService } from './message.service';
import { emitToUser } from '../config/socket';

export interface ApplyJobData {
    coverLetter?: string;
    expectedCompensation?: Compensation;
    availableFrom?: Date;
    questionnaireResponses?: { question: string; answer: string }[];
}

export interface ApplicationSearchFilters {
    status?: ApplicationStatus | ApplicationStatus[];
    jobId?: string;
    doctorId?: string;
    hospitalId?: string;
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
 * Application Service
 * Handles job application workflow
 */
class ApplicationService {
    /**
     * Apply to a job
     */
    async applyToJob(doctorId: string, jobId: string, data: ApplyJobData): Promise<Application> {
        // Get job
        const job = await Job.findByPk(jobId, {
            include: [{ association: 'hospital' }],
        });

        if (!job) {
            throw new Error('Job not found');
        }

        // Check if job is accepting applications
        if (!jobService.isAcceptingApplications(job)) {
            throw new Error('This job is no longer accepting applications');
        }

        // Check if already applied
        const existingApplication = await Application.findOne({
            where: { doctorId, jobId },
        });

        if (existingApplication) {
            throw new Error('You have already applied to this job');
        }

        // Get doctor for match score calculation
        const doctor = await Doctor.findOne({ where: { userId: doctorId } });
        const matchScore = doctor ? this.calculateMatchScore(doctor, job) : null;

        // Create application
        const application = await Application.create({
            jobId,
            doctorId,
            hospitalId: job.hospitalId,
            coverLetter: data.coverLetter,
            expectedCompensation: data.expectedCompensation,
            availableFrom: data.availableFrom,
            questionnaireResponses: data.questionnaireResponses || [],
            status: ApplicationStatus.APPLIED,
            matchScore,
        });

        // Update job stats
        await jobService.updateJobStats(jobId, 'applications', 1);

        logger.info(`Application submitted: ${application.id} for job ${jobId}`);
        return application;
    }

    /**
     * Get application by ID
     */
    async getApplicationById(applicationId: string): Promise<Application | null> {
        return Application.findByPk(applicationId, {
            include: [
                { association: 'job' },
                { association: 'doctor', include: [{ association: 'doctorProfile' }] },
                { association: 'applicationHospital', include: [{ association: 'hospitalProfile' }] },
            ],
        });
    }

    /**
     * Get applications with filters
     */
    async getApplications(filters: ApplicationSearchFilters): Promise<PaginatedResult<Application>> {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;

        const where: any = {};

        if (filters.status) {
            where.status = Array.isArray(filters.status)
                ? { [Op.in]: filters.status }
                : filters.status;
        }

        if (filters.jobId) {
            where.jobId = filters.jobId;
        }

        if (filters.doctorId) {
            where.doctorId = filters.doctorId;
        }

        if (filters.hospitalId) {
            where.hospitalId = filters.hospitalId;
        }

        const { count, rows } = await Application.findAndCountAll({
            where,
            limit,
            offset,
            include: [
                { association: 'job', attributes: ['id', 'title', 'specialization', 'compensation', 'location'] },
                {
                    association: 'doctor',
                    attributes: ['id', 'fullName', 'avatarUrl', 'email', 'phoneNumber'],
                    include: [
                        {
                            association: 'doctorProfile',
                            attributes: ['specialization', 'yearsOfExperience', 'address', 'skills', 'platformStats']
                        }
                    ]
                },
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
     * Mark application as viewed by hospital
     */
    async markAsViewed(applicationId: string, hospitalId: string): Promise<Application> {
        const application = await Application.findOne({
            where: { id: applicationId, hospitalId },
        });

        if (!application) {
            throw new Error('Application not found');
        }

        if (!application.viewedByHospital) {
            application.viewedByHospital = true;
            application.viewedAt = new Date();
            await application.save();
        }

        return application;
    }

    /**
     * Update application status
     */
    async updateStatus(
        applicationId: string,
        hospitalId: string,
        status: ApplicationStatus,
        notes?: string
    ): Promise<Application> {
        const application = await Application.findOne({
            where: { id: applicationId, hospitalId },
            include: [
                { association: 'job', attributes: ['id', 'title'] },
                { association: 'doctor', attributes: ['id', 'email', 'fullName'] },
                { association: 'applicationHospital', include: [{ association: 'hospitalProfile' }] },
            ],
        });

        if (!application) {
            throw new Error('Application not found');
        }

        // Validate status transition
        this.validateStatusTransition(application.status, status);

        const previousStatus = application.status;
        application.status = status;
        application.addStatusHistory(status, hospitalId, notes);
        await application.save();

        // Update job stats based on status change
        await this.updateJobStatsForStatusChange(application.jobId, previousStatus, status);

        // Send notification email
        const doctor = application.doctor as User;
        const job = application.job as Job;
        const hospital = application.applicationHospital as User;
        const hospitalProfile = (hospital as any).hospitalProfile as Hospital;

        await emailService.sendApplicationStatusEmail(
            doctor.email,
            doctor.fullName,
            job.title,
            hospitalProfile?.hospitalName || hospital.fullName,
            status,
            notes
        );

        // Send in-app notification/message
        await this.sendNotification(application, status, notes);

        logger.info(`Application ${applicationId} status updated to ${status}`);
        return application;
    }

    /**
     * Send in-app notification via message service
     */
    private async sendNotification(
        application: Application,
        status: ApplicationStatus,
        notes?: string
    ): Promise<void> {
        try {
            // Only send notifications for specific statuses that require doctor attention
            const notifyStatuses = [
                ApplicationStatus.SHORTLISTED,
                ApplicationStatus.INTERVIEW_SCHEDULED,
                ApplicationStatus.OFFER_MADE,
                ApplicationStatus.HIRED,
                ApplicationStatus.REJECTED
            ];

            if (!notifyStatuses.includes(status)) {
                return;
            }

            const hospital = application.applicationHospital as User;
            const hospitalProfile = (hospital as any).hospitalProfile as Hospital;
            const hospitalName = hospitalProfile?.hospitalName || hospital.fullName;
            const jobTitle = (application.job as Job)?.title || 'Job';

            let messageContent = `Your application for ${jobTitle} at ${hospitalName} has been updated to: ${status.replace(/_/g, ' ')}.`;

            if (notes) {
                messageContent += `\n\nNote from Hospital: ${notes}`;
            }

            // Create or get conversation
            const conversation = await messageService.getOrCreateConversation({
                doctorId: application.doctorId,
                hospitalId: application.hospitalId,
                jobId: application.jobId,
                applicationId: application.id,
                type: 'application',
                initiatorId: application.hospitalId,
            });

            // Send message
            await messageService.sendMessage({
                conversationId: conversation.id,
                senderId: application.hospitalId,
                senderRole: 'hospital',
                content: messageContent,
                type: 'system', // Use system type so it looks official, or 'text' if we want it to look like chat
                metadata: {
                    applicationId: application.id,
                    status,
                    notes
                }
            });

        } catch (error) {
            logger.error(`Failed to send in-app notification for application ${application.id}:`, error);
            // Don't throw error to avoid failing the status update just because notification failed
        }
    }

    /**
     * Shortlist application
     */
    async shortlistApplication(applicationId: string, hospitalId: string, notes?: string): Promise<Application> {
        return this.updateStatus(applicationId, hospitalId, ApplicationStatus.SHORTLISTED, notes);
    }

    /**
     * Schedule interview
     */
    async scheduleInterview(
        applicationId: string,
        hospitalId: string,
        interview: Interview
    ): Promise<Application> {
        const application = await Application.findOne({
            where: { id: applicationId, hospitalId },
            include: [
                { association: 'job', attributes: ['id', 'title'] },
                { association: 'doctor', attributes: ['id', 'email', 'fullName'] },
                { association: 'applicationHospital', include: [{ association: 'hospitalProfile' }] },
            ],
        });

        if (!application) {
            throw new Error('Application not found');
        }

        application.status = ApplicationStatus.INTERVIEW_SCHEDULED;
        application.interview = interview;
        application.addStatusHistory(ApplicationStatus.INTERVIEW_SCHEDULED, hospitalId);
        await application.save();

        // Send notification email to doctor
        try {
            const doctor = application.doctor as User;
            const job = application.job as Job;
            const hospital = application.applicationHospital as User;
            const hospitalProfile = (hospital as any).hospitalProfile as Hospital;

            await emailService.sendApplicationStatusEmail(
                doctor.email,
                doctor.fullName,
                job.title,
                hospitalProfile?.hospitalName || hospital.fullName,
                ApplicationStatus.INTERVIEW_SCHEDULED,
                undefined
            );
        } catch (error) {
            logger.error(`Failed to send interview scheduled email for application ${applicationId}:`, error);
        }

        // Send in-app notification
        await this.sendNotification(application, ApplicationStatus.INTERVIEW_SCHEDULED);

        logger.info(`Interview scheduled for application ${applicationId}`);
        return application;
    }

    /**
     * Complete interview (record feedback)
     */
    async completeInterview(
        applicationId: string,
        hospitalId: string,
        feedback: string,
        rating?: number
    ): Promise<Application> {
        const application = await Application.findOne({
            where: { id: applicationId, hospitalId },
        });

        if (!application) {
            throw new Error('Application not found');
        }

        if (application.status !== ApplicationStatus.INTERVIEW_SCHEDULED) {
            throw new Error('Interview not scheduled for this application');
        }

        application.status = ApplicationStatus.INTERVIEWED;
        application.interview = {
            ...application.interview,
            feedback,
            rating,
            completedAt: new Date().toISOString(),
        };
        application.addStatusHistory(ApplicationStatus.INTERVIEWED, hospitalId);
        await application.save();

        logger.info(`Interview completed for application ${applicationId}`);
        return application;
    }

    /**
     * Make job offer with full details
     * Sends notification to candidate and email
     */
    async makeOffer(
        applicationId: string,
        hospitalId: string,
        offerData: {
            salary: number;
            salaryType?: string;
            currency?: string;
            joiningDate: string;
            reportingDate: string;
            notes?: string;
            offerConfirmationDate: string;
            terms?: string;
        }
    ): Promise<Application> {
        const application = await Application.findOne({
            where: { id: applicationId, hospitalId },
            include: [
                { association: 'job', attributes: ['id', 'title'] },
                { association: 'doctor', attributes: ['id', 'email', 'fullName'] },
                { association: 'applicationHospital', include: [{ association: 'hospitalProfile' }] },
            ],
        });

        if (!application) {
            throw new Error('Application not found');
        }

        // Create the offer object
        const offer: Offer = {
            amount: offerData.salary,
            salaryType: offerData.salaryType || 'monthly',
            currency: offerData.currency || 'INR',
            startDate: offerData.joiningDate,
            reportingDate: offerData.reportingDate,
            notes: offerData.notes,
            expiresAt: offerData.offerConfirmationDate,
            terms: offerData.terms,
            status: OfferStatus.PENDING,
            madeAt: new Date().toISOString(),
        };

        application.status = ApplicationStatus.OFFER_MADE;
        application.offer = offer;
        application.addStatusHistory(ApplicationStatus.OFFER_MADE, hospitalId);
        await application.save();

        // Get hospital and doctor info for notifications
        const doctor = application.doctor as User;
        const job = application.job as Job;
        const hospital = application.applicationHospital as User;
        const hospitalProfile = (hospital as any).hospitalProfile as Hospital;
        const hospitalName = hospitalProfile?.hospitalName || hospital.fullName;

        // Send email to candidate
        try {
            const emailResult = await emailService.sendOfferEmail(
                doctor.email,
                doctor.fullName,
                job.title,
                hospitalName,
                offer
            );

            if (emailResult.success) {
                application.offer = {
                    ...application.offer,
                    emailSentAt: new Date().toISOString(),
                    emailId: emailResult.messageId,
                };
                await application.save();
            }
        } catch (error) {
            logger.error(`Failed to send offer email for application ${applicationId}:`, error);
        }

        // Send in-app notification
        await this.sendOfferNotification(application, hospitalName);

        // Emit socket event to candidate
        this.notifyCandidateOffer(application.doctorId, {
            applicationId: application.id,
            jobTitle: job.title,
            hospitalName,
            offer,
        });

        logger.info(`Offer made for application ${applicationId}`);
        return application;
    }

    /**
     * Send offer notification to candidate
     */
    private async sendOfferNotification(
        application: Application,
        hospitalName: string
    ): Promise<void> {
        try {
            const job = application.job as Job;
            const offer = application.offer as Offer;

            const salaryFormatted = new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: offer.currency || 'INR',
                maximumFractionDigits: 0,
            }).format(offer.amount || 0);

            const messageContent = `🎉 Congratulations! You've received a job offer for ${job.title} at ${hospitalName}!

📋 Offer Details:
• Salary: ${salaryFormatted} (${offer.salaryType || 'monthly'})
• Joining Date: ${new Date(offer.startDate || '').toLocaleDateString()}
• Reporting Date: ${new Date(offer.reportingDate || '').toLocaleDateString()}
• Response Deadline: ${new Date(offer.expiresAt || '').toLocaleDateString()}

${offer.notes ? `📝 Notes: ${offer.notes}` : ''}

Please respond to this offer by the deadline. You can Accept or Decline from the Applications section.`;

            const conversation = await messageService.getOrCreateConversation({
                doctorId: application.doctorId,
                hospitalId: application.hospitalId,
                jobId: application.jobId,
                applicationId: application.id,
                type: 'application',
                initiatorId: application.hospitalId,
            });

            await messageService.sendMessage({
                conversationId: conversation.id,
                senderId: application.hospitalId,
                senderRole: 'hospital',
                content: messageContent,
                type: 'system',
                metadata: {
                    applicationId: application.id,
                    type: 'offer',
                    offer,
                }
            });

        } catch (error) {
            logger.error(`Failed to send offer notification for application ${application.id}:`, error);
        }
    }

    /**
     * Emit socket event to notify candidate of offer
     */
    private notifyCandidateOffer(doctorId: string, data: any): void {
        try {
            emitToUser(doctorId, 'offer:received', data);
        } catch (error) {
            logger.error(`Failed to emit offer notification to doctor ${doctorId}:`, error);
        }
    }

    /**
     * Accept job offer (by doctor) - Automatically hires the candidate
     */
    async acceptOffer(applicationId: string, doctorId: string): Promise<{ application: Application; assignment: Assignment }> {
        const transaction = await sequelize.transaction();

        try {
            const application = await Application.findOne({
                where: { id: applicationId, doctorId, status: ApplicationStatus.OFFER_MADE },
                include: [
                    { association: 'job', attributes: ['id', 'title', 'department', 'compensation', 'applicationSettings', 'stats', 'status'] },
                    { association: 'applicationHospital', include: [{ association: 'hospitalProfile' }] },
                ],
                transaction,
            });

            if (!application) {
                throw new Error('Application not found or offer not available');
            }

            if (!application.offer) {
                throw new Error('No offer found for this application');
            }

            // Check if offer has expired
            if (application.offer.expiresAt && new Date(application.offer.expiresAt) < new Date()) {
                application.offer = {
                    ...application.offer,
                    status: OfferStatus.EXPIRED,
                };
                await application.save({ transaction });
                await transaction.commit();
                throw new Error('This offer has expired');
            }

            const job = application.job as Job;
            const hospital = application.applicationHospital as User;
            const hospitalProfile = (hospital as any).hospitalProfile as Hospital;
            const hospitalName = hospitalProfile?.hospitalName || hospital.fullName;

            // Update offer status and application status to HIRED
            application.offer = {
                ...application.offer,
                status: OfferStatus.ACCEPTED,
                acceptedAt: new Date().toISOString(),
            };
            application.status = ApplicationStatus.HIRED;
            application.addStatusHistory(ApplicationStatus.HIRED, doctorId, 'Offer accepted - Hired');
            await application.save({ transaction });

            // Create assignment (employee record)
            const assignment = await Assignment.create({
                jobId: application.jobId,
                doctorId: application.doctorId,
                hospitalId: application.hospitalId,
                applicationId,
                title: job.title,
                department: job.department,
                status: AssignmentStatus.ACTIVE,
                startDate: application.offer?.startDate ? new Date(application.offer.startDate) : new Date(),
                compensation: {
                    amount: application.offer?.amount || 0,
                    currency: application.offer?.currency || 'INR',
                    type: (application.offer?.salaryType || 'monthly') as any,
                },
            }, { transaction });

            // Update job stats
            job.stats = {
                ...job.stats,
                hired: (job.stats?.hired || 0) + 1,
            };
            await job.save({ transaction });

            // Check if job should be auto-closed
            if (job.applicationSettings?.autoCloseOnFill) {
                const hiredCount = await Application.count({
                    where: { jobId: job.id, status: ApplicationStatus.HIRED },
                    transaction,
                });

                if (hiredCount >= 1) {
                    job.status = JobStatus.FILLED;
                    job.closedAt = new Date();
                    await job.save({ transaction });
                }
            }

            await transaction.commit();

            // Notify hospital about acceptance
            this.notifyRecruiterOfferResponse(application.hospitalId, {
                applicationId: application.id,
                jobTitle: job.title,
                candidateName: 'Candidate',
                response: 'accepted',
                respondedAt: new Date().toISOString(),
            });

            // Send in-app notification to hospital
            try {
                const conversation = await messageService.getOrCreateConversation({
                    doctorId: application.doctorId,
                    hospitalId: application.hospitalId,
                    jobId: application.jobId,
                    applicationId: application.id,
                    type: 'application',
                    initiatorId: application.doctorId,
                });

                await messageService.sendMessage({
                    conversationId: conversation.id,
                    senderId: application.doctorId,
                    senderRole: 'doctor',
                    content: `✅ I have accepted the job offer for ${job.title}. Looking forward to joining!`,
                    type: 'system',
                    metadata: {
                        applicationId: application.id,
                        type: 'offer_response',
                        response: 'accepted',
                    }
                });
            } catch (error) {
                logger.error(`Failed to send acceptance notification:`, error);
            }

            logger.info(`Offer accepted and hired for application ${applicationId}, Assignment: ${assignment.id}`);
            return { application, assignment };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Decline job offer (by doctor)
     */
    async declineOffer(applicationId: string, doctorId: string, reason?: string): Promise<Application> {
        const application = await Application.findOne({
            where: { id: applicationId, doctorId, status: ApplicationStatus.OFFER_MADE },
            include: [
                { association: 'job', attributes: ['id', 'title'] },
                { association: 'applicationHospital', include: [{ association: 'hospitalProfile' }] },
            ],
        });

        if (!application) {
            throw new Error('Application not found or offer not available');
        }

        if (!application.offer) {
            throw new Error('No offer found for this application');
        }

        // Update offer status and application status
        application.offer = {
            ...application.offer,
            status: OfferStatus.DECLINED,
            rejectedAt: new Date().toISOString(),
            rejectionReason: reason,
        };
        application.status = ApplicationStatus.OFFER_DECLINED;
        application.addStatusHistory(ApplicationStatus.OFFER_DECLINED, doctorId, `Offer declined: ${reason || 'No reason provided'}`);
        await application.save();

        // Notify hospital
        const job = application.job as Job;

        this.notifyRecruiterOfferResponse(application.hospitalId, {
            applicationId: application.id,
            jobTitle: job.title,
            candidateName: 'Candidate',
            response: 'declined',
            reason,
            respondedAt: new Date().toISOString(),
        });

        // Send in-app notification to hospital
        try {
            const conversation = await messageService.getOrCreateConversation({
                doctorId: application.doctorId,
                hospitalId: application.hospitalId,
                jobId: application.jobId,
                applicationId: application.id,
                type: 'application',
                initiatorId: application.doctorId,
            });

            await messageService.sendMessage({
                conversationId: conversation.id,
                senderId: application.doctorId,
                senderRole: 'doctor',
                content: `❌ I have declined the job offer for ${job.title}.${reason ? `\n\nReason: ${reason}` : ''}`,
                type: 'system',
                metadata: {
                    applicationId: application.id,
                    type: 'offer_response',
                    response: 'declined',
                    reason,
                }
            });
        } catch (error) {
            logger.error(`Failed to send decline notification:`, error);
        }

        logger.info(`Offer declined for application ${applicationId}`);
        return application;
    }

    /**
     * Emit socket event to notify recruiter of offer response
     */
    private notifyRecruiterOfferResponse(hospitalId: string, data: any): void {
        try {
            emitToUser(hospitalId, 'offer:response', data);
        } catch (error) {
            logger.error(`Failed to emit offer response to hospital ${hospitalId}:`, error);
        }
    }

    /**
     * Get offer status for an application
     */
    async getOfferStatus(applicationId: string, userId: string): Promise<Offer | null> {
        const application = await Application.findOne({
            where: {
                id: applicationId,
                [Op.or]: [{ doctorId: userId }, { hospitalId: userId }],
            },
        });

        if (!application) {
            throw new Error('Application not found');
        }

        return application.offer || null;
    }

    /**
     * Hire applicant (after offer accepted)
     */
    async hireApplicant(
        applicationId: string,
        hospitalId: string,
        options?: { startDate?: string; notes?: string }
    ): Promise<{ application: Application; assignment: Assignment }> {
        const transaction = await sequelize.transaction();

        try {
            const application = await Application.findOne({
                where: { id: applicationId, hospitalId },
                include: [
                    { association: 'job' },
                    { association: 'doctor', attributes: ['id', 'email', 'fullName'] },
                    { association: 'applicationHospital', include: [{ association: 'hospitalProfile' }] },
                ],
                transaction,
            });

            if (!application) {
                throw new Error('Application not found');
            }

            const job = application.job as Job;

            // Update application status
            application.status = ApplicationStatus.HIRED;
            application.offer = {
                ...application.offer,
                acceptedAt: new Date().toISOString(),
            };
            application.addStatusHistory(ApplicationStatus.HIRED, hospitalId, options?.notes);
            await application.save({ transaction });

            // Resolve start date: prefer explicit options, then offer date, then today
            const resolvedStartDate = options?.startDate
                ? new Date(options.startDate)
                : application.offer?.startDate
                    ? new Date(application.offer.startDate)
                    : new Date();

            // Create assignment
            const assignment = await Assignment.create({
                jobId: application.jobId,
                doctorId: application.doctorId,
                hospitalId,
                applicationId,
                title: job.title,
                department: job.department,
                status: AssignmentStatus.ACTIVE,
                startDate: resolvedStartDate,
                compensation: job.compensation,
            }, { transaction });

            // Update job stats directly
            job.stats = {
                ...job.stats,
                hired: (job.stats?.hired || 0) + 1,
            };
            await job.save({ transaction });

            // Check if job should be auto-closed
            if (job.applicationSettings?.autoCloseOnFill) {
                const hiredCount = await Application.count({
                    where: { jobId: job.id, status: ApplicationStatus.HIRED },
                    transaction,
                });

                // Assuming 1 position per job, close if filled
                if (hiredCount >= 1) {
                    job.status = JobStatus.FILLED;
                    job.closedAt = new Date();
                    await job.save({ transaction });
                }
            }

            await transaction.commit();

            // Send notification email to doctor
            try {
                const doctor = application.doctor as User;
                const hospital = application.applicationHospital as User;
                const hospitalProfile = (hospital as any).hospitalProfile as Hospital;

                await emailService.sendApplicationStatusEmail(
                    doctor.email,
                    doctor.fullName,
                    job.title,
                    hospitalProfile?.hospitalName || hospital.fullName,
                    ApplicationStatus.HIRED,
                    options?.notes
                );
            } catch (error) {
                logger.error(`Failed to send hire email for application ${applicationId}:`, error);
            }

            // Send in-app notification
            await this.sendNotification(application, ApplicationStatus.HIRED, options?.notes);

            logger.info(`Applicant hired: ${applicationId}, Assignment: ${assignment.id}`);
            return { application, assignment };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Reject application
     */
    async rejectApplication(
        applicationId: string,
        hospitalId: string,
        reason?: string,
        feedback?: string
    ): Promise<Application> {
        const application = await Application.findOne({
            where: { id: applicationId, hospitalId },
        });

        if (!application) {
            throw new Error('Application not found');
        }

        application.status = ApplicationStatus.REJECTED;
        application.rejection = {
            reason,
            feedback,
            rejectedBy: hospitalId,
            rejectedAt: new Date().toISOString(),
        };
        application.addStatusHistory(ApplicationStatus.REJECTED, hospitalId, reason);
        await application.save();

        // Update job stats
        await jobService.updateJobStats(application.jobId, 'rejected', 1);

        logger.info(`Application rejected: ${applicationId}`);
        return application;
    }

    /**
     * Withdraw application (by doctor)
     */
    async withdrawApplication(applicationId: string, doctorId: string, reason?: string): Promise<Application> {
        const application = await Application.findOne({
            where: { id: applicationId, doctorId },
        });

        if (!application) {
            throw new Error('Application not found');
        }

        // Can only withdraw if not already hired or rejected
        if ([ApplicationStatus.HIRED, ApplicationStatus.REJECTED].includes(application.status)) {
            throw new Error('Cannot withdraw this application');
        }

        application.status = ApplicationStatus.WITHDRAWN;
        application.withdrawal = {
            reason,
            withdrawnAt: new Date().toISOString(),
        };
        application.addStatusHistory(ApplicationStatus.WITHDRAWN, doctorId, reason);
        await application.save();

        logger.info(`Application withdrawn: ${applicationId}`);
        return application;
    }

    /**
     * Add internal note
     */
    async addInternalNote(
        applicationId: string,
        hospitalId: string,
        note: string
    ): Promise<Application> {
        const application = await Application.findOne({
            where: { id: applicationId, hospitalId },
        });

        if (!application) {
            throw new Error('Application not found');
        }

        const notes = application.internalNotes || [];
        notes.push({
            note,
            addedBy: hospitalId,
            addedAt: new Date().toISOString(),
        });
        application.internalNotes = notes;
        await application.save();

        return application;
    }

    /**
     * Get doctor's applications
     */
    async getDoctorApplications(
        doctorId: string,
        status?: ApplicationStatus,
        page: number = 1,
        limit: number = 20
    ): Promise<PaginatedResult<Application>> {
        const where: any = { doctorId };
        if (status) {
            where.status = status;
        }

        return this.getApplications({ ...where, page, limit });
    }

    /**
     * Calculate match score between doctor and job
     */
    private calculateMatchScore(doctor: Doctor, job: Job): number {
        let score = 0;
        const weights = {
            specialization: 30,
            skills: 25,
            experience: 20,
            location: 15,
            compensation: 10,
        };

        // Specialization match (30 points)
        if (doctor.specialization && job.specialization) {
            if (doctor.specialization.toLowerCase() === job.specialization.toLowerCase()) {
                score += weights.specialization;
            } else if (doctor.subSpecializations?.some(s =>
                s.toLowerCase() === job.specialization.toLowerCase()
            )) {
                score += weights.specialization * 0.7;
            }
        }

        // Skills match (25 points)
        const doctorSkills = (doctor.skills || []).map(s => s.name?.toLowerCase()).filter(Boolean);
        const requiredSkills = (job.requirements?.skills || [])
            .filter(s => typeof s === 'string')
            .map(s => s.toLowerCase());

        if (requiredSkills.length > 0) {
            const matchedSkills = requiredSkills.filter(s => doctorSkills.includes(s));
            score += (matchedSkills.length / requiredSkills.length) * weights.skills;
        } else {
            score += weights.skills * 0.5; // Partial score if no specific skills required
        }

        // Experience match (20 points)
        const minExp = job.requirements?.minimumExperience || 0;
        if (doctor.yearsOfExperience >= minExp) {
            score += weights.experience;
        } else if (doctor.yearsOfExperience >= minExp * 0.7) {
            score += weights.experience * 0.5;
        }

        // Location match (15 points)
        const doctorCity = doctor.address?.city?.toLowerCase();
        const doctorState = doctor.address?.state?.toLowerCase();
        const jobCity = job.location?.city?.toLowerCase();
        const jobState = job.location?.state?.toLowerCase();
        const preferredLocations = (doctor.careerPreferences?.preferredLocations || [])
            .filter(l => typeof l === 'string')
            .map(l => l.toLowerCase());

        if (doctorCity && jobCity && doctorCity === jobCity) {
            score += weights.location;
        } else if (doctorState && jobState && doctorState === jobState) {
            score += weights.location * 0.7;
        } else if (preferredLocations.includes(jobCity || '') || preferredLocations.includes(jobState || '')) {
            score += weights.location * 0.5;
        } else if (doctor.careerPreferences?.willingToRelocate) {
            score += weights.location * 0.3;
        }

        // Compensation match (10 points)
        const expectedRate = doctor.careerPreferences?.expectedDailyRate || doctor.careerPreferences?.expectedHourlyRate;
        const offeredAmount = job.compensation?.amount;

        if (expectedRate && offeredAmount) {
            if (offeredAmount >= expectedRate) {
                score += weights.compensation;
            } else if (offeredAmount >= expectedRate * 0.8) {
                score += weights.compensation * 0.5;
            }
        } else {
            score += weights.compensation * 0.5;
        }

        return Math.round(score);
    }

    /**
     * Validate status transition
     */
    private validateStatusTransition(currentStatus: ApplicationStatus, newStatus: ApplicationStatus): void {
        const validTransitions: Record<ApplicationStatus, ApplicationStatus[]> = {
            [ApplicationStatus.APPLIED]: [ApplicationStatus.UNDER_REVIEW, ApplicationStatus.SHORTLISTED, ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN],
            [ApplicationStatus.UNDER_REVIEW]: [ApplicationStatus.SHORTLISTED, ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN],
            [ApplicationStatus.SHORTLISTED]: [ApplicationStatus.INTERVIEW_SCHEDULED, ApplicationStatus.OFFER_MADE, ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN],
            [ApplicationStatus.INTERVIEW_SCHEDULED]: [ApplicationStatus.INTERVIEWED, ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN],
            [ApplicationStatus.INTERVIEWED]: [ApplicationStatus.OFFER_MADE, ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN],
            [ApplicationStatus.OFFER_MADE]: [ApplicationStatus.HIRED, ApplicationStatus.OFFER_DECLINED, ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN],
            [ApplicationStatus.OFFER_DECLINED]: [ApplicationStatus.OFFER_MADE], // Hospital can make a new offer
            [ApplicationStatus.HIRED]: [],
            [ApplicationStatus.REJECTED]: [],
            [ApplicationStatus.WITHDRAWN]: [],
        };

        if (!validTransitions[currentStatus]?.includes(newStatus)) {
            throw new Error(`Cannot transition from ${currentStatus} to ${newStatus}`);
        }
    }

    /**
     * Update job stats based on status change
     */
    private async updateJobStatsForStatusChange(
        jobId: string,
        previousStatus: ApplicationStatus,
        newStatus: ApplicationStatus
    ): Promise<void> {
        const statsField: Record<ApplicationStatus, keyof Job['stats'] | null> = {
            [ApplicationStatus.APPLIED]: null,
            [ApplicationStatus.UNDER_REVIEW]: null,
            [ApplicationStatus.SHORTLISTED]: 'shortlisted',
            [ApplicationStatus.INTERVIEW_SCHEDULED]: null,
            [ApplicationStatus.INTERVIEWED]: 'interviewed',
            [ApplicationStatus.OFFER_MADE]: null,
            [ApplicationStatus.OFFER_DECLINED]: null,
            [ApplicationStatus.HIRED]: 'hired',
            [ApplicationStatus.REJECTED]: 'rejected',
            [ApplicationStatus.WITHDRAWN]: null,
        };

        const field = statsField[newStatus];
        if (field) {
            await jobService.updateJobStats(jobId, field, 1);
        }
    }
}

// Export singleton instance
export const applicationService = new ApplicationService();
export default applicationService;
