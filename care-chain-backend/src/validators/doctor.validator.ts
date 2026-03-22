// src/validators/doctor.validator.ts
import { z } from 'zod';

// ─── Shared primitives ─────────────────────────────────────────────────────────

const uuidSchema = z.string().uuid('Invalid ID format');

const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const phoneSchema = z.object({
  countryCode: z.string().min(1).max(5).default('+91'),
  number: z.string().regex(/^\d{7,15}$/, 'Phone number must be 7–15 digits'),
});

// ─── Profile update schemas ────────────────────────────────────────────────────

export const updatePersonalInfoSchema = z.object({
  personalInfo: z
    .object({
      firstName: z.string().min(1).max(50).trim().optional(),
      lastName: z.string().min(1).max(50).trim().optional(),
      gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
      dateOfBirth: z
        .string()
        .refine((d) => !isNaN(Date.parse(d)), 'Invalid date')
        .transform((d) => new Date(d))
        .optional(),
    })
    .optional(),
  phone: phoneSchema.optional(),
  address: z
    .object({
      street: z.string().max(200).trim().optional(),
      city: z.string().min(1).max(100).trim().optional(),
      state: z.string().min(1).max(100).trim().optional(),
      pincode: z
        .string()
        .regex(/^\d{6}$/, 'Pincode must be exactly 6 digits')
        .optional(),
    })
    .optional(),
});

export const updateBioSchema = z.object({
  bio: z.string().max(2000, 'Bio must not exceed 2000 characters').trim(),
});

export const updatePreferencesSchema = z.object({
  shortTermJobs: z.boolean().optional(),
  longTermJobs: z.boolean().optional(),
  paymentPreference: z.enum(['per_hour', 'per_day', 'per_month']).optional(),
  expectedDailyRate: z.number().positive().optional(),
  expectedHourlyRate: z.number().positive().optional(),
  expectedMonthlyRate: z.number().positive().optional(),
  availability: z
    .object({
      isAvailable: z.boolean(),
      availableFrom: z.string().optional(),
      preferredDays: z.array(z.string()).optional(),
      preferredShifts: z
        .array(z.enum(['morning', 'afternoon', 'evening', 'night']))
        .optional(),
    })
    .optional(),
  preferredLocations: z.array(z.string()).optional(),
  willingToRelocate: z.boolean().optional(),
  willingToTravel: z.boolean().optional(),
});

// ─── Aadhaar ───────────────────────────────────────────────────────────────────

export const aadhaarOtpSchema = z.object({
  aadhaarNumber: z
    .string()
    .regex(/^\d{12}$/, 'Aadhaar number must be exactly 12 digits'),
});

export const verifyAadhaarSchema = z.object({
  aadhaarNumber: z
    .string()
    .regex(/^\d{12}$/, 'Aadhaar number must be exactly 12 digits'),
  otp: z
    .string()
    .length(6, 'OTP must be 6 digits')
    .regex(/^\d{6}$/, 'OTP must contain only digits'),
});

// ─── Phone verification ────────────────────────────────────────────────────────

export const sendPhoneOtpSchema = z.object({
  phoneNumber: z.string().regex(/^\d{7,15}$/, 'Invalid phone number'),
  countryCode: z.string().min(1).max(5).default('+91'),
});

export const verifyPhoneOtpSchema = z.object({
  phoneNumber: z.string().regex(/^\d{7,15}$/, 'Invalid phone number'),
  otp: z
    .string()
    .length(6, 'OTP must be 6 digits')
    .regex(/^\d{6}$/, 'OTP must contain only digits'),
  countryCode: z.string().min(1).max(5).default('+91'),
});

// ─── Education ─────────────────────────────────────────────────────────────────

export const addEducationSchema = z.object({
  institution: z.string().min(2).max(200).trim(),
  degree: z.string().min(2).max(100).trim(),
  specialization: z.string().max(100).trim().optional(),
  startYear: z.number().int().min(1950).max(new Date().getFullYear()),
  endYear: z
    .number()
    .int()
    .min(1950)
    .max(new Date().getFullYear() + 5)
    .optional(),
});

