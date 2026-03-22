// src/services/index.ts
// Central export for all services

// Authentication Services
export { authService } from './auth.service';
export { tokenService } from './token.service';
export { otpService } from './otp.service';
export { emailService } from './email.service';

// Profile Services
export { doctorService } from './doctor.service';
export { hospitalService } from './hospital.service';

// Job Management Services
export { jobService } from './job.service';
export { applicationService } from './application.service';
export { assignmentService } from './assignment.service';

// Operational Services
export { attendanceService } from './attendance.service';
export { leaveService } from './leave.service';
export { uploadService } from './upload.service';
export { cloudinaryService } from './cloudinary.service';

// Recommendation System
export { recommendationService } from './recommendation.service';

// Re-export types for convenience
export type { TokenPair, TokenPayload, DecodedToken } from './token.service';
export type { OtpData, OtpVerificationResult } from './otp.service';
export type { EmailOptions, EmailResult } from './email.service';
export type { SignupData, LoginResult, SignupResult } from './auth.service';
export type { DoctorProfileUpdate, DoctorSearchFilters } from './doctor.service';
export type { HospitalBasicInfo, HospitalSearchFilters, DashboardStats } from './hospital.service';
export type { CreateJobData, UpdateJobData, JobSearchFilters } from './job.service';
export type { ApplyJobData, ApplicationSearchFilters } from './application.service';
export type { AssignmentFilters } from './assignment.service';
export type { CheckInData, AttendanceFilters } from './attendance.service';
export type { CreateLeaveData, LeaveFilters } from './leave.service';
export type { UploadResult, FileInfo } from './upload.service';
export type { CloudinaryUploadResult, CloudinaryUploadOptions, UploadPresetType } from './cloudinary.service';
export type { MatchWeights, RecommendedJob, RecommendedDoctor } from './recommendation.service';
