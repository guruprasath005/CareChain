// src/services/doctor.service.ts
// Doctor Profile Service

import { Doctor } from '../models/Doctor.model';
import { User } from '../models/User.model';
import { UserRole } from '../models/types';
import { logger } from '../utils/logger';
import { Op } from 'sequelize';
import { sequelize } from '../config/database';
import {
    Education,
    WorkExperience,
    Skill,
    License,
    CareerPreferences,
    Address,
    AadhaarInfo,
    AssignmentStatus,
    AttendanceStatus,
} from '../models/types';
import { Assignment } from '../models/Assignment.model';
import { Attendance } from '../models/Attendance.model';
import { Job } from '../models/Job.model';
import { v4 as uuidv4 } from 'uuid';

export interface DoctorProfileUpdate {
    firstName?: string;
    lastName?: string;
    gender?: string;
    dateOfBirth?: string;
    bio?: string;
    specialization?: string;
    subSpecializations?: string[];
    designation?: string;
    currentHospital?: string;
    address?: Address;
}

export interface DoctorSearchFilters {
    q?: string;
    specialization?: string;
    city?: string;
    state?: string;
    minExperience?: number;
    maxExperience?: number;
    skills?: string[];
    isAvailable?: boolean;
    sortBy?: string;
    sortOrder?: string;
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
 * Doctor Service
 * Handles doctor profile operations
 */
class DoctorService {
    /**
     * Get doctor profile by user ID
     */
    async getProfileByUserId(userId: string): Promise<Doctor | null> {
        return Doctor.findOne({
            where: { userId },
            include: [{ association: 'user', attributes: ['id', 'email', 'fullName', 'avatarUrl', 'isEmailVerified', 'isProfileComplete'] }],
        });
    }

    /**
     * Get doctor profile by doctor ID
     */
    async getProfileById(doctorId: string): Promise<Doctor | null> {
        return Doctor.findByPk(doctorId, {
            include: [{ association: 'user', attributes: ['id', 'email', 'fullName', 'avatarUrl', 'isEmailVerified', 'isProfileComplete'] }],
        });
    }

    /**
     * Update personal information
     */
    async updatePersonalInfo(userId: string, data: DoctorProfileUpdate): Promise<Doctor> {
        const doctor = await Doctor.findOne({ where: { userId } });
        if (!doctor) {
            throw new Error('Doctor profile not found');
        }

        // Update fields
        if (data.firstName !== undefined) doctor.firstName = data.firstName;
        if (data.lastName !== undefined) doctor.lastName = data.lastName;
        if (data.gender !== undefined) {
            // Normalize gender to valid enum values
            const normalizedGender = String(data.gender).toLowerCase().replace(/\s+/g, '_');
            const validGenders = ['male', 'female', 'other', 'prefer_not_to_say'];
            if (validGenders.includes(normalizedGender)) {
                doctor.gender = normalizedGender as any;
            }
            // If invalid, we simply skip the update to avoid Postgres ENUM errors
        }
        if (data.dateOfBirth !== undefined) doctor.dateOfBirth = data.dateOfBirth;
        if (data.bio !== undefined) doctor.bio = data.bio;
        if (data.specialization !== undefined) doctor.specialization = data.specialization;
        if (data.subSpecializations !== undefined) doctor.subSpecializations = data.subSpecializations;
        if (data.designation !== undefined) doctor.designation = data.designation;
        if (data.currentHospital !== undefined) doctor.currentHospital = data.currentHospital;
        if (data.address !== undefined) doctor.address = { ...doctor.address, ...data.address };

        // Update profile section based on current state (after updates applied)
        const hasPersonalInfo = !!(
            doctor.firstName &&
            doctor.lastName &&
            doctor.gender &&
            doctor.address?.city &&
            doctor.address?.state
        );
        doctor.profileSections = {
            ...doctor.profileSections,
            personal: hasPersonalInfo,
        };

        await doctor.save();

        // Update user's fullName if firstName or lastName changed
        if (data.firstName !== undefined || data.lastName !== undefined) {
            const user = await User.findByPk(userId);
            if (user) {
                const newFirstName = data.firstName !== undefined ? data.firstName : doctor.firstName;
                const newLastName = data.lastName !== undefined ? data.lastName : doctor.lastName;
                user.fullName = `${newFirstName || ''} ${newLastName || ''}`.trim();
                await user.save();
            }
        }

        await this.updateProfileCompletion(userId);
        await this.updateSearchTags(doctor);

        logger.debug(`Doctor personal info updated: ${userId}`);
        return doctor;
    }

