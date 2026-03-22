// src/types/index.ts
// Application-level types for controllers, middleware, and request/response shapes.
//
// Most enums live in models/types and are re-exported here so routes and
// controllers only need one import path.
//
// Exception: UserRole is intentionally kept as a string union (not the models
// enum) so that routes can write authorize('doctor') without needing an enum
// import. The string values are identical to the enum values in models/types.

import { Request } from 'express';

// ─── Re-export canonical enums from the models layer ──────────────────────────

export {
  ApplicationStatus,
  AssignmentStatus,
  AttendanceStatus,
  AttendanceApprovalStatus,
  LeaveType,
  LeaveStatus,
  JobStatus,
  JobType,
  CompensationType,
  FeedbackType,
  VerificationStatus,
  HospitalType,
  Gender,
  OfferStatus,
} from '../models/types';

// ─── Auth types ────────────────────────────────────────────────────────────────

// String union matching models/types UserRole enum values.
// Kept as a union so authorize('doctor') works without enum imports in routes.
export type UserRole = 'doctor' | 'hospital' | 'admin' | 'pending';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  tokenId: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isEmailVerified: boolean;
  isProfileComplete: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
  tokenId?: string;
}

// ─── OTP types ─────────────────────────────────────────────────────────────────
// Extended beyond the model-layer OtpType enum with additional verification flows.

export type OtpType =
  | 'email_verification'
  | 'password_reset'
  | 'phone_verification'
  | 'aadhaar_verification';

export interface OtpData {
  otp: string;
  email: string;
  type: OtpType;
  expiresAt: Date;
  attempts: number;
}

// ─── API response types ────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: ValidationError[];
  meta?: PaginationMeta;
  statusCode: number;
  timestamp: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// ─── Controller-layer view models ──────────────────────────────────────────────
// Shapes controllers pass to API responses; separate from Sequelize model classes.

export interface DoctorProfile {
  id: string;
  userId: string;
  personalInfo: {
    firstName?: string;
    lastName?: string;
    gender?: 'male' | 'female' | 'other';
    dateOfBirth?: Date;
  };
  phone?: {
    countryCode: string;
    number: string;
    isVerified: boolean;
  };
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  bio?: string;
  avatar?: string;
  aadhaar?: {
    number?: string;
    isVerified: boolean;
  };
  education: EducationEntry[];
  experience: ExperienceEntry[];
  skills: SkillEntry[];
  licenses: LicenseEntry[];
  preferences?: DoctorPreferences;
  profileCompletion: number;
}

export interface EducationEntry {
  id: string;
  institution: string;
  degree: string;
  specialization?: string;
  startYear: number;
  endYear?: number;
  documentUrl?: string;
  isVerified: boolean;
}

export interface ExperienceEntry {
  id: string;
  role: string;
  department: string;
  institution: string;
  startDate: Date;
  endDate?: Date;
  isCurrent: boolean;
  documentUrl?: string;
}

export interface SkillEntry {
  id: string;
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  certificateUrl?: string;
}

export interface LicenseEntry {
  id: string;
  name: string;
  issuingBody?: string;
  licenseNumber?: string;
  issueDate?: Date;
  expiryDate?: Date;
  documentUrl?: string;
  isVerified: boolean;
}

export interface DoctorPreferences {
  shortTermJobs: boolean;
  longTermJobs: boolean;
  paymentPreference: 'per_hour' | 'per_day' | 'per_month';
  expectedDailyRate?: number;
  availability: {
    isAvailable: boolean;
    preferredDays?: string[];
    preferredShifts?: ('morning' | 'afternoon' | 'evening' | 'night')[];
  };
}

export interface HospitalProfile {
  id: string;
  userId: string;
  hospitalName?: string;
  hospitalType?: string;
  description?: string;
  establishedYear?: number;
  registrationNumber?: string;
  website?: string;
  logo?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    coordinates?: { lat: number; lng: number };
  };
  infrastructure?: {
    totalBeds?: number;
    icuBeds?: number;
    operationTheaters?: number;
    emergencyCapacity?: number;
  };
  facilities?: {
    emergency24x7?: boolean;
    ambulance?: boolean;
    pharmacy?: boolean;
    laboratory?: boolean;
    bloodBank?: boolean;
  };
  departments: DepartmentEntry[];
  contacts: HospitalContactEntry[];
  representative?: {
    name?: string;
    designation?: string;
    phone?: string;
    email?: string;
    aadhaar?: { number?: string; isVerified: boolean };
  };
  profileCompletion: number;
}

export interface DepartmentEntry {
  id: string;
  name: string;
  headDoctor?: string;
}

export interface HospitalContactEntry {
  id: string;
  name: string;
  phone: { countryCode: string; number: string };
  email?: string;
  designation?: string;
  isPrimary: boolean;
}
