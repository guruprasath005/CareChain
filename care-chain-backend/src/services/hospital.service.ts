// src/services/hospital.service.ts
// Hospital Profile Service

import { Hospital } from '../models/Hospital.model';
import { User } from '../models/User.model';
import { Job } from '../models/Job.model';
import { Application } from '../models/Application.model';
import { Assignment } from '../models/Assignment.model';
import { VerificationStatus, JobStatus, ApplicationStatus, AssignmentStatus } from '../models/types';
import { cacheService, CACHE_KEYS, CACHE_TTL } from './cache.service';
import { logger } from '../utils/logger';
import { Op } from 'sequelize';
import {
    Address,
    Infrastructure,
    Representative,
    ContactPerson,
    HospitalLicense,
    NABHAccreditation,
} from '../models/types';
import { v4 as uuidv4 } from 'uuid';

export interface HospitalBasicInfo {
    hospitalName?: string;
    hospitalType?: string;
    hospitalTypeOther?: string;
    registrationNumber?: string;
    establishedYear?: number;
    website?: string;
    description?: string;
    phone?: string;
}

export interface HospitalSearchFilters {
    city?: string;
    state?: string;
    hospitalType?: string;
    isVerified?: boolean;
    page?: number;
    limit?: number;
}

export interface DashboardStats {
    totalJobsPosted: number;
    activeJobs: number;
    totalApplications: number;
    pendingApplications: number;
    totalHires: number;
    activeEmployees: number;
    latestApplication?: {
        id: string;
        jobId: string;
        doctorId: string;
        jobTitle: string;
        doctorName: string;
        appliedAt: Date;
    };
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
 * Hospital Service
 * Handles hospital profile and dashboard operations
 */
class HospitalService {
    /**
     * Get hospital profile by user ID
     */
    async getProfileByUserId(userId: string): Promise<Hospital | null> {
        return Hospital.findOne({
            where: { userId },
            include: [{
                association: 'user',
                attributes: ['id', 'email', 'fullName', 'avatarUrl', 'isEmailVerified', 'isProfileComplete']
            }],
        });
    }

    /**
     * Get hospital profile by hospital ID
     */
    async getProfileById(hospitalId: string): Promise<Hospital | null> {
        return Hospital.findByPk(hospitalId, {
            include: [{
                association: 'user',
                attributes: ['id', 'email', 'fullName', 'avatarUrl', 'isEmailVerified', 'isProfileComplete']
            }],
        });
    }

    /**
     * Update general information
     */
    async updateGeneralInfo(userId: string, data: HospitalBasicInfo): Promise<Hospital> {
        const hospital = await Hospital.findOne({ where: { userId } });
        if (!hospital) {
            throw new Error('Hospital profile not found');
        }

        if (data.hospitalName !== undefined) hospital.hospitalName = data.hospitalName;
        if (data.hospitalType !== undefined) hospital.hospitalType = data.hospitalType as any;
        if (data.hospitalTypeOther !== undefined) hospital.hospitalTypeOther = data.hospitalTypeOther;
        if (data.registrationNumber !== undefined) hospital.registrationNumber = data.registrationNumber;
        if (data.establishedYear !== undefined) hospital.establishedYear = data.establishedYear;
        if (data.website !== undefined) hospital.website = data.website;
        if (data.description !== undefined) hospital.description = data.description;

        // Handle phone update on User model
        if (data.phone !== undefined) {
            const user = await User.findByPk(userId);
            if (user) {
                user.phoneNumber = data.phone;
                await user.save();
            }
        }

        // Handle address if provided
        if ((data as any).address) {
            const addr = (data as any).address;
            hospital.address = {
                ...hospital.address,
                street: addr.street ?? hospital.address?.street,
                area: addr.area ?? hospital.address?.area,
                city: addr.city ?? hospital.address?.city,
                state: addr.state ?? hospital.address?.state,
                pincode: addr.pincode ?? hospital.address?.pincode,
                country: addr.country ?? hospital.address?.country ?? 'India',
            };
        }

        hospital.profileSections = {
            ...hospital.profileSections,
            generalInfo: !!(data.hospitalName && data.hospitalType),
        };

        await hospital.save();
        await this.updateProfileCompletion(userId);
        await this.updateSearchTags(hospital);

        logger.debug(`Hospital general info updated: ${userId}`);
        return hospital;
    }

