// src/models/types/index.ts
// Shared model types and interfaces

// ============================================
// Enums
// ============================================

export enum UserRole {
  DOCTOR = 'doctor',
  HOSPITAL = 'hospital',
  PENDING = 'pending',
  ADMIN = 'admin',
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
  PREFER_NOT_TO_SAY = 'prefer_not_to_say',
}

export enum HospitalType {
  GOVERNMENT = 'government',
  PRIVATE = 'private',
  TRUST = 'trust',
  CORPORATE = 'corporate',
  CLINIC = 'clinic',
  NURSING_HOME = 'nursing_home',
  MULTI_SPECIALTY = 'multi_specialty',
  SUPER_SPECIALTY = 'super_specialty',
  PRIMARY_HEALTH_CENTER = 'primary_health_center',
  COMMUNITY_HEALTH_CENTER = 'community_health_center',
  DIAGNOSTIC_LAB = 'diagnostic_lab',
  RADIOLOGY_CENTRE = 'radiology_centre',
  PHARMACY = 'pharmacy',
  OTHERS = 'others',
}

export enum VerificationStatus {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export enum JobType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
  LOCUM_TENENS = 'locum_tenens',
  PER_DIEM = 'per_diem',
}

export enum JobStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  PAUSED = 'paused',
  FILLED = 'filled',
  EXPIRED = 'expired',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
  TRASH = 'trash',
}

export enum ApplicationStatus {
  APPLIED = 'applied',
  UNDER_REVIEW = 'under_review',
  SHORTLISTED = 'shortlisted',
  INTERVIEW_SCHEDULED = 'interview_scheduled',
  INTERVIEWED = 'interviewed',
  OFFER_MADE = 'offer_made',
  OFFER_DECLINED = 'offer_declined',
  HIRED = 'hired',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
}

export enum AssignmentStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  ON_LEAVE = 'on_leave',
  COMPLETED = 'completed',
  TERMINATED = 'terminated',
}

export enum FeedbackType {
  HOSPITAL_TO_DOCTOR = 'hospital_to_doctor',
  DOCTOR_TO_HOSPITAL = 'doctor_to_hospital',
}

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  HALF_DAY = 'half_day',
  LATE = 'late',
  ON_LEAVE = 'on_leave',
  HOLIDAY = 'holiday',
  PENDING = 'pending',
  // New approval workflow statuses
  CHECKIN_PENDING = 'checkin_pending',      // Doctor checked in, waiting hospital approval
  CHECKIN_CONFIRMED = 'checkin_confirmed',  // Hospital confirmed check-in
  CHECKOUT_PENDING = 'checkout_pending',    // Doctor checked out, waiting hospital approval
  CHECKOUT_CONFIRMED = 'checkout_confirmed', // Hospital confirmed check-out (final)
  CANCELLED = 'cancelled',                   // Hospital cancelled the attendance
}

export enum AttendanceApprovalStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  ABSENT = 'absent',
}

export enum LeaveType {
  ANNUAL = 'annual',
  SICK = 'sick',
  CASUAL = 'casual',
  EMERGENCY = 'emergency',
  UNPAID = 'unpaid',
  OTHER = 'other',
}

export enum LeaveStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export enum OtpType {
  EMAIL_VERIFICATION = 'email_verification',
  PASSWORD_RESET = 'password_reset',
}

export enum CompensationType {
  HOURLY = 'hourly',
  DAILY = 'daily',
  MONTHLY = 'monthly',
  PER_PATIENT = 'per_patient',
}

// ============================================
// JSON Field Interfaces
// ============================================

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Address {
  street?: string;
  area?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  landmark?: string;
  coordinates?: Coordinates;
}

export interface PhoneNumber {
  countryCode: string;
  number: string;
}

export interface AadhaarInfo {
  maskedNumber?: string;
  isVerified: boolean;
  verifiedAt?: Date;
  documentUrl?: {
    front?: string;
    back?: string;
  };
}

