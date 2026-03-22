import { useState, useEffect, useCallback } from 'react';
import { doctorApi, hospitalApi, ApiError } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getFullImageUrl } from '@/utils/upload';

type ProfileCompletionValue =
  | number
  | {
    percentage?: number;
    sections?: unknown;
    isComplete?: boolean;
  }
  | null
  | undefined;

const clampPercentage = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
};

const getCompletionPercentage = (value: ProfileCompletionValue): number => {
  if (typeof value === 'number') return clampPercentage(value);
  if (value && typeof value === 'object') {
    const maybe = (value as any).percentage;
    if (typeof maybe === 'number') return clampPercentage(maybe);
  }
  return 0;
};

const getCompletionIsComplete = (value: ProfileCompletionValue): boolean | undefined => {
  if (value && typeof value === 'object') {
    const maybe = (value as any).isComplete;
    if (typeof maybe === 'boolean') return maybe;
  }
  return undefined;
};

export interface DoctorProfile {
  id: string;

  // Basic Info (from backend DTO)
  name: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string; // maskedPhone from backend
  phoneNumber?: string;
  isPhoneVerified?: boolean;
  phoneCountryCode?: string;
  gender?: string;
  avatar?: string | null;

  // Professional Info
  specialization?: string;
  subSpecializations?: string[];
  designation?: string;
  currentHospital?: string;
  yearsOfExperience?: number;

  // Location (object from backend)
  location?: {
    city?: string;
    state?: string;
    fullAddress?: string;
  };

  // Bio
  bio?: string;

  // Verification Status
  verification?: {
    email?: boolean;
    phone?: boolean;
    aadhaar?: {
      verified: boolean;
      maskedNumber?: string;
    };
    medicalLicense?: boolean;
  };

  // Education
  education?: Array<{
    institution: string;
    degree: string;
    specialization?: string;
    startYear?: number;
    endYear?: number;
    documentUrl?: string;
    isVerified?: boolean;
  }>;

  // Licenses
  licenses?: Array<{
    name: string;
    registrationNumber?: string;
    issuingBody?: string;
    issuingAuthority?: string; // Alias for issuingBody
    issueDate?: string;
    expiryDate?: string;
    validFrom?: string; // Alias for issueDate
    validTill?: string; // Alias for expiryDate
    documentUrl?: string;
    isVerified?: boolean;
  }>;

  // Skills
  skills?: Array<{
    name: string;
    level?: string;
    certificate?: string;
  }>;

  // Platform Stats (from backend)
  stats?: {
    shiftsDone?: number;
    noShows?: number;
    performance?: number;
    rating?: number;
    jobsCompleted?: number;
    attendanceRate?: number;
  };

  // Platform Experience (on-platform assignments)
  platformExperience?: Array<{
    id?: string;
    role?: string;
    hospitalName?: string;
    department?: string;
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
    status?: string;
    type?: string;
  }>;

  // Profile Completion (can be object or number)
  profileCompletion?: number | {
    percentage?: number;
    sections?: unknown;
    isComplete?: boolean;
  };

  // Normalized completion details (keeps sections for UI)
  profileCompletionDetails?: {
    percentage: number;
    sections?: {
      personal?: boolean;
      education?: boolean;
      licensure?: boolean;
      skills?: boolean;
      experience?: boolean;
      preferences?: boolean;
      documents?: boolean;
    };
    isComplete?: boolean;
  };

  // Availability
  isAvailable?: boolean;