    /**
     * Update address
     */
    async updateAddress(userId: string, address: Address): Promise<Doctor> {
        const doctor = await Doctor.findOne({ where: { userId } });
        if (!doctor) {
            throw new Error('Doctor profile not found');
        }

        doctor.address = { ...doctor.address, ...address };
        await doctor.save();

        logger.debug(`Doctor address updated: ${userId}`);
        return doctor;
    }

    /**
     * Add education entry
     */
    async addEducation(userId: string, education: Omit<Education, 'isVerified'>): Promise<Doctor> {
        const doctor = await Doctor.findOne({ where: { userId } });
        if (!doctor) {
            throw new Error('Doctor profile not found');
        }

        const newEducation = {
            ...education,
            id: uuidv4(),
            isVerified: false,
        };

        doctor.education = [...(doctor.education || []), newEducation];
        doctor.profileSections = { ...doctor.profileSections, education: true };

        await doctor.save();
        await this.updateProfileCompletion(userId);

        logger.debug(`Education added for doctor: ${userId}`);
        return doctor;
    }

    /**
     * Update education entry
     */
    async updateEducation(userId: string, educationId: string, data: Partial<Education>): Promise<Doctor> {
        const doctor = await Doctor.findOne({ where: { userId } });
        if (!doctor) {
            throw new Error('Doctor profile not found');
        }

        const educationList = doctor.education || [];
        const index = educationList.findIndex((e: any) => e.id === educationId);

        if (index === -1) {
            throw new Error('Education entry not found');
        }

        const updatedEducation = [...educationList];
        updatedEducation[index] = { ...updatedEducation[index], ...data };
        doctor.education = updatedEducation;
        await doctor.save();

        logger.debug(`Education updated for doctor: ${userId}`);
        return doctor;
    }

    /**
     * Delete education entry
     */
    async deleteEducation(userId: string, educationId: string): Promise<Doctor> {
        const doctor = await Doctor.findOne({ where: { userId } });
        if (!doctor) {
            throw new Error('Doctor profile not found');
        }

        const educationList = doctor.education || [];
        doctor.education = educationList.filter((e: any) => e.id !== educationId);
        doctor.profileSections = { ...doctor.profileSections, education: doctor.education.length > 0 };

        await doctor.save();
        await this.updateProfileCompletion(userId);

        logger.debug(`Education deleted for doctor: ${userId}`);
        return doctor;
    }

    /**
     * Add work experience
     */
    async addExperience(userId: string, experience: Omit<WorkExperience, 'isVerified'>): Promise<Doctor> {
        const doctor = await Doctor.findOne({ where: { userId } });
        if (!doctor) {
            throw new Error('Doctor profile not found');
        }

        const newExperience = {
            ...experience,
            id: uuidv4(),
            isVerified: false,
        };

        doctor.workExperience = [...(doctor.workExperience || []), newExperience];
        doctor.profileSections = { ...doctor.profileSections, experience: true };

        // Update years of experience
        await this.calculateYearsOfExperience(doctor);
        await doctor.save();
        await this.updateProfileCompletion(userId);

        logger.debug(`Experience added for doctor: ${userId}`);
        return doctor;
    }