    /**
     * Update location/address
     */
    async updateLocation(userId: string, address: Address): Promise<Hospital> {
        const hospital = await Hospital.findOne({ where: { userId } });
        if (!hospital) {
            throw new Error('Hospital profile not found');
        }

        hospital.address = { ...hospital.address, ...address };

        // Extract coordinates if present
        if (address.coordinates) {
            hospital.latitude = address.coordinates.lat;
            hospital.longitude = address.coordinates.lng;
        }

        await hospital.save();
        await this.updateSearchTags(hospital);

        logger.debug(`Hospital location updated: ${userId}`);
        return hospital;
    }

    /**
     * Update infrastructure (handles both infrastructure and facilities data)
     */
    async updateInfrastructure(userId: string, data: any): Promise<Hospital> {
        const hospital = await Hospital.findOne({ where: { userId } });
        if (!hospital) {
            throw new Error('Hospital profile not found');
        }

        // Extract infrastructure-specific fields
        const infrastructureFields = ['totalBeds', 'icuBeds', 'nicuPicuBeds', 'emergencyBeds', 'operationTheaters', 'photos'];
        const infrastructure: Record<string, any> = {};
        for (const key of infrastructureFields) {
            if (data[key] !== undefined) {
                infrastructure[key] = data[key];
            }
        }
        if (Object.keys(infrastructure).length > 0) {
            hospital.infrastructure = { ...hospital.infrastructure, ...infrastructure };
        }

        // Extract facility-specific fields
        const facilityFields = [
            'opFacility', 'ipFacility', 'ipBeds', 'emergency24x7', 'icuFacilities',
            'nicuPicuFacilities', 'operationTheatre', 'diagnosticLab', 'labFacilities',
            'labFacilitiesOther', 'radiologyDepartment', 'imagingFacilities',
            'imagingFacilitiesOther', 'pharmacy', 'pharmacyAvailable24x7',
            'bloodBank', 'ambulanceService', 'securityAvailable',
            'parking', 'canteen', 'wifi', 'atm', 'wheelchairAccess'
        ];
        const facilities: Record<string, any> = {};
        for (const key of facilityFields) {
            if (data[key] !== undefined) {
                facilities[key] = data[key];
            }
        }
        // Handle alias nicuPicu -> nicuPicuFacilities
        if (data.nicuPicu !== undefined && data.nicuPicuFacilities === undefined) {
            facilities.nicuPicuFacilities = data.nicuPicu;
        }
        if (Object.keys(facilities).length > 0) {
            hospital.facilities = { ...hospital.facilities, ...facilities };
        }

        hospital.profileSections = {
            ...hospital.profileSections,
            infrastructureDetails: true,
        };

        await hospital.save();
        await this.updateProfileCompletion(userId);

        logger.debug(`Hospital infrastructure updated: ${userId}`);
        return hospital;
    }

    /**
     * Update facilities
     */
    async updateFacilities(userId: string, facilities: Record<string, boolean>): Promise<Hospital> {
        const hospital = await Hospital.findOne({ where: { userId } });
        if (!hospital) {
            throw new Error('Hospital profile not found');
        }

        hospital.facilities = { ...hospital.facilities, ...facilities };
        await hospital.save();

        logger.debug(`Hospital facilities updated: ${userId}`);
        return hospital;
    }