  // Legacy fields for backwards compatibility
  fullName?: string;
  personalInfo?: {
    firstName: string;
    lastName: string;
    gender?: string;
    dateOfBirth?: string;
    nationality?: string;
    languages?: string[];
  };
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    postalCode?: string;
    country?: string;
  };
  preferences?: {
    jobTypes?: string[];
    preferredLocations?: string[];
    expectedSalary?: {
      min: number;
      max: number;
      currency: string;
    };
    availability?: string;
  };

  // Off-platform experience (workExperience)
  experience?: Array<{
    role?: string;
    department?: string;
    institution?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
    description?: string;
    documents?: Array<{
      title?: string;
      url?: string;
      fileName?: string;
      size?: string;
      uploadedAt?: string;
    }>;
    isVerified?: boolean;
  }>;

  // On-platform experience (assignments)
  platformExperience?: Array<{
    id?: string;
    role?: string;
    hospitalName?: string;
    department?: string;
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
    status?: string;
    type?: string;
  }>;

  // Career preferences
  jobPreferences?: {
    shortTermJobs?: boolean;
    longTermJobs?: boolean;
    paymentPreference?: 'per_hour' | 'per_day' | 'per_patient' | 'negotiable';
    expectedHourlyRate?: number;
    expectedDailyRate?: number;
    expectedMonthlyRate?: number;
    expectedPerPatientRate?: number;
    mealsIncluded?: boolean;
    transportIncluded?: boolean;
    accommodationIncluded?: boolean;
    availability?: {
      isAvailable?: boolean;
      availableFrom?: string;
      availableUntil?: string;
      weeklyHours?: number;
      preferredDays?: Array<
        | 'monday'
        | 'tuesday'
        | 'wednesday'
        | 'thursday'
        | 'friday'
        | 'saturday'
        | 'sunday'
      >;
      preferredShifts?: Array<'morning' | 'afternoon' | 'evening' | 'night' | 'flexible'>;
      noticePeriod?: number;
    };
    preferredLocations?: Array<{ city?: string; state?: string; maxDistance?: number }>;
    willingToRelocate?: boolean;
    willingToTravel?: boolean;
    jobStatus?: string;
  };
}

export interface HospitalProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  logo?: string;
  registrationNumber?: string;
  type?: string;
  typeOther?: string;
  website?: string;
  description?: string;

  phone?: {
    countryCode: string;
    number: string;
    isVerified?: boolean;
  };

  // Location
  location?: {
    street?: string;
    area?: string;
    city?: string;
    state?: string;
    pincode?: string;
    fullAddress?: string;
    coordinates?: [number, number];
  };

  // Address (legacy compatibility)
  address?: {
    street?: string;
    area?: string;
    city?: string;
    state?: string;
    pincode?: string;
    postalCode?: string;
    country?: string;
    fullAddress?: string;
  };

  // Representative Details
  representative?: {
    fullName?: string;
    email?: string;
    phone?: {
      countryCode: string;
      number: string;
    };
    aadhaar?: {
      maskedNumber?: string;
      isVerified?: boolean;
      document?: {
        url?: string;
        fileName?: string;
        uploadedAt?: string;
        fileSize?: string;
      };
    };
  };

  // Staffing
  staffing?: {
    totalDoctors?: number;
    totalNurses?: number;
    totalStaff?: number;
  };

  // Infrastructure
  infrastructure?: {
    totalBeds?: number;
    icuBeds?: number;
    nicuPicuBeds?: number;
    operationTheaters?: number;
    emergencyBeds?: number;
    photos?: Array<{
      url: string;
      caption?: string;
      uploadedAt?: string;
    }>;
  };

  // Facilities
  facilities?: {
    opFacility?: boolean;
    ipFacility?: boolean;
    ipBeds?: number;
    emergencyDepartment?: boolean;
    emergency24x7?: boolean;
    icuFacilities?: boolean;
    nicuPicu?: boolean;
    nicuPicuFacilities?: boolean;
    operationTheatre?: boolean;
    diagnosticLab?: boolean;
    labFacilities?: string[];
    labFacilitiesOther?: string;
    radiologyDepartment?: boolean;
    imagingFacilities?: string[];
    imagingFacilitiesOther?: string;
    pharmacy?: boolean;
    pharmacyAvailable24x7?: boolean;
    securityAvailable?: boolean;
    ambulanceService?: boolean;
    bloodBank?: boolean;
  };

  // Specialties
  specialties?: string[];
  specialtiesOther?: string;

  // Credentials
  credentials?: {
    registrationNumber?: string;
    accreditations?: string[];
    chiefDoctorRegNumber?: string;
    establishmentLicense?: {
      url?: string;
      isVerified?: boolean;
      fileName?: string;
      uploadedAt?: string;
    };
    fireSafetyNOC?: {
      url?: string;
      isVerified?: boolean;
      fileName?: string;
      uploadedAt?: string;
    };
    nabh?: {
      certificateNumber?: string;
      validUntil?: string;
      isVerified?: boolean;
      documentUrl?: string;
    };
  };

  // Facility Gallery
  facilityGallery?: Array<{
    url: string;
    caption?: string;
    uploadedAt?: string;
  }>;

  // Legacy
  departments?: string[];

  // Verification
  verification?: {
    status?: string;
    isVerified?: boolean;
    email?: boolean;
    license?: boolean;
    nabh?: boolean;
    aadhaar?: boolean;
  };

  // Profile Completion
  isProfileComplete: boolean;
  profileCompletion: number;
  profileCompletionDetails?: {
    percentage: number;
    sections?: {
      generalInfo?: boolean;
      representativeDetails?: boolean;
      staffingDetails?: boolean;
      infrastructureDetails?: boolean;
      trustVerification?: boolean;
    };
    isComplete?: boolean;
  };

  // Stats
  stats?: {
    totalJobs?: number;
    activeJobs?: number;
    totalEmployees?: number;
    totalHires?: number;
    rating?: number;
    totalReviews?: number;
  };
}