export interface Education {
  institution: string;
  degree: string;
  specialization?: string;
  startYear: number;
  endYear?: number;
  documentUrl?: string;
  isVerified: boolean;
}

export interface License {
  name: string;
  issuingBody: string;
  issueDate: string;
  expiryDate?: string;
  documentUrl?: string;
  isVerified: boolean;
}

export interface Skill {
  name: string;
  level?: string;
  certifyingAuthority?: string;
  validTill?: string;
  experienceYears?: number;
  documentUrl?: string;
}

export interface WorkExperience {
  role: string;
  department?: string;
  institution: string;
  location?: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  description?: string;
  documents?: string[];
  isVerified: boolean;
}

export interface PlatformStats {
  jobsCompleted: number;
  totalShifts: number;
  noShows: number;
  attendanceRate: number;
  rating: number;
  totalReviews: number;
  performanceScore: number;
}

export interface Availability {
  isAvailable: boolean;
  availableFrom?: string;
  availableUntil?: string;
  weeklyHours?: number;
  preferredDays?: string[];
  preferredShifts?: string[];
  noticePeriod?: string;
}

export interface CareerPreferences {
  shortTermJobs: boolean;
  longTermJobs: boolean;
  paymentPreference: CompensationType;
  expectedHourlyRate?: number;
  expectedDailyRate?: number;
  expectedMonthlyRate?: number;
  expectedPerPatientRate?: number;
  mealsIncluded: boolean;
  transportIncluded: boolean;
  accommodationIncluded: boolean;
  experienceYears?: number;
  availability: Availability;
  preferredLocations: string[];
  willingToRelocate: boolean;
  willingToTravel: boolean;
  jobStatus?: string;

  // ── CareChainX matching fields ─────────────────────────────────────────────
  /**
   * 7×24 binary availability matrix (7 days × 24 hours).
   * weeklyAvailabilityMatrix[dayIndex][hourIndex] = 1 means available.
   * dayIndex 0 = Monday … 6 = Sunday.
   */
  weeklyAvailabilityMatrix?: number[][];

  /**
   * Maximum distance (km) the doctor is willing to travel to a job site.
   * Used with geodesic distance for location scoring.
   */
  maxTravelDistance?: number;
}

export interface EmergencyContact {
  name?: string;
  relationship?: string;
  phone?: string;
}

export interface BankDetails {
  accountHolderName?: string;
  bankName?: string;
  ifscCode?: string;
  isVerified: boolean;
}

export interface ProfileSections {
  personal: boolean;
  education: boolean;
  licensure: boolean;
  skills: boolean;
  experience: boolean;
  preferences: boolean;
  documents: boolean;
}

export interface HospitalProfileSections {
  generalInfo: boolean;
  representativeDetails: boolean;
  staffingDetails: boolean;
  infrastructureDetails: boolean;
  trustVerification: boolean;
}

export interface HospitalLicense {
  licenseNumber?: string;
  issuingAuthority?: string;
  issueDate?: string;
  expiryDate?: string;
  isVerified: boolean;
  verifiedAt?: Date;
  documentUrl?: string;
}

export interface NABHAccreditation {
  certificateNumber?: string;
  validUntil?: string;
  isVerified: boolean;
  documentUrl?: string;
}

export interface Representative {
  fullName?: string;
  email?: string;
  phone?: PhoneNumber;
  aadhaar?: AadhaarInfo;
}

export interface ContactPerson {
  name: string;
  designation?: string;
  email?: string;
  phone?: PhoneNumber;
  isPrimary: boolean;
}

export interface Infrastructure {
  totalBeds?: number;
  icuBeds?: number;
  nicuPicuBeds?: number;
  operationTheaters?: number;
  emergencyBeds?: number;
  emergencyCapacity?: number;
  photos?: string[];
}