    /**
     * Update experience entry
     */
    async updateExperience(userId: string, experienceId: string, data: Partial<WorkExperience>): Promise<Doctor> {
        const doctor = await Doctor.findOne({ where: { userId } });
        if (!doctor) {
            throw new Error('Doctor profile not found');
        }

        const expList = doctor.workExperience || [];
        const index = expList.findIndex((e: any) => e.id === experienceId);

        if (index === -1) {
            throw new Error('Experience entry not found');
        }

        const updatedExp = [...expList];
        updatedExp[index] = { ...updatedExp[index], ...data };
        doctor.workExperience = updatedExp;
        await this.calculateYearsOfExperience(doctor);
        await doctor.save();

        logger.debug(`Experience updated for doctor: ${userId}`);
        return doctor;
    }

    /**
     * Delete experience entry
     */
    async deleteExperience(userId: string, experienceId: string): Promise<Doctor> {
        const doctor = await Doctor.findOne({ where: { userId } });
        if (!doctor) {
            throw new Error('Doctor profile not found');
        }

        const expList = doctor.workExperience || [];
        doctor.workExperience = expList.filter((e: any) => e.id !== experienceId);
        doctor.profileSections = { ...doctor.profileSections, experience: doctor.workExperience.length > 0 };

        await this.calculateYearsOfExperience(doctor);
        await doctor.save();
        await this.updateProfileCompletion(userId);

        logger.debug(`Experience deleted for doctor: ${userId}`);
        return doctor;
    }

    /**
     * Add skill
     */
    async addSkill(userId: string, skill: Skill): Promise<Doctor> {
        const doctor = await Doctor.findOne({ where: { userId } });
        if (!doctor) {
            throw new Error('Doctor profile not found');
        }

        const newSkill = { ...skill, id: uuidv4() };
        doctor.skills = [...(doctor.skills || []), newSkill];
        doctor.profileSections = { ...doctor.profileSections, skills: true };

        await doctor.save();
        await this.updateProfileCompletion(userId);
        await this.updateSearchTags(doctor);

        logger.debug(`Skill added for doctor: ${userId}`);
        return doctor;
    }

    /**
     * Update skill
     */
    async updateSkill(userId: string, skillId: string, data: Partial<Skill>): Promise<Doctor> {
        const doctor = await Doctor.findOne({ where: { userId } });
        if (!doctor) {
            throw new Error('Doctor profile not found');
        }

        const skillsList = doctor.skills || [];
        const index = skillsList.findIndex((s: any) => s.id === skillId);

        if (index === -1) {
            throw new Error('Skill not found');
        }

        const updatedSkills = [...skillsList];
        updatedSkills[index] = { ...updatedSkills[index], ...data };
        doctor.skills = updatedSkills;
        await doctor.save();
        await this.updateSearchTags(doctor);

        logger.debug(`Skill updated for doctor: ${userId}`);
        return doctor;
    }

    /**
     * Delete skill
     */
    async deleteSkill(userId: string, skillId: string): Promise<Doctor> {
        const doctor = await Doctor.findOne({ where: { userId } });
        if (!doctor) {
            throw new Error('Doctor profile not found');
        }

        const skillsList = doctor.skills || [];
        doctor.skills = skillsList.filter((s: any) => s.id !== skillId);
        doctor.profileSections = { ...doctor.profileSections, skills: doctor.skills.length > 0 };

        await doctor.save();
        await this.updateProfileCompletion(userId);
        await this.updateSearchTags(doctor);

        logger.debug(`Skill deleted for doctor: ${userId}`);
        return doctor;
    }

    /**
     * Add license
     */
    async addLicense(userId: string, license: Omit<License, 'isVerified'>): Promise<Doctor> {
        const doctor = await Doctor.findOne({ where: { userId } });
        if (!doctor) {
            throw new Error('Doctor profile not found');
        }

        const newLicense = { ...license, id: uuidv4(), isVerified: false };
        doctor.licenses = [...(doctor.licenses || []), newLicense];
        doctor.profileSections = { ...doctor.profileSections, licensure: true };

        await doctor.save();
        await this.updateProfileCompletion(userId);

        logger.debug(`License added for doctor: ${userId}`);
        return doctor;
    }