// Hospital Edit Profile Data
export interface HospitalEditProfile {
  id: string;
  generalInfo: {
    hospitalName?: string;
    hospitalType?: string;
    hospitalTypeOther?: string;
    email?: string;
    website?: string;
    description?: string;
    address?: {
      street?: string;
      area?: string;
      city?: string;
      state?: string;
      pincode?: string;
      country?: string;
      landmark?: string;
      coordinates?: [number, number];
    };
  };
  representativeDetails: {
    fullName?: string;
    email?: string;
    phone?: {
      countryCode?: string;
      number?: string;
    };
    aadhaar?: {
      maskedNumber?: string;
      isVerified?: boolean;
      document?: {
        url?: string;
        fileName?: string;
        uploadedAt?: string;
        fileSize?: string;
      };
    };
  };
  staffingDetails: {
    totalDoctors?: number;
    totalNurses?: number;
    totalStaff?: number;
  };
  infrastructureDetails: {
    specialties?: string[];
    specialtiesOther?: string;
    opFacility?: boolean;
    ipFacility?: boolean;
    ipBeds?: number;
    emergencyDepartment?: boolean;
    emergencyBeds?: number;
    icuFacilities?: boolean;
    icuBeds?: number;
    nicuPicuFacilities?: boolean;
    nicuPicuBeds?: number;
    operationTheatre?: boolean;
    operationTheaters?: number;
    diagnosticLab?: boolean;
    labFacilities?: string[];
    labFacilitiesOther?: string;
    radiologyDepartment?: boolean;
    imagingFacilities?: string[];
    imagingFacilitiesOther?: string;
    pharmacy?: boolean;
    pharmacyAvailable24x7?: boolean;
    securityAvailable?: boolean;
    photos?: Array<{ id?: string; url: string; caption?: string; uploadedAt?: string }>;
    facilityGallery?: Array<{ id?: string; url: string; caption?: string; uploadedAt?: string }>;
  };
  trustVerification: {
    registrationNumber?: string;
    accreditations?: string[];
    chiefDoctorRegNumber?: string;
    nabh?: {
      certificateNumber?: string;
      validUntil?: string;
      isVerified?: boolean;
      documentUrl?: string;
    };
    hospitalLicense?: {
      licenseNumber?: string;
      issuingAuthority?: string;
      issueDate?: string;
      expiryDate?: string;
      isVerified?: boolean;
      documentUrl?: string;
    };
    establishmentLicense?: {
      url?: string;
      isVerified?: boolean;
      fileName?: string;
      uploadedAt?: string;
    };
    fireSafetyNOC?: {
      url?: string;
      isVerified?: boolean;
      fileName?: string;
      uploadedAt?: string;
    };
  };
  images?: {
    logo?: string;
    coverPhoto?: string;
    gallery?: Array<{ id?: string; url: string; caption?: string }>;
  };
  profileSections?: {
    generalInfo?: boolean;
    representativeDetails?: boolean;
    staffingDetails?: boolean;
    infrastructureDetails?: boolean;
    trustVerification?: boolean;
  };
  profileCompletionPercentage?: number;
}