    /**
     * Update staffing details
     */
    async updateStaffing(userId: string, staffing: Record<string, number>): Promise<Hospital> {
        const hospital = await Hospital.findOne({ where: { userId } });
        if (!hospital) {
            throw new Error('Hospital profile not found');
        }

        hospital.staffing = { ...hospital.staffing, ...staffing };
        hospital.profileSections = {
            ...hospital.profileSections,
            staffingDetails: true,
        };

        await hospital.save();
        await this.updateProfileCompletion(userId);

        logger.debug(`Hospital staffing updated: ${userId}`);
        return hospital;
    }

    /**
     * Update credentials
     */
    async updateCredentials(userId: string, data: any): Promise<Hospital> {
        const hospital = await Hospital.findOne({ where: { userId } });
        if (!hospital) {
            throw new Error('Hospital profile not found');
        }

        // Update registration number if provided
        if (data.registrationNumber !== undefined) {
            hospital.registrationNumber = data.registrationNumber;
        }

        // Update credentials JSONB
        hospital.credentials = {
            ...hospital.credentials,
            registrationNumber: data.registrationNumber,
            accreditations: data.accreditations,
            chiefDoctorRegNumber: data.chiefDoctorRegNumber,
        };

        hospital.profileSections = {
            ...hospital.profileSections,
            trustVerification: !!(data.registrationNumber),
        };

        await hospital.save();
        await this.updateProfileCompletion(userId);

        logger.debug(`Hospital credentials updated: ${userId}`);
        return hospital;
    }

    /**
     * Update representative details
     */
    async updateRepresentative(userId: string, representative: Partial<Representative>): Promise<Hospital> {
        const hospital = await Hospital.findOne({ where: { userId } });
        if (!hospital) {
            throw new Error('Hospital profile not found');
        }

        hospital.representative = { ...hospital.representative, ...representative };
        hospital.profileSections = {
            ...hospital.profileSections,
            representativeDetails: !!(representative.fullName),
        };

        await hospital.save();
        await this.updateProfileCompletion(userId);

        logger.debug(`Hospital representative updated: ${userId}`);
        return hospital;
    }

    /**
     * Add contact person
     */
    async addContact(userId: string, contact: Omit<ContactPerson, 'id'>): Promise<Hospital> {
        const hospital = await Hospital.findOne({ where: { userId } });
        if (!hospital) {
            throw new Error('Hospital profile not found');
        }

        const newContact = { ...contact, id: uuidv4() };

        // If this is primary, unset other primary contacts
        if (contact.isPrimary) {
            hospital.contactPersons = (hospital.contactPersons || []).map((c: any) => ({
                ...c,
                isPrimary: false,
            }));
        }

        hospital.contactPersons = [...(hospital.contactPersons || []), newContact];
        await hospital.save();

        logger.debug(`Contact added for hospital: ${userId}`);
        return hospital;
    }

    /**
     * Update contact person
     */
    async updateContact(userId: string, contactId: string, data: Partial<ContactPerson>): Promise<Hospital> {
        const hospital = await Hospital.findOne({ where: { userId } });
        if (!hospital) {
            throw new Error('Hospital profile not found');
        }

        const contacts = hospital.contactPersons || [];
        const index = contacts.findIndex((c: any) => c.id === contactId);

        if (index === -1) {
            throw new Error('Contact not found');
        }

        // If setting as primary, unset others
        if (data.isPrimary) {
            hospital.contactPersons = contacts.map((c: any, i: number) => ({
                ...c,
                isPrimary: i === index,
            }));
        } else {
            contacts[index] = { ...contacts[index], ...data };
            hospital.contactPersons = contacts;
        }

        await hospital.save();

        logger.debug(`Contact updated for hospital: ${userId}`);
        return hospital;
    }

