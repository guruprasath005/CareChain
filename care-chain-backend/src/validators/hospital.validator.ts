// src/validators/hospital.validator.ts
import { z } from 'zod';

// ─── Shared primitives ─────────────────────────────────────────────────────────

const uuidSchema = z.string().uuid('Invalid ID format');

const phoneSchema = z.object({
  countryCode: z.string().min(1).max(5).default('+91'),
  number: z.string().regex(/^\d{7,15}$/, 'Phone number must be 7–15 digits'),
});

const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// ─── Profile: general info ─────────────────────────────────────────────────────

export const updateGeneralInfoSchema = z.object({
  hospitalName: z.string().min(2).max(200).trim().optional(),
  hospitalType: z
    .enum([
      'government', 'private', 'trust', 'corporate', 'clinic',
      'nursing_home', 'multi_specialty', 'super_specialty',
      'primary_health_center', 'community_health_center',
      'diagnostic_lab', 'radiology_centre', 'pharmacy', 'others',
    ])
    .optional(),
  description: z.string().max(2000).trim().optional(),
  establishedYear: z
    .number()
    .int()
    .min(1800)
    .max(new Date().getFullYear())
    .optional(),
  registrationNumber: z.string().max(100).trim().optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  specializations: z.array(z.string()).optional(),
  emergencyServices: z.boolean().optional(),
});

// ─── Profile: location ────────────────────────────────────────────────────────

export const updateLocationSchema = z.object({
  address: z.object({
    street: z.string().max(300).trim().optional(),
    area: z.string().max(200).trim().optional(),
    city: z.string().min(1).max(100).trim(),
    state: z.string().min(1).max(100).trim(),
    pincode: z
      .string()
      .regex(/^\d{6}$/, 'Pincode must be exactly 6 digits')
      .optional(),
    country: z.string().max(100).default('India'),
    landmark: z.string().max(200).trim().optional(),
    coordinates: coordinatesSchema.optional(),
  }),
});

// ─── Profile: infrastructure ──────────────────────────────────────────────────

export const updateInfrastructureSchema = z.object({
  totalBeds: z.number().int().min(0).optional(),
  icuBeds: z.number().int().min(0).optional(),
  nicuPicuBeds: z.number().int().min(0).optional(),
  operationTheaters: z.number().int().min(0).optional(),
  emergencyBeds: z.number().int().min(0).optional(),
  emergencyCapacity: z.number().int().min(0).optional(),
});

// ─── Profile: facilities ──────────────────────────────────────────────────────

export const updateFacilitiesSchema = z.object({
  meals: z.boolean().optional(),
  transport: z.boolean().optional(),
  accommodation: z.boolean().optional(),
  insurance: z.boolean().optional(),
  emergency24x7: z.boolean().optional(),
  ambulance: z.boolean().optional(),
  pharmacy: z.boolean().optional(),
  laboratory: z.boolean().optional(),
  bloodBank: z.boolean().optional(),
});

// ─── Profile: representative ──────────────────────────────────────────────────

export const updateRepresentativeSchema = z.object({
  fullName: z.string().min(2).max(200).trim().optional(),
  email: z.string().email('Invalid email').toLowerCase().trim().optional(),
  phone: phoneSchema.optional(),
  designation: z.string().max(100).trim().optional(),
});

export const updateRepresentativeAadhaarSchema = z.object({
  aadhaarNumber: z
    .string()
    .regex(/^\d{12}$/, 'Aadhaar number must be exactly 12 digits'),
});

// ─── Phone / email OTP ────────────────────────────────────────────────────────

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

export const sendEmailOtpSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
});

export const verifyEmailOtpSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  otp: z
    .string()
    .length(6, 'OTP must be 6 digits')
    .regex(/^\d{6}$/, 'OTP must contain only digits'),
});

// ─── Departments ──────────────────────────────────────────────────────────────

export const addDepartmentSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  headDoctor: z.string().max(200).trim().optional(),
});

export const updateDepartmentSchema = addDepartmentSchema.partial();

// ─── Contacts ─────────────────────────────────────────────────────────────────

export const addContactSchema = z.object({
  name: z.string().min(2).max(200).trim(),
  phone: phoneSchema,
  email: z.string().email('Invalid email').optional(),
  designation: z.string().max(100).trim().optional(),
  isPrimary: z.boolean().default(false),
});

export const updateContactSchema = addContactSchema.partial();

// ─── Application management ───────────────────────────────────────────────────