// Doctor Profile Hook
export function useDoctorProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (user?.role !== 'doctor') {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await doctorApi.getProfile();
      const doctorData = response.success ? ((response.data as any)?.doctor || (response.data as any)?.profile) : null;

      if (doctorData) {
        const doctor = doctorData as any;
        const completion = doctor?.profileCompletion as ProfileCompletionValue;
        const isCompleteFromCompletion = getCompletionIsComplete(completion);
        const sectionsFromCompletion =
          completion && typeof completion === 'object' ? (completion as any).sections : undefined;

        const completionPercentage = getCompletionPercentage(completion);

        // Resolve avatar URL if it's a local path
        const avatarUrl = getFullImageUrl(doctor.user?.avatarUrl || doctor.avatar);

        setProfile({
          ...doctor,
          avatar: avatarUrl,
          profileCompletion: completionPercentage,
          profileCompletionDetails: {
            percentage: completionPercentage,
            sections: sectionsFromCompletion,
            isComplete: isCompleteFromCompletion,
          },
          isProfileComplete:
            typeof doctor?.isProfileComplete === 'boolean'
              ? doctor.isProfileComplete
              : isCompleteFromCompletion ?? false,
        });
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to fetch profile';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updatePersonalInfo = useCallback(async (data: Partial<DoctorProfile['personalInfo']> & {
    phone?: DoctorProfile['phone'];
    address?: DoctorProfile['address'];
  }) => {
    try {
      const response = await doctorApi.updatePersonalInfo(data);
      if (response.success) {
        await fetchProfile();
        return { success: true };
      }
      return { success: false, error: 'Update failed' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update';
      return { success: false, error: message };
    }
  }, [fetchProfile]);

  const updatePreferences = useCallback(async (preferences: DoctorProfile['preferences']) => {
    try {
      const response = await doctorApi.updatePreferences(preferences);
      if (response.success) {
        await fetchProfile();
        return { success: true };
      }
      return { success: false, error: 'Update failed' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update';
      return { success: false, error: message };
    }
  }, [fetchProfile]);

  const addEducation = useCallback(async (education: any) => {
    try {
      const response = await doctorApi.addEducation(education);
      if (response.success) {
        await fetchProfile();
        return { success: true };
      }
      return { success: false, error: 'Failed to add education' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to add education';
      return { success: false, error: message };
    }
  }, [fetchProfile]);

  const addExperience = useCallback(async (experience: any) => {
    try {
      const response = await doctorApi.addExperience(experience);
      if (response.success) {
        await fetchProfile();
        return { success: true };
      }
      return { success: false, error: 'Failed to add experience' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to add experience';
      return { success: false, error: message };
    }
  }, [fetchProfile]);

  const addSkill = useCallback(async (skill: any) => {
    try {
      const response = await doctorApi.addSkill(skill);
      if (response.success) {
        await fetchProfile();
        return { success: true };
      }
      return { success: false, error: 'Failed to add skill' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to add skill';
      return { success: false, error: message };
    }
  }, [fetchProfile]);

  return {
    profile,
    isLoading,
    error,
    refresh: fetchProfile,
    updatePersonalInfo,
    updatePreferences,
    addEducation,
    addExperience,
    addSkill,
  };
}

// Hospital Profile Hook
export function useHospitalProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<HospitalProfile | null>(null);
  const [editProfile, setEditProfile] = useState<HospitalEditProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (user?.role !== 'hospital') {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await hospitalApi.getProfile();
      // Backend returns { profile: ... } or { hospital: ... }
      const hospitalData = response.success ? ((response.data as any)?.hospital || (response.data as any)?.profile) : null;

      if (hospitalData) {
        const hospital = hospitalData as any;
        const completion = hospital?.profileCompletion as ProfileCompletionValue;
        const completionDetails = hospital?.profileCompletionDetails;
        const isCompleteFromCompletion = getCompletionIsComplete(completion) || completionDetails?.isComplete;

        const avatarUrl = getFullImageUrl(hospital.avatar || hospital.logo);

        setProfile({
          ...hospital,
          avatar: avatarUrl,
          profileCompletion: getCompletionPercentage(completion),
          profileCompletionDetails: completionDetails || {
            percentage: getCompletionPercentage(completion),
            sections: hospital?.profileSections,
            isComplete: isCompleteFromCompletion,
          },
          isProfileComplete:
            typeof hospital?.isProfileComplete === 'boolean'
              ? hospital.isProfileComplete
              : isCompleteFromCompletion ?? false,
        });
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to fetch profile';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.role]);

  const fetchEditProfile = useCallback(async () => {
    if (user?.role !== 'hospital') return;

    try {
      const response = await hospitalApi.getEditProfile();
      // Backend returns { profile: ... } or { hospital: ... }
      const hospitalData = response.success ? ((response.data as any)?.hospital || (response.data as any)?.profile) : null;
      if (hospitalData) {
        setEditProfile(hospitalData as HospitalEditProfile);
      }
    } catch (err) {
      console.warn('Failed to fetch edit profile:', err);
    }
  }, [user?.role]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile) {
      fetchEditProfile();
    }
  }, [profile?.id, fetchEditProfile]);

  const updateProfile = useCallback(async (data: Partial<HospitalProfile>) => {
    try {
      const response = await hospitalApi.updateProfile(data);
      if (response.success) {
        await fetchProfile();
        return { success: true };
      }
      return { success: false, error: 'Update failed' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update';
      return { success: false, error: message };
    }
  }, [fetchProfile]);

  const updateGeneralInfo = useCallback(async (data: any) => {
    try {
      const response = await hospitalApi.updateGeneralInfo(data);
      if (response.success) {
        await fetchProfile();
        await fetchEditProfile();
        return { success: true };
      }
      return { success: false, error: 'Update failed' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update';
      return { success: false, error: message };
    }
  }, [fetchProfile, fetchEditProfile]);

  const updateRepresentativeDetails = useCallback(async (data: any) => {
    try {
      const response = await hospitalApi.updateRepresentativeDetails(data);
      if (response.success) {
        await fetchProfile();
        await fetchEditProfile();
        return { success: true };
      }
      return { success: false, error: 'Update failed' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update';
      return { success: false, error: message };
    }
  }, [fetchProfile, fetchEditProfile]);

  const updateRepresentativeAadhaar = useCallback(async (aadhaarNumber: string) => {
    try {
      const response = await hospitalApi.updateRepresentativeAadhaar(aadhaarNumber);
      if (response.success) {
        await fetchProfile();
        await fetchEditProfile();
        return { success: true };
      }
      return { success: false, error: 'Update failed' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update';
      return { success: false, error: message };
    }
  }, [fetchProfile, fetchEditProfile]);

  const updateStaffingDetails = useCallback(async (data: any) => {
    try {
      const response = await hospitalApi.updateStaffingDetails(data);
      if (response.success) {
        await fetchProfile();
        await fetchEditProfile();
        return { success: true };
      }
      return { success: false, error: 'Update failed' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update';
      return { success: false, error: message };
    }
  }, [fetchProfile, fetchEditProfile]);

  const updateInfrastructureDetails = useCallback(async (data: any) => {
    try {
      const response = await hospitalApi.updateInfrastructureDetails(data);
      if (response.success) {
        await fetchProfile();
        await fetchEditProfile();
        return { success: true };
      }
      return { success: false, error: 'Update failed' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update';
      return { success: false, error: message };
    }
  }, [fetchProfile, fetchEditProfile]);

  const updateCredentials = useCallback(async (data: any) => {
    try {
      const response = await hospitalApi.updateCredentials(data);
      if (response.success) {
        await fetchProfile();
        await fetchEditProfile();
        return { success: true };
      }
      return { success: false, error: 'Update failed' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update';
      return { success: false, error: message };
    }
  }, [fetchProfile, fetchEditProfile]);

  return {
    profile,
    editProfile,
    isLoading,
    error,
    refresh: fetchProfile,
    fetchEditProfile,
    refreshEditProfile: fetchEditProfile,
    updateProfile,
    updateGeneralInfo,
    updateRepresentativeDetails,
    updateRepresentativeAadhaar,
    updateStaffingDetails,
    updateInfrastructureDetails,
    updateCredentials,
  };
}

/**
 * Unified Profile Hook
 *
 * Some screens import `useProfile()` and expect a `{ profile, loading }` shape.
 * Internally we keep separate doctor/hospital hooks; this wrapper selects the
 * appropriate one based on the authenticated user's role.
 */
export function useProfile() {
  const { user } = useAuth();

  // Hook rules: call both; each hook no-ops when role doesn't match.
  const doctor = useDoctorProfile();
  const hospital = useHospitalProfile();

  const selected = user?.role === 'hospital' ? hospital : doctor;

  return {
    ...selected,
    loading: selected.isLoading,
  };
}