export interface HospitalStats {
  totalEmployees: number;
  activeJobs: number;
  totalJobsPosted: number;
  totalHires: number;
  rating: number;
  totalReviews: number;
}

export interface Duration {
  startDate: string;
  endDate?: string;
  isOngoing: boolean;
}

export interface Shift {
  startTime: string;
  endTime: string;
  shiftType?: string;
  breakDuration?: number;
}

export interface WorkSchedule {
  daysPerWeek?: number;
  weeklyHours?: number;
  workingDays?: string[];
}

export interface Compensation {
  type: CompensationType;
  amount: number;
  currency: string;
  isNegotiable?: boolean;
  minAmount?: number;
  maxAmount?: number;
}

export interface Facilities {
  meals: boolean;
  transport: boolean;
  accommodation: boolean;
  insurance: boolean;
}

export interface Requirements {
  minimumExperience?: number;
  qualifications?: string[];
  skills?: string[];
  certifications?: string[];
  preferredGender?: Gender;
  ageRange?: { min?: number; max?: number };
}

export interface ApplicationSettings {
  maxApplicants?: number;
  autoCloseOnFill: boolean;
  requireCoverLetter: boolean;
  questionnaire?: { question: string; required: boolean }[];
}

export interface JobStats {
  views: number;
  applications: number;
  shortlisted: number;
  interviewed: number;
  hired: number;
  rejected: number;
}

export interface StatusHistoryEntry {
  status: string;
  changedAt: string;
  changedBy?: string;
  notes?: string;
  reason?: string;
}

export interface Interview {
  scheduledAt?: string;
  location?: string;
  type?: string;
  interviewer?: string;
  notes?: string;
  feedback?: string;
  rating?: number;
  completedAt?: string;
}

export enum OfferStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
  WITHDRAWN = 'withdrawn',
}

export interface Offer {
  // Basic offer info
  madeAt?: string;
  amount?: number;           // Salary amount
  currency?: string;         // Currency (default INR)
  salaryType?: string;       // monthly, annual, etc.
  startDate?: string;        // Joining date
  reportingDate?: string;    // First reporting date
  terms?: string;            // Terms and conditions
  notes?: string;            // Additional notes from recruiter
  
  // Confirmation deadline
  expiresAt?: string;        // Offer confirmation deadline
  
  // Response
  status?: OfferStatus;
  acceptedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  
  // Email tracking
  emailSentAt?: string;
  emailId?: string;
}

export interface Rejection {
  reason?: string;
  feedback?: string;
  rejectedBy?: string;
  rejectedAt?: string;
}

export interface Withdrawal {
  reason?: string;
  withdrawnAt?: string;
}

export interface InternalNote {
  note: string;
  addedBy: string;
  addedAt: string;
}

export interface Schedule {
  shiftStart?: string;
  shiftEnd?: string;
  shiftType?: string;
  workingDays?: string[];
}

export interface OnCallStatus {
  isOnCall: boolean;
  availableFrom?: string;
  availableUntil?: string;
}

export interface ReportingTo {
  name?: string;
  designation?: string;
  contact?: string;
}

export interface Performance {
  daysPresent: number;
  daysAbsent: number;
  totalShifts: number;
  completedShifts: number;
  attendanceRate: number;
  rating: number;
}

export interface LeaveBalance {
  annual: { total: number; used: number };
  sick: { total: number; used: number };
  casual: { total: number; used: number };
}

export interface Termination {
  terminatedAt?: string;
  terminatedBy?: string;
  reason?: string;
  type?: string;
}

export interface CheckInOut {
  time: string;
  location?: Coordinates;
  method?: string;
  verifiedBy?: string;
}

export interface ScheduledShift {
  shiftStart?: string;
  shiftEnd?: string;
}

export interface WorkDuration {
  hours: number;
  minutes: number;
}

export interface LeaveDocument {
  name: string;
  url: string;
  uploadedAt: string;
}