export const updateEducationSchema = addEducationSchema.partial();

// ─── Work experience ───────────────────────────────────────────────────────────

export const addExperienceSchema = z.object({
  role: z.string().min(2).max(100).trim(),
  department: z.string().min(1).max(100).trim(),
  institution: z.string().min(2).max(200).trim(),
  location: z.string().max(200).trim().optional(),
  startDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), 'Invalid start date'),
  endDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), 'Invalid end date')
    .optional(),
  isCurrent: z.boolean().default(false),
  description: z.string().max(1000).trim().optional(),
});

export const updateExperienceSchema = addExperienceSchema.partial();

// ─── Skills ────────────────────────────────────────────────────────────────────

export const addSkillSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
  certifyingAuthority: z.string().max(200).trim().optional(),
  validTill: z.string().optional(),
  experienceYears: z.number().int().min(0).max(60).optional(),
});

export const updateSkillSchema = addSkillSchema.partial();

// ─── Licenses ─────────────────────────────────────────────────────────────────

export const addLicenseSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  issuingBody: z.string().max(200).trim().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
});

export const updateLicenseSchema = addLicenseSchema.partial();

// ─── Leave requests ────────────────────────────────────────────────────────────

export const createLeaveRequestSchema = z.object({
  assignmentId: uuidSchema,
  leaveType: z.enum(['annual', 'sick', 'casual', 'emergency', 'unpaid', 'other']),
  startDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), 'Invalid start date'),
  endDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), 'Invalid end date'),
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(500).trim(),
  isHalfDay: z.boolean().default(false),
  halfDayPeriod: z.enum(['first_half', 'second_half']).optional(),
}).refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  { message: 'End date must be on or after start date', path: ['endDate'] }
);

// ─── Attendance ────────────────────────────────────────────────────────────────

export const checkInSchema = z.object({
  assignmentId: uuidSchema,
  location: z
    .object({
      coordinates: z.tuple([z.number(), z.number()]).optional(),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
    })
    .optional(),
  method: z.enum(['app', 'manual']).default('app'),
});

export const checkOutSchema = z.object({
  assignmentId: uuidSchema,
  location: z
    .object({
      coordinates: z.tuple([z.number(), z.number()]).optional(),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
    })
    .optional(),
  notes: z.string().max(500).trim().optional(),
});

// ─── Job application ───────────────────────────────────────────────────────────

export const applyToJobSchema = z.object({
  coverLetter: z.string().max(2000).trim().optional(),
  expectedCompensation: z
    .object({
      amount: z.number().positive('Expected compensation must be positive'),
      type: z.enum(['hourly', 'daily', 'monthly', 'per_patient']),
    })
    .optional(),
  availableFrom: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), 'Invalid date')
    .optional(),
  answers: z.array(z.string()).optional(),
});

// ─── Exported types ────────────────────────────────────────────────────────────

export type UpdatePersonalInfoInput = z.infer<typeof updatePersonalInfoSchema>;
export type UpdateBioInput = z.infer<typeof updateBioSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
export type AadhaarOtpInput = z.infer<typeof aadhaarOtpSchema>;
export type VerifyAadhaarInput = z.infer<typeof verifyAadhaarSchema>;
export type SendPhoneOtpInput = z.infer<typeof sendPhoneOtpSchema>;
export type VerifyPhoneOtpInput = z.infer<typeof verifyPhoneOtpSchema>;
export type AddEducationInput = z.infer<typeof addEducationSchema>;
export type AddExperienceInput = z.infer<typeof addExperienceSchema>;
export type AddSkillInput = z.infer<typeof addSkillSchema>;
export type AddLicenseInput = z.infer<typeof addLicenseSchema>;
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckOutInput = z.infer<typeof checkOutSchema>;
export type ApplyToJobInput = z.infer<typeof applyToJobSchema>;