    /**
     * Update license
     */
    async updateLicense(userId: string, licenseId: string, data: Partial<License>): Promise<Doctor> {
        const doctor = await Doctor.findOne({ where: { userId } });
        if (!doctor) {
            throw new Error('Doctor profile not found');
        }

        const licensesList = doctor.licenses || [];
        const index = licensesList.findIndex((l: any) => l.id === licenseId);

        if (index === -1) {
            throw new Error('License not found');
        }

        const updatedLicenses = [...licensesList];
        updatedLicenses[index] = { ...updatedLicenses[index], ...data };
        doctor.licenses = updatedLicenses;
        await doctor.save();

        logger.debug(`License updated for doctor: ${userId}`);
        return doctor;
    }

    /**
     * Delete license
     */
    async deleteLicense(userId: string, licenseId: string): Promise<Doctor> {
        const doctor = await Doctor.findOne({ where: { userId } });
        if (!doctor) {
            throw new Error('Doctor profile not found');
        }

        const licensesList = doctor.licenses || [];
        doctor.licenses = licensesList.filter((l: any) => l.id !== licenseId);
        doctor.profileSections = { ...doctor.profileSections, licensure: doctor.licenses.length > 0 };

        await doctor.save();
        await this.updateProfileCompletion(userId);

        logger.debug(`License deleted for doctor: ${userId}`);
        return doctor;
    }

    /**
     * Update career preferences
     */
    async updatePreferences(userId: string, preferences: Partial<CareerPreferences>): Promise<Doctor> {
        const doctor = await Doctor.findOne({ where: { userId } });
        if (!doctor) {
            throw new Error('Doctor profile not found');
        }

        doctor.careerPreferences = { ...doctor.careerPreferences, ...preferences };
        doctor.profileSections = { ...doctor.profileSections, preferences: true };

        await doctor.save();
        await this.updateProfileCompletion(userId);

        logger.debug(`Preferences updated for doctor: ${userId}`);
        return doctor;
    }

    /**
     * Update Aadhaar info
     */
    async updateAadhaar(userId: string, aadhaarInfo: Partial<AadhaarInfo>, maskedNumber?: string): Promise<Doctor> {
        const doctor = await Doctor.findOne({ where: { userId } });
        if (!doctor) {
            throw new Error('Doctor profile not found');
        }

        doctor.aadhaar = { ...doctor.aadhaar, ...aadhaarInfo };
        if (maskedNumber) {
            doctor.aadhaarNumber = maskedNumber;
        }

        // Update profile section for documents
        doctor.profileSections = {
            ...doctor.profileSections,
            documents: true,
        };

        await doctor.save();
        await this.updateProfileCompletion(userId);

        logger.debug(`Aadhaar updated for doctor: ${userId}`);
        return doctor;
    }