export const updateApplicationStatusSchema = z.object({
  status: z.enum([
    'applied', 'under_review', 'shortlisted',
    'interview_scheduled', 'interviewed',
    'offer_made', 'offer_declined',
    'hired', 'rejected', 'withdrawn',
  ]),
  notes: z.string().max(1000).trim().optional(),
  internalNote: z.string().max(1000).trim().optional(),
});

export const scheduleInterviewSchema = z.object({
  scheduledAt: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), 'Invalid interview date'),
  type: z.enum(['in_person', 'video', 'phone']),
  location: z.string().max(300).trim().optional(),
  meetingLink: z.string().url('Invalid URL').optional(),
  interviewer: z.string().max(200).trim().optional(),
  notes: z.string().max(1000).trim().optional(),
});

export const sendOfferSchema = z.object({
  amount: z.number().positive().optional(),
  salary: z.number().positive().optional(),
  currency: z.string().length(3).default('INR'),
  salaryType: z.enum(['hourly', 'daily', 'monthly', 'annual']).optional(),
  startDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), 'Invalid start date')
    .optional(),
  joiningDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), 'Invalid joining date')
    .optional(),
  reportingDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), 'Invalid reporting date')
    .optional(),
  terms: z.string().max(2000).trim().optional(),
  notes: z.string().max(1000).trim().optional(),
  expiresAt: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), 'Invalid expiry date')
    .optional(),
  offerConfirmationDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), 'Invalid offer confirmation date')
    .optional(),
}).refine(
  (data) => (data.amount ?? data.salary) !== undefined,
  { message: 'Offer amount or salary is required', path: ['amount'] }
).refine(
  (data) => (data.startDate ?? data.joiningDate) !== undefined,
  { message: 'Start date or joining date is required', path: ['startDate'] }
);

export const hireApplicantSchema = z.object({
  startDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), 'Invalid start date'),
  endDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), 'Invalid end date')
    .optional(),
  salary: z.number().positive('Salary must be positive'),
  notes: z.string().max(1000).trim().optional(),
});

// ─── Employee / assignment management ────────────────────────────────────────

export const updateEmployeeStatusSchema = z.object({
  status: z.enum(['active', 'paused', 'on_leave', 'completed', 'terminated']),
  reason: z.string().max(500).trim().optional(),
});

export const terminateEmployeeSchema = z.object({
  reason: z.string().min(5, 'Termination reason is required').max(500).trim(),
  type: z.enum(['resignation', 'dismissal', 'contract_end', 'mutual_agreement', 'other']).optional(),
});

export const markAttendanceSchema = z.object({
  status: z.enum([
    'present', 'absent', 'half_day', 'late', 'on_leave',
    'checkin_confirmed', 'checkout_confirmed', 'cancelled',
  ]),
  notes: z.string().max(500).trim().optional(),
  checkInTime: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), 'Invalid check-in time')
    .optional(),
  checkOutTime: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), 'Invalid check-out time')
    .optional(),
});

// ─── Leave approval (hospital side) ──────────────────────────────────────────

export const reviewLeaveSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  notes: z.string().max(500).trim().optional(),
});

// ─── Staffing details ─────────────────────────────────────────────────────────

export const updateStaffingSchema = z.object({
  totalDoctors: z.number().int().min(0).optional(),
  totalNurses: z.number().int().min(0).optional(),
  totalStaff: z.number().int().min(0).optional(),
  specializations: z.array(z.string()).optional(),
  preferredExperience: z.number().int().min(0).optional(),
});

// ─── Exported types ────────────────────────────────────────────────────────────

export type UpdateGeneralInfoInput = z.infer<typeof updateGeneralInfoSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
export type UpdateInfrastructureInput = z.infer<typeof updateInfrastructureSchema>;
export type UpdateFacilitiesInput = z.infer<typeof updateFacilitiesSchema>;
export type UpdateRepresentativeInput = z.infer<typeof updateRepresentativeSchema>;
export type AddDepartmentInput = z.infer<typeof addDepartmentSchema>;
export type AddContactInput = z.infer<typeof addContactSchema>;
export type UpdateApplicationStatusInput = z.infer<typeof updateApplicationStatusSchema>;
export type ScheduleInterviewInput = z.infer<typeof scheduleInterviewSchema>;
export type SendOfferInput = z.infer<typeof sendOfferSchema>;
export type HireApplicantInput = z.infer<typeof hireApplicantSchema>;
export type UpdateEmployeeStatusInput = z.infer<typeof updateEmployeeStatusSchema>;
export type TerminateEmployeeInput = z.infer<typeof terminateEmployeeSchema>;
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
export type ReviewLeaveInput = z.infer<typeof reviewLeaveSchema>;