    /**
     * Delete contact person
     */
    async deleteContact(userId: string, contactId: string): Promise<Hospital> {
        const hospital = await Hospital.findOne({ where: { userId } });
        if (!hospital) {
            throw new Error('Hospital profile not found');
        }

        hospital.contactPersons = (hospital.contactPersons || []).filter((c: any) => c.id !== contactId);
        await hospital.save();

        logger.debug(`Contact deleted for hospital: ${userId}`);
        return hospital;
    }

    /**
     * Add department
     */
    async addDepartment(userId: string, department: { name: string; headName?: string; contactNumber?: string }): Promise<Hospital> {
        const hospital = await Hospital.findOne({ where: { userId } });
        if (!hospital) {
            throw new Error('Hospital profile not found');
        }

        const newDepartment = {
            id: uuidv4(),
            ...department,
            isActive: true,
        };

        hospital.departments = [...(hospital.departments || []), newDepartment];
        await hospital.save();

        logger.debug(`Department added for hospital: ${userId}`);
        return hospital;
    }

    /**
     * Update department
     */
    async updateDepartment(userId: string, departmentId: string, data: Partial<{ name: string; headName: string; contactNumber: string; isActive: boolean }>): Promise<Hospital> {
        const hospital = await Hospital.findOne({ where: { userId } });
        if (!hospital) {
            throw new Error('Hospital profile not found');
        }

        const departments = hospital.departments || [];
        const index = departments.findIndex((d: any) => d.id === departmentId);

        if (index === -1) {
            throw new Error('Department not found');
        }

        departments[index] = { ...departments[index], ...data };
        hospital.departments = departments;
        await hospital.save();

        logger.debug(`Department updated for hospital: ${userId}`);
        return hospital;
    }

    /**
     * Delete department
     */
    async deleteDepartment(userId: string, departmentId: string): Promise<Hospital> {
        const hospital = await Hospital.findOne({ where: { userId } });
        if (!hospital) {
            throw new Error('Hospital profile not found');
        }

        hospital.departments = (hospital.departments || []).filter((d: any) => d.id !== departmentId);
        await hospital.save();

        logger.debug(`Department deleted for hospital: ${userId}`);
        return hospital;
    }

    /**
     * Update hospital license
     */
    async updateLicense(userId: string, license: Partial<HospitalLicense>): Promise<Hospital> {
        const hospital = await Hospital.findOne({ where: { userId } });
        if (!hospital) {
            throw new Error('Hospital profile not found');
        }

        hospital.hospitalLicense = { ...hospital.hospitalLicense, ...license };
        hospital.profileSections = {
            ...hospital.profileSections,
            trustVerification: !!(license.licenseNumber),
        };

        await hospital.save();
        await this.updateProfileCompletion(userId);

        logger.debug(`Hospital license updated: ${userId}`);
        return hospital;
    }

    /**
     * Update NABH accreditation
     */
    async updateNABH(userId: string, nabh: Partial<NABHAccreditation>): Promise<Hospital> {
        const hospital = await Hospital.findOne({ where: { userId } });
        if (!hospital) {
            throw new Error('Hospital profile not found');
        }

        hospital.nabhAccreditation = { ...hospital.nabhAccreditation, ...nabh };
        await hospital.save();

        logger.debug(`Hospital NABH updated: ${userId}`);
        return hospital;
    }

    /**
     * Update specialties
     */
    async updateSpecialties(userId: string, specialties: string[], specialtiesOther?: string): Promise<Hospital> {
        const hospital = await Hospital.findOne({ where: { userId } });
        if (!hospital) {
            throw new Error('Hospital profile not found');
        }

        hospital.specialties = specialties;
        if (specialtiesOther !== undefined) {
            hospital.specialtiesOther = specialtiesOther;
        }

        await hospital.save();
        await this.updateSearchTags(hospital);

        logger.debug(`Hospital specialties updated: ${userId}`);
        return hospital;
    }

