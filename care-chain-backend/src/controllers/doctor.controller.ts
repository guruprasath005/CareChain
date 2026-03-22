// src/controllers/doctor.controller.ts
// Doctor Controller - Full implementations using services

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { ApiResponse } from '../utils/response';
import { doctorService } from '../services/doctor.service';
import { applicationService } from '../services/application.service';
import { assignmentService } from '../services/assignment.service';
import { attendanceService } from '../services/attendance.service';
import { leaveService } from '../services/leave.service';
import { jobService } from '../services/job.service';
import { recommendationService } from '../services/recommendation.service';
import { uploadService } from '../services/upload.service';
import { User } from '../models/User.model';
import { JobType, LeaveType, ApplicationStatus } from '../models/types';

/**
 * Doctor Controller
 */
export const doctorController = {
  // =====================================
  // PROFILE MANAGEMENT
  // =====================================

  /**
   * GET /doctor/profile
   * Get doctor's public profile view
   */
  async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      // Refresh stats in the background — do not block the profile response.
      // The profile returns the last-calculated stats stored in platformStats.
      doctorService.updatePlatformStats(userId).catch(() => {});

      const doctor = await doctorService.getProfileByUserId(userId);

      if (!doctor) {
        ApiResponse.notFound(res, 'Doctor profile not found');
        return;
      }

      // Calculate profile completion with sections
      const completionPercentage = doctor.calculateProfileCompletion();
      const profileSections = doctor.profileSections || {};

      // Build displayName
      const displayName = doctor.getDisplayName();
      const fullName = `${doctor.firstName || ''} ${doctor.lastName || ''}`.trim();

      // Build location object
      const location = doctor.address ? {
        city: doctor.address.city,
        state: doctor.address.state,
        fullAddress: doctor.getFullAddress(),
      } : undefined;

      // Build verification status
      const verification = {
        email: doctor.user?.isEmailVerified || false,
        aadhaar: {
          verified: doctor.aadhaar?.isVerified || false,
          maskedNumber: doctor.aadhaarNumber || undefined,
        },
      };

      // Job Preferences from careerPreferences
      const prefs = doctor.careerPreferences || {};
      const jobPreferences = {
        shortTermJobs: prefs.shortTermJobs,
        longTermJobs: prefs.longTermJobs,
        paymentPreference: prefs.paymentPreference,
        expectedHourlyRate: prefs.expectedHourlyRate,
        expectedDailyRate: prefs.expectedDailyRate,
        expectedMonthlyRate: prefs.expectedMonthlyRate,
        expectedPerPatientRate: prefs.expectedPerPatientRate,
        mealsIncluded: prefs.mealsIncluded,
        transportIncluded: prefs.transportIncluded,
        accommodationIncluded: prefs.accommodationIncluded,
        availability: prefs.availability,
        preferredLocations: prefs.preferredLocations,
        willingToRelocate: prefs.willingToRelocate,
        willingToTravel: prefs.willingToTravel,
      };

      // Build platform stats
      const platformStats = doctor.platformStats || {};
      const stats = {
        shiftsDone: platformStats.totalShifts || 0,
        noShows: platformStats.noShows || 0,
        performance: platformStats.performanceScore || 0,
        rating: platformStats.rating || 0,
        jobsCompleted: platformStats.jobsCompleted || 0,
        attendanceRate: platformStats.attendanceRate || 100,
      };

      // Get platform experience
      const platformExperience = await doctorService.getPlatformExperience(userId);

      // Prepare complete profile view
      const profile = {
        id: doctor.id,
        email: doctor.user?.email || '',
        phone: doctor.user?.getMaskedPhone() || undefined,
        phoneNumber: doctor.user?.phoneNumber || undefined,
        phoneCountryCode: doctor.user?.phoneCountryCode || '+91',
        isPhoneVerified: doctor.user?.isPhoneVerified || false,
        firstName: doctor.firstName,
        lastName: doctor.lastName,
        name: fullName,
        displayName,
        fullName,
        gender: doctor.gender,
        avatar: doctor.user?.avatarUrl || null,
        specialization: doctor.specialization,
        subSpecializations: doctor.subSpecializations,
        designation: doctor.designation,
        currentHospital: doctor.currentHospital,
        bio: doctor.bio,
        yearsOfExperience: doctor.yearsOfExperience,
        education: doctor.education,
        experience: doctor.workExperience,
        skills: doctor.skills,
        licenses: doctor.licenses,
        address: doctor.address,
        location,
        verification,
        jobPreferences,
        stats,
        platformExperience,
        isSearchable: doctor.isSearchable,
        profileCompletion: {
          percentage: completionPercentage,
          sections: profileSections,
          isComplete: completionPercentage >= 70,
        },
        profileCompletionDetails: {
          percentage: completionPercentage,
          sections: profileSections,
          isComplete: completionPercentage >= 70,
        },
      };

      ApiResponse.success(res, { profile }, 'Profile retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /doctor/profile/edit
   * Get doctor's profile for editing (includes all fields)
   */
  async getEditProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const doctor = await doctorService.getProfileByUserId(userId);

      if (!doctor) {
        ApiResponse.notFound(res, 'Doctor profile not found');
        return;
      }

      // Get platform experience
      const platformExperience = await doctorService.getPlatformExperience(userId);

      // Build platform stats
      const platformStats = doctor.platformStats || {};
      const stats = {
        shiftsDone: platformStats.totalShifts || 0,
        noShows: platformStats.noShows || 0,
        performance: platformStats.performanceScore || 0,
        rating: platformStats.rating || 0,
        jobsCompleted: platformStats.jobsCompleted || 0,
        attendanceRate: platformStats.attendanceRate || 100,
      };

      // Build structured edit DTO for frontend
      const editProfile = {
        id: doctor.id,
        email: doctor.user?.email || '',
        displayName: doctor.getDisplayName(),
        avatar: doctor.user?.avatarUrl || null,

        // Platform Experience
        platformExperience,

        // Phone Info
        phone: {
          number: doctor.user?.phoneNumber || '',
          countryCode: doctor.user?.phoneCountryCode || '+91',
          isVerified: doctor.user?.isPhoneVerified || false,
          maskedNumber: doctor.user?.getMaskedPhone() || undefined,
        },

        // Metadatal Info Section
        personal: {
          firstName: doctor.firstName || '',
          lastName: doctor.lastName || '',
          gender: doctor.gender || '',
          dateOfBirth: doctor.dateOfBirth || '',
          address: doctor.address || {},
          aadhaar: {
            maskedNumber: doctor.aadhaarNumber || undefined,
            isVerified: doctor.aadhaar?.isVerified || false,
            documentUrl: doctor.aadhaar?.documentUrl?.front || undefined,
          },
        },
        // Stats
        stats,


        // Sections completion
        education: (doctor.education || []).map((edu: any) => ({
          id: edu.id,
          institution: edu.institution,
          degree: edu.degree,
          specialization: edu.specialization,
          startYear: edu.startYear,
          endYear: edu.endYear,
          documentUrl: edu.documentUrl,
          isVerified: edu.isVerified || false,
        })),

        // Licensure Section
        licensure: {
          licenses: (doctor.licenses || []).map((lic: any) => ({
            id: lic.id,
            registrationNumber: lic.registrationNumber,
            issuingAuthority: lic.issuingAuthority,
            validFrom: lic.validFrom,
            validTill: lic.validTill,
            documentUrl: lic.documentUrl,
            isVerified: lic.isVerified || false,
          })),
        },

        // Skills Section
        skills: (doctor.skills || []).map((skill: any) => ({
          id: skill.id,
          name: skill.name,
          level: skill.level,
          certifyingAuthority: skill.certifyingAuthority,
          validTill: skill.validTill,
          experienceYears: skill.experienceYears,
          certificate: skill.certificate,
        })),

        // Experience Section
        experience: (doctor.workExperience || []).map((exp: any) => ({
          id: exp.id,
          role: exp.role,
          institution: exp.institution,
          department: exp.department,
          startDate: exp.startDate,
          endDate: exp.endDate,
          isCurrent: exp.isCurrent || false,
          description: exp.description,
          documents: exp.documents || [],
          isVerified: exp.isVerified || false,
        })),

        // Job Preferences Section
        jobPreferences: {
          shortTermJobs: doctor.careerPreferences?.shortTermJobs,
          longTermJobs: doctor.careerPreferences?.longTermJobs,
          paymentPreference: doctor.careerPreferences?.paymentPreference,
          expectedHourlyRate: doctor.careerPreferences?.expectedHourlyRate,
          expectedDailyRate: doctor.careerPreferences?.expectedDailyRate,
          expectedMonthlyRate: doctor.careerPreferences?.expectedMonthlyRate,
          expectedPerPatientRate: doctor.careerPreferences?.expectedPerPatientRate,
          experienceYears: doctor.careerPreferences?.experienceYears,
          preferredLocations: doctor.careerPreferences?.preferredLocations || [],
          availability: doctor.careerPreferences?.availability,
        },

        // Profile Completion
        profileSections: doctor.profileSections || {},
        profileCompletionPercentage: doctor.calculateProfileCompletion(),
      };

      ApiResponse.success(res, { profile: editProfile }, 'Edit profile retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /doctor/profile/personal
   * Update personal information
   */
  async updatePersonalInfo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const data = req.body;

      const doctor = await doctorService.updatePersonalInfo(userId, data);
      ApiResponse.success(res, { profile: doctor }, 'Personal info updated');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /doctor/profile/bio
   * Update bio/about section
   */
  async updateBio(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { bio } = req.body;

      const doctor = await doctorService.updatePersonalInfo(userId, { bio });
      ApiResponse.success(res, { profile: doctor }, 'Bio updated');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /doctor/profile/avatar
   * Upload profile avatar
   */
  async uploadAvatar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const file = req.file;

      console.log('Upload Avatar Request Received');
      console.log('User ID:', userId);
      console.log('File:', file ? {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      } : 'No file');

      if (!file) {
        console.log('Error: No file uploaded');
        ApiResponse.badRequest(res, 'No file uploaded');
        return;
      }

      const fileInfo = {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        buffer: file.buffer
      };

      const result = await uploadService.uploadAvatar(fileInfo, userId);
      console.log('Upload Result:', result);

      if (!result.success || !result.fileUrl) {
        console.log('Error: Upload service failed', result.error);
        ApiResponse.badRequest(res, result.error || 'Upload failed');
        return;
      }
      const avatarUrl = result.secureUrl || result.fileUrl;

      const doctor = await doctorService.getProfileByUserId(userId);
      if (doctor && doctor.user) {
        doctor.user.avatarUrl = avatarUrl;
        doctor.user.avatarPublicId = result.publicId || null;
        await doctor.user.save();
      }

      ApiResponse.success(res, { avatarUrl, publicId: result.publicId }, 'Avatar uploaded');
    } catch (error) {
      next(error);
    }
  },

  // =====================================
  // AADHAAR VERIFICATION
  // =====================================

  /**
   * POST /doctor/aadhaar/generate-otp
   * Generate OTP for Aadhaar verification
   */
  async generateAadhaarOtp(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Aadhaar verification requires external API integration
      ApiResponse.success(res, { message: 'Aadhaar OTP generation requires external API' }, 'OTP request initiated');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /doctor/aadhaar/verify
   * Verify Aadhaar with OTP
   */
  async verifyAadhaar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Aadhaar verification requires external API integration
      ApiResponse.success(res, { verified: false, message: 'Aadhaar verification requires external API' }, 'Verification pending');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /doctor/profile/aadhaar
   * Update Aadhaar info manually
   */
  async updateAadhaarInfo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { aadhaarNumber } = req.body;

      // Mask the Aadhaar number (show only last 4 digits)
      const maskedNumber = `XXXX-XXXX-${aadhaarNumber.slice(-4)}`;

      const doctor = await doctorService.updateAadhaar(userId, { isVerified: false }, maskedNumber);
      ApiResponse.success(res, { profile: doctor }, 'Aadhaar info updated');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /doctor/profile/aadhaar/document
   * Upload Aadhaar document
   */
  async uploadAadhaarDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const file = req.file;

      if (!file) {
        ApiResponse.badRequest(res, 'No file uploaded');
        return;
      }

      const fileInfo = {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        buffer: file.buffer
      };

      const result = await uploadService.uploadAadhaarDocument(fileInfo, userId);
      if (!result.success || !result.fileUrl) {
        ApiResponse.badRequest(res, result.error || 'Upload failed');
        return;
      }
      const documentUrl = result.secureUrl || result.fileUrl;

      const doctor = await doctorService.updateAadhaar(userId, { documentUrl: { front: documentUrl } });
      ApiResponse.success(res, { documentUrl, publicId: result.publicId, profile: doctor }, 'Aadhaar document uploaded');
    } catch (error) {
      next(error);
    }
  },

  // =====================================
  // PHONE VERIFICATION
  // =====================================

  /**
   * POST /doctor/phone/send-otp
   * Send OTP to phone number for verification
   */
  async sendPhoneOtp(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { phoneNumber, countryCode = '+91' } = req.body;

      if (!phoneNumber) {
        ApiResponse.badRequest(res, 'Phone number is required');
        return;
      }

      // Validate phone number format (10 digits for India)
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        ApiResponse.badRequest(res, 'Please enter a valid 10-digit phone number');
        return;
      }

      const user = await User.findByPk(userId);
      if (!user) {
        ApiResponse.notFound(res, 'User not found');
        return;
      }

      // Generate OTP (6 digits)
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store OTP in user record
      user.otpCode = otp;
      user.otpExpiresAt = otpExpires;
      user.otpType = 'phone_verification' as any;
      await user.save();

      // In production, send OTP via SMS service (Twilio, MSG91, etc.)
      // For now, we'll just return success and log the OTP
      console.log(`[DEV] Phone OTP for ${countryCode} ${cleanPhone}: ${otp}`);

      ApiResponse.success(res, {
        message: 'OTP sent successfully',
        phoneNumber: cleanPhone,
        countryCode,
        // Include OTP in development mode only
        ...(process.env.NODE_ENV !== 'production' && { devOtp: otp })
      }, 'OTP sent to your phone number');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /doctor/phone/verify-otp
   * Verify phone OTP and save phone number
   */
  async verifyPhoneOtp(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { phoneNumber, otp, countryCode = '+91' } = req.body;

      if (!phoneNumber || !otp) {
        ApiResponse.badRequest(res, 'Phone number and OTP are required');
        return;
      }

      const cleanPhone = phoneNumber.replace(/\D/g, '');

      const user = await User.findByPk(userId);
      if (!user) {
        ApiResponse.notFound(res, 'User not found');
        return;
      }

      // Verify OTP
      if (!user.otpCode || !user.otpExpiresAt) {
        ApiResponse.badRequest(res, 'No OTP found. Please request a new one.');
        return;
      }

      if (new Date() > user.otpExpiresAt) {
        ApiResponse.badRequest(res, 'OTP has expired. Please request a new one.');
        return;
      }

      if (user.otpCode !== otp) {
        ApiResponse.badRequest(res, 'Invalid OTP. Please try again.');
        return;
      }

      // OTP is valid, save phone number
      user.phoneCountryCode = countryCode;
      user.phoneNumber = cleanPhone;
      user.isPhoneVerified = true;
      user.otpCode = null;
      user.otpExpiresAt = null;
      user.otpType = null;
      await user.save();

      ApiResponse.success(res, {
        message: 'Phone number verified successfully',
        phone: user.getMaskedPhone(),
        isPhoneVerified: true
      }, 'Phone number verified and saved');
    } catch (error) {
      next(error);
    }
  },

  // =====================================
  // EDUCATION
  // =====================================

  /**
   * POST /doctor/education
   * Add education entry
   */
  async addEducation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const educationData = req.body;

      const doctor = await doctorService.addEducation(userId, educationData);
      ApiResponse.created(res, { profile: doctor }, 'Education added');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /doctor/education/:id
   * Update education entry
   */
  async updateEducation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const educationData = req.body;

      const doctor = await doctorService.updateEducation(userId, id, educationData);
      ApiResponse.success(res, { profile: doctor }, 'Education updated');
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /doctor/education/:id
   * Delete education entry
   */
  async deleteEducation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const doctor = await doctorService.deleteEducation(userId, id);
      ApiResponse.success(res, { profile: doctor }, 'Education deleted');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /doctor/education/:id/document
   * Upload education document
   */
  async uploadEducationDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        ApiResponse.badRequest(res, 'No file uploaded');
        return;
      }

      const fileInfo = {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        buffer: file.buffer
      };

      const result = await uploadService.uploadEducationDocument(fileInfo, userId, id);
      if (!result.success || !result.fileUrl) {
        ApiResponse.badRequest(res, result.error || 'Upload failed');
        return;
      }
      const documentUrl = result.secureUrl || result.fileUrl;

      // Update education with document URL
      const doctor = await doctorService.updateEducation(userId, id, { documentUrl });
      ApiResponse.success(res, { documentUrl, publicId: result.publicId, profile: doctor }, 'Education document uploaded');
    } catch (error) {
      next(error);
    }
  },

  // =====================================
  // EXPERIENCE
  // =====================================

  /**
   * POST /doctor/experience
   * Add experience entry
   */
  async addExperience(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const experienceData = req.body;

      const doctor = await doctorService.addExperience(userId, experienceData);
      ApiResponse.created(res, { profile: doctor }, 'Experience added');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /doctor/experience/:id
   * Update experience entry
   */
  async updateExperience(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const experienceData = req.body;

      const doctor = await doctorService.updateExperience(userId, id, experienceData);
      ApiResponse.success(res, { profile: doctor }, 'Experience updated');
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /doctor/experience/:id
   * Delete experience entry
   */
  async deleteExperience(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const doctor = await doctorService.deleteExperience(userId, id);
      ApiResponse.success(res, { profile: doctor }, 'Experience deleted');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /doctor/experience/:id/document
   * Upload experience document
   */
  async uploadExperienceDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        ApiResponse.badRequest(res, 'No file uploaded');
        return;
      }

      const fileInfo = {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        buffer: file.buffer
      };

      const result = await uploadService.uploadDocument(fileInfo, userId, 'experience');
      if (!result.success || !result.fileUrl) {
        ApiResponse.badRequest(res, result.error || 'Upload failed');
        return;
      }
      const documentUrl = result.fileUrl;
      // Use type assertion to handle JSONB type flexibility
      const doctor = await doctorService.updateExperience(userId, id, { documents: [documentUrl] } as any);
      ApiResponse.success(res, { documentUrl, profile: doctor }, 'Experience document uploaded');
    } catch (error) {
      next(error);
    }
  },

  // =====================================
  // SKILLS
  // =====================================

  /**
   * POST /doctor/skills
   * Add skill
   */
  async addSkill(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const skillData = req.body;

      const doctor = await doctorService.addSkill(userId, skillData);
      ApiResponse.created(res, { profile: doctor }, 'Skill added');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /doctor/skills/:id
   * Update skill
   */
  async updateSkill(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const skillData = req.body;

      const doctor = await doctorService.updateSkill(userId, id, skillData);
      ApiResponse.success(res, { profile: doctor }, 'Skill updated');
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /doctor/skills/:id
   * Delete skill
   */
  async deleteSkill(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const doctor = await doctorService.deleteSkill(userId, id);
      ApiResponse.success(res, { profile: doctor }, 'Skill deleted');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /doctor/skills/:id/certificate
   * Upload skill certificate
   */
  async uploadSkillCertificate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        ApiResponse.badRequest(res, 'No file uploaded');
        return;
      }

      const fileInfo = {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        buffer: file.buffer
      };

      const result = await uploadService.uploadDocument(fileInfo, userId, 'certificate');
      if (!result.success || !result.fileUrl) {
        ApiResponse.badRequest(res, result.error || 'Upload failed');
        return;
      }
      const certificateUrl = result.fileUrl;
      // Use type assertion to handle JSONB type flexibility
      const doctor = await doctorService.updateSkill(userId, id, { certificate: certificateUrl } as any);
      ApiResponse.success(res, { certificateUrl, profile: doctor }, 'Skill certificate uploaded');
    } catch (error) {
      next(error);
    }
  },

  // =====================================
  // LICENSES
  // =====================================

  /**
   * POST /doctor/licensure/licenses
   * Add license
   */
  async addLicense(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const licenseData = req.body;

      const doctor = await doctorService.addLicense(userId, licenseData);
      ApiResponse.created(res, { profile: doctor }, 'License added');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /doctor/licensure/licenses/:id
   * Update license
   */
  async updateLicense(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const licenseData = req.body;

      const doctor = await doctorService.updateLicense(userId, id, licenseData);
      ApiResponse.success(res, { profile: doctor }, 'License updated');
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /doctor/licensure/licenses/:id
   * Delete license
   */
  async deleteLicense(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const doctor = await doctorService.deleteLicense(userId, id);
      ApiResponse.success(res, { profile: doctor }, 'License deleted');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /doctor/licensure/licenses/:id/document
   * Upload license document
   */
  async uploadLicenseDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        ApiResponse.badRequest(res, 'No file uploaded');
        return;
      }

      const fileInfo = {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        buffer: file.buffer
      };

      const result = await uploadService.uploadLicenseDocument(fileInfo, userId, id);
      if (!result.success || !result.fileUrl) {
        ApiResponse.badRequest(res, result.error || 'Upload failed');
        return;
      }
      const documentUrl = result.secureUrl || result.fileUrl;
      const doctor = await doctorService.updateLicense(userId, id, { documentUrl });
      ApiResponse.success(res, { documentUrl, publicId: result.publicId, profile: doctor }, 'License document uploaded');
    } catch (error) {
      next(error);
    }
  },

  // =====================================
  // PREFERENCES
  // =====================================

  /**
   * PUT /doctor/preferences
   * Update job preferences
   */
  async updatePreferences(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const preferences = req.body;

      const doctor = await doctorService.updatePreferences(userId, preferences);
      ApiResponse.success(res, { profile: doctor }, 'Preferences updated');
    } catch (error) {
      next(error);
    }
  },

  // =====================================
  // JOBS
  // =====================================

  /**
   * GET /doctor/jobs
   * Get available jobs for doctor (personalized recommendations)
   */
  async getJobs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const {
        page = '1',
        limit = '20',
        search,
        specialization,
        location,
        jobType,
        salaryMin,
        salaryMax,
      } = req.query;

      // Try to get recommended jobs first
      try {
        const recommendations = await recommendationService.getRecommendedJobsForDoctor(
          userId,
          Number(page),
          Number(limit)
        );

        ApiResponse.paginated(
          res,
          recommendations.jobs.map(r => ({
            ...r.job.toJSON(),
            matchScore: r.matchScore,
            matchDetails: r.matchDetails,
            hasApplied: r.hasApplied,
          })),
          Number(page),
          Number(limit),
          recommendations.total,
          'Recommended jobs retrieved'
        );
        return;
      } catch {
        // Fall back to regular search if recommendations fail
      }

      // Regular job search
      const result = await jobService.searchJobs({
        search: search as string,
        specialization: specialization as string,
        city: (location as string)?.split(',')[0]?.trim(),
        jobType: jobType as JobType,
        minSalary: salaryMin ? Number(salaryMin) : undefined,
        maxSalary: salaryMax ? Number(salaryMax) : undefined,
        page: Number(page),
        limit: Number(limit),
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
   * GET /doctor/jobs/:id
   * Get job details
   */
  async getJobDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const job = await jobService.getJobWithStats(id);
      if (!job) {
        ApiResponse.notFound(res, 'Job not found');
        return;
      }

      // Check if doctor has already applied
      const applications = await applicationService.getApplications({
        jobId: id,
        doctorId: userId,
        limit: 1,
      });
      const hasApplied = applications.data.length > 0;
      const applicationStatus = hasApplied ? applications.data[0].status : null;

      // Get match score
      let matchScore = null;
      try {
        const match = await recommendationService.getMatchScore(userId, id);
        matchScore = match;
      } catch {
        // Ignore if match score fails
      }

      ApiResponse.success(res, {
        job,
        hasApplied,
        applicationStatus,
        matchScore,
      }, 'Job details retrieved');
    } catch (error) {
      next(error);
    }
  },

  // =====================================
  // APPLICATIONS
  // =====================================

  /**
   * GET /doctor/applications
   * Get doctor's job applications
   */
  async getApplications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { status, page = '1', limit = '20' } = req.query;

      // Filter out invalid status values (like string 'undefined')
      const validStatus = status && status !== 'undefined' && status !== ''
        ? status as ApplicationStatus
        : undefined;

      const result = await applicationService.getDoctorApplications(
        userId,
        validStatus,
        Number(page),
        Number(limit)
      );

      ApiResponse.paginated(
        res,
        result.data,
        result.meta.page,
        result.meta.limit,
        result.meta.totalItems,
        'Applications retrieved'
      );
    } catch (error) {
      next(error);
    }
  },

  // =====================================
  // ACTIVE JOBS (ASSIGNMENTS)
  // =====================================

  /**
   * GET /doctor/active-jobs
   * Get doctor's active job assignments
   */
  async getActiveJobs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const assignments = await assignmentService.getDoctorActiveAssignments(userId);

      // Batch-fetch attendance and leave counts in 2 queries instead of 2N
      const assignmentIds = assignments.map((a) => a.id);
      const [attendanceMap, leaveCountMap] = await Promise.all([
        assignmentService.getBulkTodayAttendance(assignmentIds),
        assignmentService.getBulkPendingLeaveCount(assignmentIds),
      ]);

      const enhancedAssignments = assignments.map((assignment) => ({
        ...assignment.toJSON(),
        todayAttendance: attendanceMap.get(assignment.id) ?? null,
        pendingLeavesCount: leaveCountMap.get(assignment.id) ?? 0,
      }));

      ApiResponse.success(res, { activeJobs: enhancedAssignments }, 'Active jobs retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /doctor/active-jobs/:id/schedule
   * Get schedule for an active job
   */
  async getSchedule(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      const assignment = await assignmentService.getAssignmentById(id);
      if (!assignment) {
        ApiResponse.notFound(res, 'Assignment not found');
        return;
      }

      const { entries, meta } = await assignmentService.getScheduleEntries(id);

      // Get attendance records for the date range
      const start = startDate ? new Date(startDate as string) : new Date();
      start.setDate(start.getDate() - 30); // Default to last 30 days
      const end = endDate ? new Date(endDate as string) : new Date();

      const attendanceRecords = await attendanceService.getAttendanceForRange(id, start, end);

      ApiResponse.success(res, {
        assignment: assignment.toJSON(),
        schedule: entries,
        scheduleMeta: meta,
        attendance: attendanceRecords,
      }, 'Schedule retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /doctor/active-jobs/:id/check-in
   * Check in for work
   */
  async checkIn(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: assignmentId } = req.params;
      const userId = req.user!.id;
      const { location, notes } = req.body;

      const attendance = await attendanceService.checkIn(assignmentId, userId, {
        location,
        notes,
        method: 'app',
      });

      ApiResponse.success(res, { attendance }, 'Checked in successfully');
    } catch (error: any) {
      if (error.message.includes('already checked in') || error.message.includes('not found')) {
        ApiResponse.badRequest(res, error.message);
        return;
      }
      next(error);
    }
  },

  /**
   * POST /doctor/active-jobs/:id/check-out
   * Check out from work
   */
  async checkOut(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: assignmentId } = req.params;
      const userId = req.user!.id;
      const { location, notes } = req.body;

      const attendance = await attendanceService.checkOut(assignmentId, userId, location, notes);

      ApiResponse.success(res, { attendance }, 'Checked out successfully');
    } catch (error: any) {
      if (error.message.includes('No check-in') || error.message.includes('not found')) {
        ApiResponse.badRequest(res, error.message);
        return;
      }
      next(error);
    }
  },

  // =====================================
  // LEAVE REQUESTS
  // =====================================

  /**
   * POST /doctor/leave-requests
   * Create leave request
   */
  async createLeaveRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { assignmentId, leaveType, startDate, endDate, reason, isHalfDay, halfDayPeriod } = req.body;

      const leaveRequest = await leaveService.createLeaveRequest(assignmentId, userId, {
        leaveType: leaveType as LeaveType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        isHalfDay,
        halfDayPeriod,
      });

      ApiResponse.created(res, { leaveRequest }, 'Leave request submitted');
    } catch (error: any) {
      if (error.message.includes('overlap') || error.message.includes('not found')) {
        ApiResponse.badRequest(res, error.message);
        return;
      }
      next(error);
    }
  },

  /**
   * GET /doctor/leave-requests
   * Get leave requests
   */
  async getLeaveRequests(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { status, assignmentId, page = '1', limit = '20' } = req.query;

      const result = await leaveService.getLeaveRequests({
        doctorId: userId,
        assignmentId: assignmentId as string,
        status: status as any,
        page: Number(page),
        limit: Number(limit),
      });

      ApiResponse.paginated(
        res,
        result.data,
        result.meta.page,
        result.meta.limit,
        result.meta.totalItems,
        'Leave requests retrieved'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /doctor/leave-requests/:id
   * Cancel leave request
   */
  async cancelLeaveRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await leaveService.cancelLeaveRequest(id, userId);
      ApiResponse.success(res, null, 'Leave request cancelled');
    } catch (error: any) {
      if (error.message.includes('Cannot cancel') || error.message.includes('not found')) {
        ApiResponse.badRequest(res, error.message);
        return;
      }
      next(error);
    }
  },

  // =====================================
  // OFFER MANAGEMENT
  // =====================================

  /**
   * GET /doctor/applications/:id/offer
   * Get offer details for an application
   */
  async getOfferDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const offer = await applicationService.getOfferStatus(id, userId);

      if (!offer) {
        ApiResponse.notFound(res, 'No offer found for this application');
        return;
      }

      ApiResponse.success(res, { offer }, 'Offer details retrieved');
    } catch (error: any) {
      if (error.message.includes('not found')) {
        ApiResponse.notFound(res, error.message);
        return;
      }
      next(error);
    }
  },

  /**
   * POST /doctor/applications/:id/offer/accept
   * Accept a job offer - automatically creates assignment/employee record
   */
  async acceptOffer(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const { application, assignment } = await applicationService.acceptOffer(id, userId);
      ApiResponse.success(res, { application, assignment }, 'Offer accepted successfully! You are now hired.');
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('not available')) {
        ApiResponse.notFound(res, error.message);
        return;
      }
      if (error.message.includes('expired')) {
        ApiResponse.badRequest(res, error.message);
        return;
      }
      next(error);
    }
  },

  /**
   * POST /doctor/applications/:id/offer/decline
   * Decline a job offer
   */
  async declineOffer(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { reason } = req.body;

      const application = await applicationService.declineOffer(id, userId, reason);
      ApiResponse.success(res, { application }, 'Offer declined');
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('not available')) {
        ApiResponse.notFound(res, error.message);
        return;
      }
      next(error);
    }
  },
};

export default doctorController;