    /**
     * Search doctors with filters
     */
    async searchDoctors(filters: DoctorSearchFilters): Promise<PaginatedResult<Doctor>> {
        try {
            const page = filters.page || 1;
            const limit = filters.limit || 20;
            const offset = (page - 1) * limit;

            const where: any = {
                isSearchable: true,
            };

            if (filters.specialization) {
                where.specialization = filters.specialization;
            }

            if (filters.minExperience !== undefined || filters.maxExperience !== undefined) {
                where.yearsOfExperience = {};
                if (filters.minExperience !== undefined) {
                    where.yearsOfExperience[Op.gte] = filters.minExperience;
                }
                if (filters.maxExperience !== undefined) {
                    where.yearsOfExperience[Op.lte] = filters.maxExperience;
                }
            }

            // Handle city filter
            if (filters.city) {
                where[Op.and] = where[Op.and] || [];
                where[Op.and].push(
                    sequelize.where(
                        sequelize.fn('LOWER', sequelize.cast(sequelize.json('address.city'), 'text')),
                        'LIKE',
                        `%${filters.city.toLowerCase()}%`
                    )
                );
            }

            // Handle state filter
            if (filters.state) {
                where[Op.and] = where[Op.and] || [];
                where[Op.and].push(
                    sequelize.where(
                        sequelize.fn('LOWER', sequelize.cast(sequelize.json('address.state'), 'text')),
                        'LIKE',
                        `%${filters.state.toLowerCase()}%`
                    )
                );
            }

            // Handle availability filter
            if (filters.isAvailable !== undefined) {
                where.isAvailable = filters.isAvailable;
            }

            // Extract and trim text query
            const textQuery = filters.q?.trim();
            let textSearchConditions: any[] = [];
            
            if (textQuery) {
                logger.debug(`Text search query: ${textQuery}`);
                
                // Build OR conditions for multi-field search
                const searchPattern = `%${textQuery}%`;
                
                // Search in User.fullName (via include)
                textSearchConditions.push({
                    '$user.fullName$': { [Op.iLike]: searchPattern }
                });
                
                // Search in Doctor.specialization
                textSearchConditions.push({
                    specialization: { [Op.iLike]: searchPattern }
                });
                
                // Search in Doctor.address->>'city' using JSONB extraction
                textSearchConditions.push(
                    sequelize.where(
                        sequelize.fn('LOWER', sequelize.cast(sequelize.json('address.city'), 'text')),
                        'LIKE',
                        searchPattern.toLowerCase()
                    )
                );
                
                // Add text search to where clause using Op.and to combine with other filters
                where[Op.and] = where[Op.and] || [];
                where[Op.and].push({ [Op.or]: textSearchConditions });
            }

            // Handle sorting
            let orderClause: any[] = [];
            if (filters.sortBy) {
                // Remove leading '-' if present (indicates descending order)
                const sortField = filters.sortBy.startsWith('-') ? filters.sortBy.substring(1) : filters.sortBy;
                const sortDirection = filters.sortBy.startsWith('-') ? 'DESC' : 'ASC';
                
                // Map frontend field names to backend field names
                const fieldMap: { [key: string]: string } = {
                    'doctorProfile.yearsOfExperience': 'yearsOfExperience',
                    'doctorProfile.isAvailable': 'isAvailable',
                    'createdAt': 'createdAt',
                };
                
                const mappedField = fieldMap[sortField] || sortField;
                orderClause.push([mappedField, sortDirection]);
            } else {
                // Default sorting
                orderClause.push(['yearsOfExperience', 'DESC']);
            }

            const { count, rows } = await Doctor.findAndCountAll({
                where,
                limit,
                offset,
                include: [{ association: 'user', attributes: ['fullName', 'avatarUrl'] }],
                order: orderClause,
                subQuery: false, // Disable subquery to properly handle count with joins
                distinct: true, // Ensure distinct count when using joins
            });

            const totalPages = Math.ceil(count / limit);

            // Transform the results to flatten the structure for the frontend
            const mappedRows = rows.map((doc: any) => {
                const user = doc.user;
                return {
                    ...doc.toJSON(),
                    displayName: user?.fullName || `${doc.firstName} ${doc.lastName}`.trim(),
                    name: user?.fullName || `${doc.firstName} ${doc.lastName}`.trim(),
                    avatar: user?.avatarUrl,
                    role: doc.specialization, // Ensure role is populated
                };
            });

            return {
                data: mappedRows,
                meta: {
                    page,
                    limit,
                    totalItems: count,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1,
                },
            };
        } catch (error) {
            logger.error('Error in searchDoctors:', error);
            throw error;
        }
    }

    /**
     * Calculate years of experience
     */
    private async calculateYearsOfExperience(doctor: Doctor): Promise<void> {
        const experiences = doctor.workExperience || [];
        let totalMonths = 0;

        for (const exp of experiences) {
            const startDate = new Date(exp.startDate);
            const endDate = exp.isCurrent ? new Date() : new Date(exp.endDate || new Date());
            const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                (endDate.getMonth() - startDate.getMonth());
            totalMonths += Math.max(0, months);
        }

        doctor.yearsOfExperience = Math.floor(totalMonths / 12);
    }