    /**
     * Get dashboard statistics
     */
    async getDashboard(userId: string): Promise<DashboardStats> {
        const hospital = await Hospital.findOne({ where: { userId } });
        if (!hospital) {
            throw new Error('Hospital profile not found');
        }

        const cacheKey = CACHE_KEYS.HOSPITAL_STATS(userId);
        const cached = await cacheService.get<DashboardStats>(cacheKey);
        if (cached) return cached;

        // Run all 6 queries in parallel instead of sequentially
        const [
            totalJobsPosted,
            activeJobs,
            totalApplications,
            pendingApplications,
            totalHires,
            activeEmployees,
            latestApplication,
        ] = await Promise.all([
            Job.count({ where: { hospitalId: userId } }),
            Job.count({ where: { hospitalId: userId, status: JobStatus.OPEN } }),
            Application.count({ where: { hospitalId: userId } }),
            Application.count({
                where: {
                    hospitalId: userId,
                    status: { [Op.in]: [ApplicationStatus.APPLIED, ApplicationStatus.UNDER_REVIEW] },
                },
            }),
            Application.count({ where: { hospitalId: userId, status: ApplicationStatus.HIRED } }),
            Assignment.count({ where: { hospitalId: userId, status: AssignmentStatus.ACTIVE } }),
            Application.findOne({
                where: { hospitalId: userId, status: ApplicationStatus.APPLIED },
                include: [
                    { association: 'job', attributes: ['title'] },
                    { association: 'doctor', attributes: ['fullName'] },
                ],
                order: [['createdAt', 'DESC']],
            }),
        ]);

        const stats: DashboardStats = {
            totalJobsPosted,
            activeJobs,
            totalApplications,
            pendingApplications,
            totalHires,
            activeEmployees,
            latestApplication: latestApplication ? {
                id: latestApplication.id,
                jobId: latestApplication.jobId,
                doctorId: latestApplication.doctorId,
                jobTitle: latestApplication.job?.title || 'Unknown Job',
                doctorName: latestApplication.doctor?.fullName || 'Unknown Candidate',
                appliedAt: latestApplication.createdAt,
            } : undefined,
        };

        // Cache for 2 minutes — short enough to stay reasonably fresh
        await cacheService.set(cacheKey, stats, CACHE_TTL.HOSPITAL_STATS);
        return stats;
    }

