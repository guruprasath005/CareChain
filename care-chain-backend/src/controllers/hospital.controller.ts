// src/controllers/hospital.controller.ts
// Hospital Controller - Full implementations using services

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { ApiResponse } from '../utils/response';
import { Assignment, AssignmentStatus, Conversation } from '../models';
import hospitalService from '../services/hospital.service';
import jobService from '../services/job.service';
import { applicationService } from '../services/application.service';
import { assignmentService } from '../services/assignment.service';
import { attendanceService } from '../services/attendance.service';
import { leaveService } from '../services/leave.service';
import { doctorService } from '../services/doctor.service';
import { recommendationService } from '../services/recommendation.service';
import { uploadService } from '../services/upload.service';
import { jobQueueService } from '../services/jobQueue.service';
import { cacheService, CACHE_KEYS, CACHE_TTL } from '../services/cache.service';
import { paymentService } from '../services/payment.service';
import { config } from '../config';
import { JobStatus, ApplicationStatus, AttendanceStatus, LeaveStatus } from '../models/types';
import { Doctor } from '../models/Doctor.model';
import { User } from '../models/User.model';

/**
 * Hospital Controller
 */
export const hospitalController = {
  // =====================================
  // PROFILE MANAGEMENT
  // =====================================

  /**
   * GET /hospital/profile
   * Get hospital's profile
   */
  async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const hospital = await hospitalService.getProfileByUserId(userId);

      if (!hospital) {
        ApiResponse.notFound(res, 'Hospital profile not found');
        return;
      }

      // Calculate profile completion details for frontend
      const completionPercentage = hospital.calculateProfileCompletion();
      const profileCompletionDetails = {
        percentage: completionPercentage,
        sections: hospital.profileSections || {
          generalInfo: false,
          representativeDetails: false,
          staffingDetails: false,
          infrastructureDetails: false,
          trustVerification: false,
        },
        isComplete: completionPercentage >= 70,
      };

      // Transform Hospital model to frontend-friendly DTO
      const hospitalData = hospital.toJSON() as any;
      const profileData = {
        id: hospitalData.id,
        email: hospital.user?.email || '',
        name: hospitalData.hospitalName || hospital.user?.fullName || '',
        avatar: hospital.user?.avatarUrl || hospitalData.images?.logo,
        logo: hospitalData.images?.logo,
        registrationNumber: hospitalData.registrationNumber,
        type: hospitalData.hospitalType,
        typeOther: hospitalData.hospitalTypeOther,
        website: hospitalData.website,
        description: hospitalData.description,
        phone: hospital.user ? {
          countryCode: '+91',
          number: (hospital.user as any).phoneNumber || '',
          isVerified: (hospital.user as any).isPhoneVerified || false,
        } : undefined,
        location: {
          street: hospitalData.address?.street,
          area: hospitalData.address?.area,
          city: hospitalData.address?.city,
          state: hospitalData.address?.state,
          pincode: hospitalData.address?.pincode,
          fullAddress: hospital.getFullAddress(),
          coordinates: hospitalData.latitude && hospitalData.longitude
            ? [hospitalData.latitude, hospitalData.longitude]
            : undefined,
        },
        address: hospitalData.address,
        representative: hospitalData.representative,
        staffing: hospitalData.staffing,
        infrastructure: hospitalData.infrastructure,
        facilities: hospitalData.facilities,
        specialties: hospitalData.specialties,
        specialtiesOther: hospitalData.specialtiesOther,
        credentials: hospitalData.credentials,
        facilityGallery: hospitalData.facilityGallery,
        verification: {
          status: hospitalData.verificationStatus,
          isVerified: hospitalData.verificationStatus === 'verified',
          email: hospital.user?.isEmailVerified || false,
        },
        isProfileComplete: completionPercentage >= 70,
        profileCompletion: completionPercentage,
        profileCompletionDetails,
        stats: hospitalData.hospitalStats,
      };

      ApiResponse.success(res, { profile: profileData }, 'Profile retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /hospital/profile/edit
   * Get hospital's profile for editing (structured DTO format)
   */
  async getEditProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const hospital = await hospitalService.getProfileByUserId(userId);

      if (!hospital) {
        ApiResponse.notFound(res, 'Hospital profile not found');
        return;
      }

      // Calculate profile completion details for frontend
      const completionPercentage = hospital.calculateProfileCompletion();
      const profileSections = hospital.profileSections || {
        generalInfo: false,
        representativeDetails: false,
        staffingDetails: false,
        infrastructureDetails: false,
        trustVerification: false,
      };

      const hospitalData = hospital.toJSON() as any;

      // Transform to HospitalEditProfile DTO format
      const editProfileData = {
        id: hospitalData.id,
        generalInfo: {
          hospitalName: hospitalData.hospitalName,
          hospitalType: hospitalData.hospitalType,
          hospitalTypeOther: hospitalData.hospitalTypeOther,
          email: hospital.user?.email,
          website: hospitalData.website,
          description: hospitalData.description,
          address: hospitalData.address,
        },
        representativeDetails: {
          fullName: hospitalData.representative?.fullName,
          email: hospitalData.representative?.email,
          phone: hospitalData.representative?.phone ? {
            countryCode: '+91',
            number: hospitalData.representative.phone,
          } : undefined,
          aadhaar: hospitalData.representative?.aadhaar,
        },
        staffingDetails: {
          totalDoctors: hospitalData.staffing?.totalDoctors,
          totalNurses: hospitalData.staffing?.totalNurses,
          totalStaff: hospitalData.staffing?.totalStaff,
        },
        infrastructureDetails: {
          specialties: hospitalData.specialties,
          specialtiesOther: hospitalData.specialtiesOther,
          opFacility: hospitalData.facilities?.opFacility,
          ipFacility: hospitalData.facilities?.ipFacility,
          ipBeds: hospitalData.facilities?.ipBeds,
          emergencyDepartment: hospitalData.facilities?.emergencyDepartment,
          emergencyBeds: hospitalData.infrastructure?.emergencyBeds,
          icuFacilities: hospitalData.facilities?.icuFacilities,
          icuBeds: hospitalData.infrastructure?.icuBeds,
          nicuPicuFacilities: hospitalData.facilities?.nicuPicu || hospitalData.facilities?.nicuPicuFacilities,
          nicuPicuBeds: hospitalData.infrastructure?.nicuPicuBeds,
          operationTheatre: hospitalData.facilities?.operationTheatre,
          operationTheaters: hospitalData.infrastructure?.operationTheaters,
          diagnosticLab: hospitalData.facilities?.diagnosticLab,
          labFacilities: hospitalData.facilities?.labFacilities,
          labFacilitiesOther: hospitalData.facilities?.labFacilitiesOther,
          radiologyDepartment: hospitalData.facilities?.radiologyDepartment,
          imagingFacilities: hospitalData.facilities?.imagingFacilities,
          imagingFacilitiesOther: hospitalData.facilities?.imagingFacilitiesOther,
          pharmacy: hospitalData.facilities?.pharmacy,
          pharmacyAvailable24x7: hospitalData.facilities?.pharmacyAvailable24x7,
          securityAvailable: hospitalData.facilities?.securityAvailable,
          photos: hospitalData.infrastructure?.photos,
          facilityGallery: hospitalData.facilityGallery,
        },
        trustVerification: {
          registrationNumber: hospitalData.registrationNumber || hospitalData.credentials?.registrationNumber,
          accreditations: hospitalData.credentials?.accreditations,
          chiefDoctorRegNumber: hospitalData.credentials?.chiefDoctorRegNumber,
          nabh: hospitalData.nabhAccreditation,
          hospitalLicense: hospitalData.hospitalLicense,
          establishmentLicense: hospitalData.credentials?.establishmentLicense,
          fireSafetyNOC: hospitalData.credentials?.fireSafetyNOC,
        },
        images: hospitalData.images,
        profileSections,
        profileCompletionPercentage: completionPercentage,
      };

      ApiResponse.success(res, { profile: editProfileData }, 'Edit profile retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /hospital/dashboard
   * Get hospital dashboard stats
   */
  async getDashboard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const dashboard = await hospitalService.getDashboard(userId);
      ApiResponse.success(res, dashboard, 'Dashboard retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /hospital/profile/basic
   * Update basic info (legacy)
   */
  async updateBasicInfo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const hospital = await hospitalService.updateGeneralInfo(userId, req.body);
      ApiResponse.success(res, { profile: hospital }, 'Basic info updated');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /hospital/profile/general-info
   * Update general information
   */
  async updateGeneralInfo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const hospital = await hospitalService.updateGeneralInfo(userId, req.body);
      ApiResponse.success(res, { profile: hospital }, 'General info updated');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /hospital/profile/location
   * Update location/address
   */
  async updateLocation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const hospital = await hospitalService.updateLocation(userId, req.body);
      ApiResponse.success(res, { profile: hospital }, 'Location updated');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /hospital/profile/infrastructure
   * Update infrastructure info
   */
  async updateInfrastructure(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const hospital = await hospitalService.updateInfrastructure(userId, req.body);
      ApiResponse.success(res, { profile: hospital }, 'Infrastructure updated');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /hospital/profile/infrastructure-details
   * Update detailed infrastructure info
   */
  async updateInfrastructureDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const hospital = await hospitalService.updateInfrastructure(userId, req.body);
      ApiResponse.success(res, { profile: hospital }, 'Infrastructure details updated');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /hospital/profile/infrastructure/photo
   * Upload infrastructure photo
   */
  async uploadInfrastructurePhoto(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
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

      // Use uploadPhoto method which includes userId in path
      const result = await uploadService.uploadPhoto(fileInfo, userId);
      if (!result.success || !result.fileUrl) {
        ApiResponse.badRequest(res, result.error || 'Upload failed');
        return;
      }
      const photoUrl = result.secureUrl || result.fileUrl;

      const hospital = await hospitalService.getProfileByUserId(userId);
      if (hospital) {
        // Store photos in gallery array with metadata
        const currentImages = hospital.images as any || {};
        const photos = currentImages.gallery || [];
        photos.push({
          url: photoUrl,
          publicId: result.publicId,
          uploadedAt: new Date().toISOString(),
        });
        hospital.images = { ...currentImages, gallery: photos } as any;
        await hospital.save();
      }

      ApiResponse.success(res, { photoUrl, publicId: result.publicId }, 'Photo uploaded');
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /hospital/profile/infrastructure/photo/:id
   * Delete infrastructure photo
   */
  async deleteInfrastructurePhoto(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id: photoId } = req.params;

      const hospital = await hospitalService.getProfileByUserId(userId);
      if (hospital) {
        const currentImages = hospital.images as any || {};
        const photos = currentImages.gallery || [];
        hospital.images = {
          ...currentImages, gallery: photos.filter(
            (url: string, idx: number) => String(idx) !== photoId && url !== photoId
          )
        } as any;
        await hospital.save();
      }

      ApiResponse.success(res, null, 'Photo deleted');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /hospital/profile/facilities
   * Update facilities
   */
  async updateFacilities(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const hospital = await hospitalService.updateFacilities(userId, req.body);
      ApiResponse.success(res, { profile: hospital }, 'Facilities updated');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /hospital/profile/staffing
   * Update staffing details
   */
  async updateStaffing(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const hospital = await hospitalService.updateStaffing(userId, req.body);
      ApiResponse.success(res, { profile: hospital }, 'Staffing updated');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /hospital/profile/representative
   * Update representative details
   */
  async updateRepresentative(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const hospital = await hospitalService.updateRepresentative(userId, req.body);
      ApiResponse.success(res, { profile: hospital }, 'Representative updated');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /hospital/profile/credentials
   * Update credentials
   */
  async updateCredentials(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const hospital = await hospitalService.updateCredentials(userId, req.body);
      ApiResponse.success(res, { profile: hospital }, 'Credentials updated');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /hospital/profile/representative/aadhaar
   * Update representative Aadhaar
   */
  async updateRepresentativeAadhaar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { aadhaarNumber } = req.body;

      const hospital = await hospitalService.getProfileByUserId(userId);
      if (hospital && hospital.representative) {
        hospital.representative = {
          ...hospital.representative,
          aadhaar: {
            ...hospital.representative.aadhaar,
            isVerified: hospital.representative.aadhaar?.isVerified || false,
            maskedNumber: `XXXX-XXXX-${aadhaarNumber.slice(-4)}`,
          },
        };
        await hospital.save();
      }

      ApiResponse.success(res, { profile: hospital }, 'Aadhaar updated');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /hospital/profile/representative/aadhaar/document
   * Upload representative Aadhaar document
   */
  async uploadRepresentativeAadhaarDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
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

      const hospital = await hospitalService.getProfileByUserId(userId);
      if (hospital && hospital.representative) {
        hospital.representative = {
          ...hospital.representative,
          aadhaar: {
            ...hospital.representative.aadhaar,
            isVerified: hospital.representative.aadhaar?.isVerified || false,
            documentUrl: { front: documentUrl },
          },
        };
        await hospital.save();
      }

      ApiResponse.success(res, { documentUrl, publicId: result.publicId }, 'Document uploaded');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /hospital/profile/credentials
   * Update credentials
   */


  /**
   * POST /hospital/profile/credentials/:docType/document
   * Upload credential document
   */
  async uploadCredentialDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { docType } = req.params;
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

      const result = await uploadService.uploadHospitalCredential(fileInfo, userId, docType);
      if (!result.success || !result.fileUrl) {
        ApiResponse.badRequest(res, result.error || 'Upload failed');
        return;
      }
      const documentUrl = result.secureUrl || result.fileUrl;
      const fileName = file.originalname || 'document';

      const hospital = await hospitalService.getProfileByUserId(userId);
      if (hospital) {
        if (docType === 'license' || docType === 'hospitalLicense') {
          await hospitalService.updateLicense(userId, { documentUrl });
        } else if (docType === 'nabh') {
          await hospitalService.updateNABH(userId, { documentUrl });
        } else if (docType === 'establishmentLicense' || docType === 'fireSafetyNOC') {
          // Update credentials JSONB with document info
          const currentCredentials = hospital.credentials as any || {};
          currentCredentials[docType] = {
            url: documentUrl,
            publicId: result.publicId,
            fileName,
            uploadedAt: new Date().toISOString(),
            isVerified: false,
          };
          hospital.credentials = currentCredentials;
          await hospital.save();
        }
      }

      ApiResponse.success(res, { documentUrl, publicId: result.publicId }, 'Document uploaded');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /hospital/profile/logo
   * Upload hospital logo
   */
  async uploadLogo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const file = req.file;

      if (!file) {
        ApiResponse.badRequest(res, 'No file uploaded');
        return;
      }

      console.log('[HospitalController] Upload Logo Request:', {
        userId,
        fileOriginalName: file.originalname,
        fileMimeType: file.mimetype,
        fileSize: file.size
      });

      const fileInfo = {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        buffer: file.buffer
      };

      const result = await uploadService.uploadLogo(fileInfo, userId);
      console.log('[HospitalController] Upload Service Result:', result);

      if (!result.success || !result.fileUrl) {
        console.error('[HospitalController] Upload Failed:', result.error);
        ApiResponse.badRequest(res, result.error || 'Upload failed');
        return;
      }
      const logoUrl = result.secureUrl || result.fileUrl;

      const hospital = await hospitalService.getProfileByUserId(userId);
      if (hospital) {
        hospital.images = { ...hospital.images, logo: logoUrl, logoPublicId: result.publicId } as any;
        if (hospital.user) {
          hospital.user.avatarUrl = logoUrl;
          hospital.user.avatarPublicId = result.publicId || null;
          await hospital.user.save();
        }
        await hospital.save();
      }

      ApiResponse.success(res, { logoUrl, publicId: result.publicId }, 'Logo uploaded');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /hospital/profile/banner
   * Upload hospital banner
   */
  async uploadBanner(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
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

      const result = await uploadService.uploadHospitalBanner(fileInfo, userId);
      if (!result.success || !result.fileUrl) {
        ApiResponse.badRequest(res, result.error || 'Upload failed');
        return;
      }
      const bannerUrl = result.secureUrl || result.fileUrl;

      const hospital = await hospitalService.getProfileByUserId(userId);
      if (hospital) {
        hospital.images = { ...hospital.images, banner: bannerUrl, bannerPublicId: result.publicId } as any;
        await hospital.save();
      }

      ApiResponse.success(res, { bannerUrl, publicId: result.publicId }, 'Banner uploaded');
    } catch (error) {
      next(error);
    }
  },

  // =====================================
  // REPRESENTATIVE EMAIL VERIFICATION
  // =====================================

  /**
   * POST /hospital/profile/representative/email/send-otp
   * Send OTP to representative email for verification
   */
  async sendRepresentativeEmailOtp(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { email } = req.body;

      if (!email) {
        ApiResponse.badRequest(res, 'Email is required');
        return;
      }

      // Simple email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        ApiResponse.badRequest(res, 'Please enter a valid email address');
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
      user.otpType = 'rep_email_ver' as any;
      await user.save();

      // In production, send OTP via Email service
      console.log(`[DEV] Representative Email OTP for ${email}: ${otp}`);

      ApiResponse.success(res, {
        message: 'OTP sent successfully',
        email,
        ...(process.env.NODE_ENV !== 'production' && { devOtp: otp })
      }, 'OTP sent to email');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /hospital/profile/representative/email/verify-otp
   * Verify OTP and update representative email
   */
  async verifyRepresentativeEmailOtp(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { email, otp } = req.body;

      if (!email || !otp) {
        ApiResponse.badRequest(res, 'Email and OTP are required');
        return;
      }

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

      if (user.otpType !== ('rep_email_ver' as any)) {
        ApiResponse.badRequest(res, 'Invalid OTP type.');
        return;
      }

      if (user.otpCode !== otp) {
        ApiResponse.badRequest(res, 'Invalid OTP. Please try again.');
        return;
      }

      // OTP is valid
      // Update Hospital Representative Email directly
      const hospital = await hospitalService.getProfileByUserId(userId);
      if (hospital) {
        hospital.representative = {
          ...hospital.representative,
          email: email,
          // We can add a verified flag to the representative object
          // Note: TypeScript might complain if 'emailVerified' isn't in Representative type
          // But since it's JSONB and we cast or use spread, it should be okay in JS runtime
          // Ideally update types, but for now strict: false or casting works.
          // Let's assume extending the object is safe.
          emailVerified: true,
        } as any;
        await hospital.save();
      }

      // Clear OTP
      user.otpCode = null;
      user.otpExpiresAt = null;
      user.otpType = null;
      await user.save();

      ApiResponse.success(res, {
        message: 'Email verified successfully',
        email,
        isVerified: true
      }, 'Email verified and saved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /hospital/profile/phone/send-otp
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
   * POST /hospital/profile/phone/verify-otp
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
  // DEPARTMENTS
  // =====================================

  /**
   * POST /hospital/departments
   * Add department
   */
  async addDepartment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const hospital = await hospitalService.addDepartment(userId, req.body);
      ApiResponse.created(res, { profile: hospital }, 'Department added');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /hospital/departments/:id
   * Update department
   */
  async updateDepartment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const hospital = await hospitalService.updateDepartment(userId, id, req.body);
      ApiResponse.success(res, { profile: hospital }, 'Department updated');
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /hospital/departments/:id
   * Delete department
   */
  async deleteDepartment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const hospital = await hospitalService.deleteDepartment(userId, id);
      ApiResponse.success(res, { profile: hospital }, 'Department deleted');
    } catch (error) {
      next(error);
    }
  },

  // =====================================
  // CONTACTS
  // =====================================

  /**
   * POST /hospital/contacts
   * Add contact person
   */
  async addContact(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const hospital = await hospitalService.addContact(userId, req.body);
      ApiResponse.created(res, { profile: hospital }, 'Contact added');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /hospital/contacts/:id
   * Update contact
   */
  async updateContact(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const hospital = await hospitalService.updateContact(userId, id, req.body);
      ApiResponse.success(res, { profile: hospital }, 'Contact updated');
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /hospital/contacts/:id
   * Delete contact
   */
  async deleteContact(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const hospital = await hospitalService.deleteContact(userId, id);
      ApiResponse.success(res, { profile: hospital }, 'Contact deleted');
    } catch (error) {
      next(error);
    }
  },

  // =====================================
  // JOBS
  // =====================================

  /**
   * POST /hospital/jobs
   * Create new job posting
   */
  async createJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      // Credit gate: consume one job-post credit when the feature is enabled
      if (config.payment.requireJobPostCredits) {
        const hasCredit = await paymentService.consumeJobCredit(userId);
        if (!hasCredit) {
          ApiResponse.badRequest(res, 'You have no job-posting credits remaining. Purchase a credit pack to continue.');
          return;
        }
      }

      const job = await jobService.createJob(userId, req.body);

      // Optionally publish immediately if requested
      if (req.body.publish) {
        await jobService.publishJob(job.id, userId);
      }

      ApiResponse.created(res, { job }, 'Job created');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /hospital/jobs
   * Get hospital's posted jobs
   */
  async getJobs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { status, page = '1', limit = '20', q, filterStatus, datePosted, minApplicants, maxApplicants } = req.query;

      // Filter out invalid status values (like string 'undefined' from bad API calls)
      const validStatus = status && status !== 'undefined' && status !== ''
        ? status as JobStatus
        : undefined;

      // Filter out invalid search query
      const searchQuery = q && q !== 'undefined' && q !== ''
        ? String(q)
        : undefined;

      // Parse filter parameters (Requirement 14.2)
      const validFilterStatus = filterStatus && filterStatus !== 'undefined' && filterStatus !== ''
        ? String(filterStatus)
        : undefined;

      const validDatePosted = datePosted && datePosted !== 'undefined' && datePosted !== ''
        ? String(datePosted)
        : undefined;

      const validMinApplicants = minApplicants && minApplicants !== 'undefined' && minApplicants !== ''
        ? Number(minApplicants)
        : undefined;

      const validMaxApplicants = maxApplicants && maxApplicants !== 'undefined' && maxApplicants !== ''
        ? Number(maxApplicants)
        : undefined;

      const result = await jobService.getHospitalJobs(
        userId,
        validStatus,
        Number(page),
        Number(limit),
        searchQuery,
        {
          status: validFilterStatus,
          datePosted: validDatePosted,
          minApplicants: validMinApplicants,
          maxApplicants: validMaxApplicants,
        }
      );

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
   * GET /hospital/jobs/:id
   * Get job details with applications
   */
  async getJobDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const job = await jobService.getJobWithStats(id);

      if (!job || job.hospitalId !== userId) {
        ApiResponse.notFound(res, 'Job not found');
        return;
      }

      // Get application stats by status
      const applicationStats: Record<string, number> = {};
      job.applications?.forEach(app => {
        applicationStats[app.status] = (applicationStats[app.status] || 0) + 1;
      });

      ApiResponse.success(res, {
        job: {
          ...job.toJSON(),
          applicationStats,
        },
      }, 'Job details retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /hospital/jobs/:id
   * Update job
   */
  async updateJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const job = await jobService.updateJob(id, userId, req.body);
      ApiResponse.success(res, { job }, 'Job updated');
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('Cannot edit')) {
        ApiResponse.badRequest(res, error.message);
        return;
      }
      next(error);
    }
  },

  /**
   * POST /hospital/jobs/:id/close
   * Close job posting
   */
  async closeJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { reason } = req.body;

      const job = await jobService.closeJob(id, userId, reason);
      ApiResponse.success(res, { job }, 'Job closed');
    } catch (error: any) {
      if (error.message.includes('not found')) {
        ApiResponse.notFound(res, error.message);
        return;
      }
      next(error);
    }
  },

  /**
   * DELETE /hospital/jobs/:id
   * Delete job (Soft delete to Trash)
   */
  async deleteJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      await jobService.deleteJob(id, userId);
      ApiResponse.success(res, null, 'Job moved to trash');
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('Cannot delete')) {
        ApiResponse.badRequest(res, error.message);
        return;
      }
      next(error);
    }
  },

  /**
   * POST /hospital/jobs/:id/restore
   * Restore job from trash
   */
  async restoreJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const job = await jobService.restoreJob(id, userId);
      ApiResponse.success(res, { job }, 'Job restored from trash');
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('not in trash')) {
        ApiResponse.badRequest(res, error.message);
        return;
      }
      next(error);
    }
  },

  /**
   * DELETE /hospital/jobs/:id/permanent
   * Permanently delete job
   */
  async deleteJobPermanently(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      await jobService.deleteJobPermanently(id, userId);
      ApiResponse.success(res, null, 'Job permanently deleted');
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('Only trashed')) {
        ApiResponse.badRequest(res, error.message);
        return;
      }
      next(error);
    }
  },

  /**
   * GET /hospital/jobs/:id/applications
   * Get applications for a specific job
   */
  async getJobApplications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: jobId } = req.params;
      const userId = req.user!.id;
      const { status, page = '1', limit = '20' } = req.query;

      // Verify job belongs to hospital
      const job = await jobService.getJobById(jobId);
      if (!job || job.hospitalId !== userId) {
        ApiResponse.notFound(res, 'Job not found');
        return;
      }

      const result = await applicationService.getApplications({
        jobId,
        status: status as ApplicationStatus,
        page: Number(page),
        limit: Number(limit),
      });

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
  // APPLICATIONS
  // =====================================

  /**
   * GET /hospital/applications
   * Get all applications for hospital
   */
  async getAllApplications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { status, page = '1', limit = '20' } = req.query;

      const result = await applicationService.getApplications({
        hospitalId: userId,
        status: status as ApplicationStatus,
        page: Number(page),
        limit: Number(limit),
      });

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

  /**
   * GET /hospital/applications/:id
   * Get application details
   */
  async getApplicationDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const application = await applicationService.getApplicationById(id);
      if (!application) {
        ApiResponse.notFound(res, 'Application not found');
        return;
      }

      // Mark as viewed
      await applicationService.markAsViewed(id, req.user!.id);

      ApiResponse.success(res, { application }, 'Application retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /hospital/applications/:id/status
   * Update application status
   */
  async updateApplicationStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { status, notes } = req.body;

      const application = await applicationService.updateStatus(id, userId, status, notes);
      ApiResponse.success(res, { application }, 'Status updated');
    } catch (error: any) {
      if (error.message.includes('Invalid') || error.message.includes('not found')) {
        ApiResponse.badRequest(res, error.message);
        return;
      }
      next(error);
    }
  },

  /**
   * POST /hospital/applications/:id/interview
   * Schedule interview
   */
  async scheduleInterview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const interviewData = req.body;

      const application = await applicationService.scheduleInterview(id, userId, interviewData);
      ApiResponse.success(res, { application }, 'Interview scheduled');
    } catch (error: any) {
      if (error.message.includes('Invalid') || error.message.includes('not found')) {
        ApiResponse.badRequest(res, error.message);
        return;
      }
      next(error);
    }
  },

  /**
   * POST /hospital/applications/:id/offer
   * Send job offer
   */
  async sendOffer(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const offerData = req.body;

      const application = await applicationService.makeOffer(id, userId, offerData);
      ApiResponse.success(res, { application }, 'Offer sent');
    } catch (error: any) {
      if (error.message.includes('Invalid') || error.message.includes('not found')) {
        ApiResponse.badRequest(res, error.message);
        return;
      }
      next(error);
    }
  },

  /**
   * POST /hospital/applications/:id/hire
   * Hire applicant
   */
  async hireApplicant(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const { startDate, notes } = req.body;
      const { application, assignment } = await applicationService.hireApplicant(id, userId, { startDate, notes });
      ApiResponse.success(res, { application, assignment }, 'Applicant hired');
    } catch (error: any) {
      if (error.message.includes('Invalid') || error.message.includes('not found')) {
        ApiResponse.badRequest(res, error.message);
        return;
      }
      next(error);
    }
  },

  // =====================================
  // CANDIDATES
  // =====================================

  /**
   * GET /hospital/candidates
   * Search candidates (doctors)
   */
  async searchCandidates(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        q,
        specialization,
        city,
        state,
        experience,
        skills,
        availability,
        sortBy,
        sortOrder,
        page = '1',
        limit = '20',
      } = req.query;

      const result = await doctorService.searchDoctors({
        q: q as string,
        specialization: specialization as string,
        city: city as string,
        state: state as string,
        minExperience: experience ? Number(experience) : undefined,
        skills: skills ? (skills as string).split(',') : undefined,
        isAvailable: availability === 'true' ? true : availability === 'false' ? false : undefined,
        sortBy: sortBy as string,
        sortOrder: sortOrder as string,
        page: Number(page),
        limit: Number(limit),
      });

      // Enrich with invitation status
      const doctors = result.data;
      
      // Handle empty results
      if (!doctors || doctors.length === 0) {
        ApiResponse.paginated(
          res,
          [],
          result.meta.page,
          result.meta.limit,
          result.meta.totalItems,
          'Candidates retrieved'
        );
        return;
      }
      
      const doctorIds = doctors.map((d: any) => d.userId).filter(Boolean);

      // Only query conversations if we have doctor IDs
      let conversations: any[] = [];
      if (doctorIds.length > 0) {
        conversations = await Conversation.findAll({
          where: {
            hospitalId: req.user!.id,
            doctorId: doctorIds
          }
        });
      }

      const enrichedDoctors = doctors.map((doc: any) => {
        const conversation = conversations.find(c => c.doctorId === doc.userId);
        return {
          ...doc,
          invitationStatus: conversation?.invitationStatus,
          conversationId: conversation?.id
        };
      });

      ApiResponse.paginated(
        res,
        enrichedDoctors,
        result.meta.page,
        result.meta.limit,
        result.meta.totalItems,
        'Candidates retrieved'
      );
    } catch (error) {
      console.error('[Hospital Controller] Search candidates error:', error);
      next(error);
    }
  },

  /**
   * GET /hospital/candidates/:id
   * Get candidate details
   */
  async getCandidateDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params; // Can be Doctor ID (PK) or User ID

      const includeUser = {
        association: 'user',
        attributes: ['id', 'email', 'fullName', 'avatarUrl', 'isEmailVerified', 'isProfileComplete']
      };

      // 1. Try to find by Doctor Primary Key (id)
      let doctor = await Doctor.findByPk(id, {
        include: [includeUser]
      });

      // 2. Fallback: Try to find by User ID
      if (!doctor) {
        doctor = await Doctor.findOne({
          where: { userId: id },
          include: [includeUser]
        });
      }

      if (!doctor) {
        ApiResponse.notFound(res, 'Candidate not found');
        return;
      }

      // Note: We deliberately allow viewing details even if !isSearchable
      // This is because hospitals need to view profiles of applicants who might
      // not be publicly searchable but have applied to their jobs.

      // Fetch recent completed assignments (activity)
      const recentActivity = await Assignment.findAll({
        where: {
          doctorId: doctor.userId,
          status: AssignmentStatus.COMPLETED
        },
        order: [['endDate', 'DESC']],
        limit: 5,
        include: [
          {
            association: 'assignmentHospital',
            attributes: ['id', 'fullName']
          }
        ]
      });

      const doctorJson = doctor.toJSON();

      // Enrich platformStats with recentActivity
      if (!doctorJson.platformStats) {
        doctorJson.platformStats = {} as any;
      }

      (doctorJson.platformStats as any).recentActivity = recentActivity.map(a => ({
        _id: a.id,
        title: a.title,
        jobTitle: a.title,
        hospital: (a.assignmentHospital as any)?.fullName || 'Hospital',
        description: a.department,
        date: a.endDate || a.updatedAt
      }));

      // Check if already invited (Conversation exists)
      const existingConversation = await Conversation.findOne({
        where: {
          hospitalId: req.user!.id,
          doctorId: doctor.userId
        }
      });

      if (existingConversation) {
        (doctorJson as any).invitationStatus = existingConversation.invitationStatus;
        (doctorJson as any).conversationId = existingConversation.id;
      }

      ApiResponse.success(res, { candidate: doctorJson }, 'Candidate details retrieved');
    } catch (error) {
      next(error);
    }
  },

  // =====================================
  // EMPLOYEES (ASSIGNMENTS)
  // =====================================

  /**
   * GET /hospital/employees
   * Get hospital employees (active assignments)
   */
  async getEmployees(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { status } = req.query;

      const employees = await assignmentService.getHospitalEmployees(
        userId,
        status as AssignmentStatus
      );

      ApiResponse.success(res, { employees }, 'Employees retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /hospital/employees/:id
   * Update employee assignment
   */
  async updateEmployee(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      if (req.body.schedule) {
        await assignmentService.updateSchedule(id, userId, req.body.schedule);
      }

      const assignment = await assignmentService.getAssignmentById(id);
      ApiResponse.success(res, { employee: assignment }, 'Employee updated');
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /hospital/employees/:id/status
   * Update employee status
   */
  async updateEmployeeStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { status, reason } = req.body;

      const assignment = await assignmentService.updateStatus(id, userId, status, reason);
      ApiResponse.success(res, { employee: assignment }, 'Status updated');
    } catch (error: any) {
      if (error.message.includes('Invalid') || error.message.includes('not found')) {
        ApiResponse.badRequest(res, error.message);
        return;
      }
      next(error);
    }
  },

  /**
   * POST /hospital/employees/:id/terminate
   * Terminate employee
   */
  async terminateEmployee(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { reason } = req.body;

      const assignment = await assignmentService.terminateAssignment(id, userId, reason);
      ApiResponse.success(res, { employee: assignment }, 'Employee terminated');
    } catch (error: any) {
      if (error.message.includes('not found')) {
        ApiResponse.notFound(res, error.message);
        return;
      }
      next(error);
    }
  },

  /**
   * GET /hospital/employees/:id/attendance
   * Get employee attendance history
   */
  async getEmployeeAttendance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { page = '1', limit = '30' } = req.query;

      const result = await attendanceService.getAttendance({
        assignmentId: id,
        page: Number(page),
        limit: Number(limit),
      });

      ApiResponse.paginated(
        res,
        result.data,
        result.meta.page,
        result.meta.limit,
        result.meta.totalItems,
        'Attendance retrieved'
      );
    } catch (error) {
      next(error);
    }
  },

  async getEmployeeTodayStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const attendance = await attendanceService.getTodayAttendance(id);

      let status = 'not_marked';
      if (attendance) {
        // Fix: Check status first before checking times, or rely on attendance.status directly
        // The service sets status to CHECKIN_PENDING etc.
        status = attendance.status;
      }

      ApiResponse.success(res, { status, attendance }, 'Status retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /hospital/employees/attendance/today/bulk
   * Get today's status for multiple employees
   */
  async getEmployeesTodayStatusBulk(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { assignmentIds } = req.body;

      // Single query for all assignments instead of one query per employee
      const attendanceMap = await attendanceService.getBulkTodayAttendance(assignmentIds);

      const statuses = assignmentIds.map((id: string) => {
        const attendance = attendanceMap.get(id) ?? null;
        const status = attendance ? attendance.status : 'not_marked';
        return { assignmentId: id, status, attendance };
      });

      // Return array directly instead of wrapping in object
      ApiResponse.success(res, statuses, 'Statuses retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /hospital/employees/:id/attendance
   * Mark employee attendance
   */
  async markEmployeeAttendance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { status, notes, date } = req.body;

      const attendance = await attendanceService.markAttendance(
        id,
        userId,
        date ? new Date(date) : new Date(),
        status as string,
        notes
      );

      ApiResponse.success(res, { attendance }, 'Attendance marked');
    } catch (error: any) {
      if (error.message.includes('not found')) {
        ApiResponse.notFound(res, error.message);
        return;
      }
      next(error);
    }
  },

  /**
   * GET /hospital/employees/:id/schedule
   * Get employee schedule
   */
  async getEmployeeSchedule(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const { entries, meta } = await assignmentService.getScheduleEntries(id, userId);

      ApiResponse.success(res, { schedule: entries, scheduleMeta: meta }, 'Schedule retrieved');
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        ApiResponse.notFound(res, error.message);
        return;
      }
      next(error);
    }
  },

  /**
   * POST /hospital/employees/:id/schedule
   * Add or update schedule entry (by date)
   */
  async addEmployeeScheduleEntry(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { date, startTime, endTime, isWorkDay, notes } = req.body;

      if (!date || !startTime || !endTime || typeof isWorkDay !== 'boolean') {
        ApiResponse.badRequest(res, 'date, startTime, endTime, and isWorkDay are required');
        return;
      }

      const result = await assignmentService.upsertScheduleEntry(id, userId, {
        date,
        startTime,
        endTime,
        isWorkDay,
        notes,
      });

      ApiResponse.success(res, { entry: result.entry, schedule: result.entries }, 'Schedule entry saved');
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        ApiResponse.notFound(res, error.message);
        return;
      }
      next(error);
    }
  },

  /**
   * POST /hospital/employees/:id/schedule/bulk
   * Add or update multiple schedule entries (bulk)
   */
  async addEmployeeScheduleEntriesBulk(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { entries } = req.body;

      if (!entries || !Array.isArray(entries) || entries.length === 0) {
        ApiResponse.badRequest(res, 'entries array is required');
        return;
      }

      // Basic validation for entries
      for (const entry of entries) {
        if (!entry.date || !entry.startTime || !entry.endTime || typeof entry.isWorkDay !== 'boolean') {
          ApiResponse.badRequest(res, 'All entries must have date, startTime, endTime, and isWorkDay');
          return;
        }
      }

      const result = await assignmentService.upsertScheduleEntries(id, userId, entries);

      ApiResponse.success(res, { schedule: result.entries }, 'Schedule entries saved');
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        ApiResponse.notFound(res, error.message);
        return;
      }
      next(error);
    }
  },

  /**
   * PUT /hospital/employees/:id/schedule/:scheduleId
   * Update schedule entry by ID
   */
  async updateEmployeeScheduleEntry(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, scheduleId } = req.params;
      const userId = req.user!.id;
      const { startTime, endTime, isWorkDay, notes } = req.body;

      const result = await assignmentService.updateScheduleEntry(id, userId, scheduleId, {
        startTime,
        endTime,
        isWorkDay,
        notes,
      });

      ApiResponse.success(res, { entry: result.entry, schedule: result.entries }, 'Schedule entry updated');
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        ApiResponse.notFound(res, error.message);
        return;
      }
      next(error);
    }
  },

  /**
   * DELETE /hospital/employees/:id/schedule/:scheduleId
   * Delete schedule entry by ID
   */
  async deleteEmployeeScheduleEntry(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, scheduleId } = req.params;
      const userId = req.user!.id;

      const result = await assignmentService.deleteScheduleEntry(id, userId, scheduleId);

      ApiResponse.success(res, { schedule: result.entries }, 'Schedule entry deleted');
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        ApiResponse.notFound(res, error.message);
        return;
      }
      next(error);
    }
  },

  // =====================================
  // ATTENDANCE APPROVAL WORKFLOW
  // =====================================

  /**
   * GET /hospital/attendance/pending
   * Get pending attendance requests (check-in and check-out awaiting approval)
   */
  async getPendingAttendance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { page = '1', limit = '20' } = req.query;

      const result = await attendanceService.getPendingAttendanceRequests(
        userId,
        Number(page),
        Number(limit)
      );

      ApiResponse.paginated(
        res,
        result.data.map((a: any) => ({
          id: a.id,
          assignmentId: a.assignmentId,
          doctorId: a.doctorId,
          doctorName: a.doctor?.fullName || 'Doctor',
          doctorAvatar: a.doctor?.avatar,
          date: a.date,
          status: a.status,
          checkIn: a.checkIn,
          checkOut: a.checkOut,
          workDuration: a.workDuration,
          shift: a.assignment?.shift,
          createdAt: a.createdAt,
        })),
        result.meta.page,
        result.meta.limit,
        result.meta.totalItems,
        'Pending attendance requests retrieved'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /hospital/attendance/:id/confirm-checkin
   * Hospital confirms doctor's check-in
   */
  async confirmCheckIn(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const attendance = await attendanceService.confirmCheckIn(id, userId);

      ApiResponse.success(res, {
        attendance: {
          id: attendance.id,
          status: attendance.status,
          checkIn: attendance.checkIn,
          isApproved: attendance.isApproved,
          approvedAt: attendance.approvedAt,
        },
      }, 'Check-in confirmed successfully');
    } catch (error: any) {
      if (error.message.includes('not found')) {
        ApiResponse.notFound(res, error.message);
        return;
      }
      if (error.message.includes('not pending')) {
        ApiResponse.badRequest(res, error.message);
        return;
      }
      next(error);
    }
  },

  /**
   * POST /hospital/attendance/:id/confirm-checkout
   * Hospital confirms doctor's check-out
   */
  async confirmCheckOut(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const attendance = await attendanceService.confirmCheckOut(id, userId);

      ApiResponse.success(res, {
        attendance: {
          id: attendance.id,
          status: attendance.status,
          checkIn: attendance.checkIn,
          checkOut: attendance.checkOut,
          workDuration: attendance.workDuration,
          isApproved: attendance.isApproved,
          approvedAt: attendance.approvedAt,
        },
      }, 'Check-out confirmed successfully');
    } catch (error: any) {
      if (error.message.includes('not found')) {
        ApiResponse.notFound(res, error.message);
        return;
      }
      if (error.message.includes('not pending')) {
        ApiResponse.badRequest(res, error.message);
        return;
      }
      next(error);
    }
  },

  /**
   * POST /hospital/attendance/:id/cancel
   * Hospital cancels attendance request
   */
  async cancelAttendance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { reason } = req.body;

      const attendance = await attendanceService.cancelAttendance(id, userId, reason);

      ApiResponse.success(res, {
        attendance: {
          id: attendance.id,
          status: attendance.status,
          notes: attendance.notes,
        },
      }, 'Attendance cancelled');
    } catch (error: any) {
      if (error.message.includes('not found')) {
        ApiResponse.notFound(res, error.message);
        return;
      }
      next(error);
    }
  },

  /**
   * POST /hospital/attendance/:id/mark-absent
   * Hospital marks doctor as absent
   */
  async markAbsent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { reason } = req.body;

      const attendance = await attendanceService.markAsAbsent(id, userId, reason);

      ApiResponse.success(res, {
        attendance: {
          id: attendance.id,
          status: attendance.status,
          notes: attendance.notes,
        },
      }, 'Marked as absent');
    } catch (error: any) {
      if (error.message.includes('not found')) {
        ApiResponse.notFound(res, error.message);
        return;
      }
      next(error);
    }
  },

  /**
   * POST /hospital/employees/:assignmentId/mark-absent
   * Create absent record for employee (when no check-in exists)
   */
  async createAbsentRecord(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { assignmentId } = req.params;
      const userId = req.user!.id;
      const { date, reason } = req.body;

      const dateStr = date || new Date().toISOString().split('T')[0];
      const attendance = await attendanceService.createAbsentRecord(
        assignmentId,
        userId,
        dateStr,
        reason
      );

      ApiResponse.success(res, {
        attendance: {
          id: attendance.id,
          status: attendance.status,
          date: attendance.date,
          notes: attendance.notes,
        },
      }, 'Marked as absent');
    } catch (error: any) {
      if (error.message.includes('not found')) {
        ApiResponse.notFound(res, error.message);
        return;
      }
      next(error);
    }
  },

  // =====================================
  // LEAVE REQUESTS
  // =====================================

  /**
   * GET /hospital/leave-requests
   * Get leave requests for hospital
   */
  async getLeaveRequests(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { status, assignmentId, page = '1', limit = '20' } = req.query;

      const result = await leaveService.getLeaveRequests({
        hospitalId: userId,
        assignmentId: assignmentId as string,
        status: status as LeaveStatus,
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
   * PUT /hospital/leave-requests/:id
   * Approve/reject leave request
   */
  async handleLeaveRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { status, reason } = req.body;

      let leaveRequest;
      if (status === LeaveStatus.APPROVED || status === 'approved') {
        leaveRequest = await leaveService.approveLeaveRequest(id, userId, reason);
      } else if (status === LeaveStatus.REJECTED || status === 'rejected') {
        leaveRequest = await leaveService.rejectLeaveRequest(id, userId, reason);
      } else {
        ApiResponse.badRequest(res, 'Invalid status. Use "approved" or "rejected"');
        return;
      }

      ApiResponse.success(res, { leaveRequest }, 'Leave request updated');
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('Cannot')) {
        ApiResponse.badRequest(res, error.message);
        return;
      }
      next(error);
    }
  },

  // =====================================
  // BULK JOB POSTING (Scalable for 1000+ users)
  // =====================================

  /**
   * POST /hospital/jobs/bulk
   * Create multiple job postings (handles 1000+ jobs efficiently)
   */
  async createBulkJobs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { jobs } = req.body;

      if (!Array.isArray(jobs) || jobs.length === 0) {
        ApiResponse.badRequest(res, 'Jobs array is required and cannot be empty');
        return;
      }

      // Validate job count
      const maxJobs = 5000; // Maximum jobs per bulk request
      if (jobs.length > maxJobs) {
        ApiResponse.badRequest(res, `Maximum ${maxJobs} jobs allowed per bulk request`);
        return;
      }

      // Queue the bulk operation
      const result = await jobQueueService.queueBulkJobPosting({
        hospitalId: userId,
        jobs,
        userId,
      });

      // Invalidate hospital job caches
      await cacheService.invalidateHospitalCaches(userId);

      ApiResponse.accepted(res, {
        batchId: result.batchId,
        totalJobs: result.totalJobs,
        estimatedTime: result.estimatedTime,
        message: 'Bulk job posting queued for processing',
      }, 'Jobs queued for creation');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /hospital/jobs/bulk/:batchId
   * Get status of bulk job posting operation
   */
  async getBulkJobStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { batchId } = req.params;

      const status = await jobQueueService.getBulkStatus(batchId);

      ApiResponse.success(res, {
        batchId,
        ...status,
      }, 'Bulk operation status retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /hospital/jobs/queue
   * Queue a single job posting (for high-load scenarios)
   */
  async queueJobPosting(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const jobData = req.body;

      const queueJobId = await jobQueueService.queueJobPosting({
        hospitalId: userId,
        jobData,
        userId,
        priority: jobData.isUrgent ? 1 : 5,
      });

      ApiResponse.accepted(res, {
        queueJobId,
        status: 'queued',
        message: 'Job posting queued for processing',
      }, 'Job queued');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /hospital/jobs/queue/:jobId
   * Get status of a queued job posting
   */
  async getQueuedJobStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;

      const status = await jobQueueService.getJobStatus(jobId);

      ApiResponse.success(res, {
        jobId,
        ...status,
      }, 'Job status retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /hospital/jobs/queue-stats
   * Get job queue statistics
   */
  async getJobQueueStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await jobQueueService.getQueueStats();

      ApiResponse.success(res, stats, 'Queue statistics retrieved');
    } catch (error) {
      next(error);
    }
  },
};

export default hospitalController;