    /**
     * Update profile completion percentage
     */
    private async updateProfileCompletion(userId: string): Promise<void> {
        const doctor = await Doctor.findOne({ where: { userId } });
        if (!doctor) return;

        const user = await User.findByPk(userId);
        if (!user) return;

        const completion = doctor.calculateProfileCompletion();
        user.profileCompletionPercentage = completion;
        user.isProfileComplete = completion >= 70;
        await user.save();
    }

    /**
     * Update search tags for better discoverability
     */
    private async updateSearchTags(doctor: Doctor): Promise<void> {
        const tags: string[] = [];

        if (doctor.specialization) {
            tags.push(doctor.specialization.toLowerCase());
        }

        for (const sub of doctor.subSpecializations || []) {
            tags.push(sub.toLowerCase());
        }

        for (const skill of doctor.skills || []) {
            tags.push(skill.name.toLowerCase());
        }

        if (doctor.address?.city) {
            tags.push(doctor.address.city.toLowerCase());
        }

        doctor.searchTags = [...new Set(tags)];
        await doctor.save();
    }

    /**
     * Get dashboard data for doctor
     */
    async getDashboard(userId: string): Promise<any> {
        const doctor = await Doctor.findOne({
            where: { userId },
            include: [{ association: 'user' }],
        });

        if (!doctor) {
            throw new Error('Doctor profile not found');
        }

        return {
            profile: doctor,
            stats: doctor.platformStats,
            profileCompletion: doctor.calculateProfileCompletion(),
        };
    }

    /**
     * Update platform statistics for a doctor
     */
    async updatePlatformStats(userId: string): Promise<void> {
        const doctor = await Doctor.findOne({ where: { userId } });
        if (!doctor) return;

        // Run all COUNT queries in parallel — no records loaded into memory
        const [completedJobs, totalShifts, daysPresent, noShows] = await Promise.all([
            Assignment.count({
                where: { doctorId: userId, status: AssignmentStatus.COMPLETED },
            }),
            Attendance.count({ where: { doctorId: userId } }),
            Attendance.count({ where: { doctorId: userId, status: AttendanceStatus.PRESENT } }),
            Attendance.count({ where: { doctorId: userId, status: AttendanceStatus.ABSENT } }),
        ]);

        const attendanceRate = totalShifts > 0
            ? Math.round((daysPresent / totalShifts) * 100)
            : 100;

        const currentStats = doctor.platformStats || {
            jobsCompleted: 0,
            totalShifts: 0,
            noShows: 0,
            attendanceRate: 100,
            rating: 0,
            totalReviews: 0,
            performanceScore: 0,
        };

        doctor.platformStats = {
            ...currentStats,
            jobsCompleted: completedJobs,
            totalShifts,
            noShows,
            attendanceRate,
        };

        await doctor.save();
    }

    /**
     * Get platform experience (Assignments)
     */
    async getPlatformExperience(userId: string): Promise<any[]> {
        const assignments = await Assignment.findAll({
            where: { doctorId: userId },
            include: [
                { association: 'assignmentHospital', attributes: ['id', 'fullName', 'phoneNumber', 'email'] }, // Hospital User
                { association: 'job', attributes: ['id', 'title', 'department', 'jobType'] }
            ],
            order: [['startDate', 'DESC']]
        });

        return assignments.map(asn => ({
            id: asn.id,
            role: asn.title || asn.job?.title || 'Doctor',
            hospitalName: asn.assignmentHospital?.fullName || 'Hospital',
            department: asn.department || asn.job?.department || '',
            startDate: asn.startDate,
            endDate: asn.endDate,
            isCurrent: asn.isOngoing || asn.status === AssignmentStatus.ACTIVE,
            status: asn.status,
            type: 'Platform'
        }));
    }
}

// Export singleton instance
export const doctorService = new DoctorService();
export default doctorService;