    /**
     * Search hospitals with filters
     */
    async searchHospitals(filters: HospitalSearchFilters): Promise<PaginatedResult<Hospital>> {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;

        const where: any = {
            isSearchable: true,
        };

        if (filters.hospitalType) {
            where.hospitalType = filters.hospitalType;
        }

        if (filters.isVerified) {
            where.verificationStatus = VerificationStatus.VERIFIED;
        }

        const { count, rows } = await Hospital.findAndCountAll({
            where,
            limit,
            offset,
            include: [{ association: 'user', attributes: ['fullName'] }],
            order: [['hospitalName', 'ASC']],
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
     * Update profile completion
     */
    private async updateProfileCompletion(userId: string): Promise<void> {
        const hospital = await Hospital.findOne({ where: { userId } });
        if (!hospital) return;

        const user = await User.findByPk(userId);
        if (!user) return;

        const completion = hospital.calculateProfileCompletion();
        user.profileCompletionPercentage = completion;
        user.isProfileComplete = completion >= 70;
        await user.save();
    }

    /**
     * Update search tags
     */
    private async updateSearchTags(hospital: Hospital): Promise<void> {
        const tags: string[] = [];

        if (hospital.hospitalName) {
            tags.push(hospital.hospitalName.toLowerCase());
        }

        if (hospital.hospitalType) {
            tags.push(hospital.hospitalType.toLowerCase());
        }

        for (const specialty of hospital.specialties || []) {
            tags.push(specialty.toLowerCase());
        }

        if (hospital.address?.city) {
            tags.push(hospital.address.city.toLowerCase());
        }

        if (hospital.address?.state) {
            tags.push(hospital.address.state.toLowerCase());
        }

        hospital.searchTags = [...new Set(tags)];
        await hospital.save();
    }

    /**
     * Update verification status (admin function)
     */
    async updateVerificationStatus(
        hospitalId: string,
        status: VerificationStatus,
        adminId: string,
        notes?: string
    ): Promise<Hospital> {
        const hospital = await Hospital.findByPk(hospitalId);
        if (!hospital) {
            throw new Error('Hospital not found');
        }

        hospital.verificationStatus = status;
        hospital.verificationNotes = notes || null;
        hospital.verifiedBy = adminId;
        hospital.verifiedAt = status === VerificationStatus.VERIFIED ? new Date() : null;

        await hospital.save();

        logger.info(`Hospital ${hospitalId} verification status updated to ${status}`);
        return hospital;
    }

    /**
     * Get public profile for search/view
     */
    async getPublicProfile(hospitalId: string): Promise<any> {
        let hospital = await Hospital.findByPk(hospitalId, {
            include: [{ association: 'user', attributes: ['fullName', 'avatarUrl'] }],
        });

        // If not found by PK, try by userId (legacy support or when passed from assignment)
        if (!hospital) {
            hospital = await Hospital.findOne({
                where: { userId: hospitalId },
                include: [{ association: 'user', attributes: ['fullName', 'avatarUrl'] }],
            });
        }

        if (!hospital) {
            return null;
        }

        // Get real-time stats
        // Use hospital.id (the newly found hospital's ID) for queries
        // If we found by userId, hospitalId arg was userId, but here we need valid hospital.id
        const realHospitalId = hospital.id;
        const realUserId = hospital.userId; // Assuming userId is available

        const activeJobs = await Job.count({
            where: {
                hospitalId: realUserId, // Jobs likely linked via userId (hospitalId column in jobs table)
                status: JobStatus.OPEN,
            },
        });

        // Assignments use hospitalId column which refers to User ID
        const totalEmployees = await Assignment.count({
            where: {
                hospitalId: realUserId,
                status: AssignmentStatus.ACTIVE,
            },
        });

        return {
            id: hospital.id,
            name: hospital.hospitalName || hospital.user?.fullName || 'Hospital',
            type: hospital.hospitalType,
            description: hospital.description,
            website: hospital.website,
            logo: hospital.images?.logo || hospital.user?.avatarUrl,
            coverPhoto: hospital.images?.banner,
            registrationNumber: hospital.registrationNumber,
            establishedYear: hospital.establishedYear,
            location: {
                city: hospital.address?.city,
                state: hospital.address?.state,
                fullAddress: hospital.getFullAddress(),
            },
            specialties: hospital.specialties || [],
            departments: (hospital.departments || []).filter((d: any) => d.isActive).map((d: any) => ({
                name: d.name,
                headName: d.headName,
                contactNumber: d.contactNumber,
            })),
            facilities: {
                ...hospital.facilities, // Return full facilities object
            },
            infrastructure: hospital.infrastructure,
            hospitalLicense: hospital.hospitalLicense,
            nabhAccreditation: hospital.nabhAccreditation,
            representative: hospital.representative,
            contactPersons: (hospital.contactPersons || []).filter((c: any) => c.isPrimary || c.isPubliclyVisible !== false),
            stats: {
                rating: hospital.hospitalStats?.rating || 0,
                totalEmployees,
                activeJobs,
                totalHires: hospital.hospitalStats?.totalHires || 0,
            },
            isVerified: hospital.verificationStatus === VerificationStatus.VERIFIED,
            isOpen24Hours: hospital.workingHours?.['monday']?.isOpen &&
                hospital.workingHours?.['monday']?.openTime === '00:00' &&
                hospital.workingHours?.['monday']?.closeTime === '23:59',
            workingHours: hospital.workingHours,
        };
    }
}

// Export singleton instance
export const hospitalService = new HospitalService();
export default hospitalService;
