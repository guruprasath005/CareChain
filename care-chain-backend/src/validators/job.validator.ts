// src/validators/job.validator.ts
import { z } from 'zod';

// ─── Shared building blocks ────────────────────────────────────────────────────

const compensationSchema = z.object({
  type: z.enum(['hourly', 'daily', 'monthly', 'per_patient']),
  amount: z.number().positive('Compensation amount must be positive'),
  currency: z.string().length(3).default('INR'),
  isNegotiable: z.boolean().default(false),
  minAmount: z.number().positive().optional(),
  maxAmount: z.number().positive().optional(),
});

const durationSchema = z.object({
  startDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), 'Invalid start date'),
  endDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), 'Invalid end date')
    .optional(),
  isOngoing: z.boolean().default(false),
});

const shiftSchema = z.object({
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format')
    .optional(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format')
    .optional(),
  shiftType: z
    .enum(['day', 'night', 'rotational', 'flexible'])
    .optional(),
  breakDuration: z.number().int().min(0).optional(),
});

const requirementsSchema = z.object({
  minimumExperience: z.number().int().min(0).max(50).default(0),
  qualifications: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  certifications: z.array(z.string()).optional(),
  preferredGender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  ageRange: z
    .object({
      min: z.number().int().min(18).optional(),
      max: z.number().int().max(100).optional(),
    })
    .optional(),
});

const facilitiesSchema = z.object({
  meals: z.boolean().default(false),
  transport: z.boolean().default(false),
  accommodation: z.boolean().default(false),
  insurance: z.boolean().default(false),
});

// ─── Create job ───────────────────────────────────────────────────────────────

export const createJobSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200).trim(),
  description: z
    .string()
    .min(20, 'Description must be at least 20 characters')
    .max(5000)
    .trim(),
  specialization: z.string().min(2).max(100).trim(),
  department: z.string().max(100).trim().optional(),
  jobType: z.enum(['full_time', 'part_time', 'contract', 'locum_tenens', 'per_diem']),
  status: z.enum(['draft', 'open']).default('open'),
  duration: durationSchema,
  shift: shiftSchema.optional(),
  location: z.object({
    city: z.string().min(1).max(100).trim(),
    state: z.string().min(1).max(100).trim(),
    pincode: z
      .string()
      .regex(/^\d{6}$/, 'Pincode must be exactly 6 digits')
      .optional(),
  }),
  compensation: compensationSchema,
  requirements: requirementsSchema.optional(),
  facilities: facilitiesSchema.optional(),
  applicationSettings: z
    .object({
      maxApplicants: z.number().int().positive().optional(),
      autoCloseOnFill: z.boolean().default(false),
      requireCoverLetter: z.boolean().default(false),
    })
    .optional(),
  workSchedule: z
    .object({
      daysPerWeek: z.number().int().min(1).max(7).optional(),
      weeklyHours: z.number().int().min(1).max(168).optional(),
      workingDays: z.array(z.string()).optional(),
    })
    .optional(),
  isUrgent: z.boolean().default(false),
  tags: z.array(z.string()).optional(),
});

// ─── Update job (all fields optional) ─────────────────────────────────────────

export const updateJobSchema = createJobSchema
  .omit({ status: true })
  .partial()
  .extend({
    status: z
      .enum(['draft', 'open', 'paused', 'filled', 'expired', 'closed', 'cancelled'])
      .optional(),
  });

// ─── Bulk create ──────────────────────────────────────────────────────────────

export const bulkCreateJobsSchema = z.object({
  jobs: z
    .array(createJobSchema)
    .min(1, 'At least one job is required')
    .max(1000, 'Cannot create more than 1000 jobs at once'),
});

// ─── Search / filter jobs (query params — all strings from URL) ───────────────

export const searchJobsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? Math.max(1, parseInt(v, 10)) : 1)),
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(100, Math.max(1, parseInt(v ?? '20', 10)))),
  q: z.string().max(200).trim().optional(),
  specialization: z.string().max(100).trim().optional(),
  city: z.string().max(100).trim().optional(),
  state: z.string().max(100).trim().optional(),
  jobType: z
    .enum(['full_time', 'part_time', 'contract', 'locum_tenens', 'per_diem'])
    .optional(),
  minSalary: z
    .string()
    .optional()
    .transform((v) => (v ? parseFloat(v) : undefined)),
  maxSalary: z
    .string()
    .optional()
    .transform((v) => (v ? parseFloat(v) : undefined)),
  sortBy: z
    .enum(['newest', 'salary_high', 'salary_low', 'relevance'])
    .default('newest'),
  isUrgent: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
});

// ─── Exported types ────────────────────────────────────────────────────────────

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type BulkCreateJobsInput = z.infer<typeof bulkCreateJobsSchema>;
export type SearchJobsQuery = z.infer<typeof searchJobsQuerySchema>;
