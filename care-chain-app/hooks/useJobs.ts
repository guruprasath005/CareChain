// hooks/useJobs.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { jobsApi, doctorApi, ApiError } from '../services/api';
import { useApiOptimization } from './useApiOptimization';

export interface Job {
  id: string;
  _id?: string;
  title: string;
  hospital: string;
  hospitalId?: string;
  hospitalName?: string;
  location: string;
  experience: string;
  minimumExperience?: number;
  salary: string;
  salaryRange?: { min: number; max: number; currency: string; period: string };
  avatar?: string | null;
  status: string;
  views?: number;
  specialization: string;
  dates: string;
  startDate?: string;
  endDate?: string;
  applicants?: number;
  applicationCount?: number;
  description: string;
  qualifications: string[];
  skills: string[];
  shiftTime?: string;
  shiftType?: string;
  jobType?: string;
  hasApplied?: boolean;
  facilities?: {
    meals: boolean;
    transport: boolean;
    accommodation: boolean;
    insurance: boolean;
  };
}

interface UseJobsOptions {
  page?: number;
  limit?: number;
  search?: string;
  specialization?: string;
  location?: string;
  jobType?: string;
  salaryMin?: number;
  salaryMax?: number;
  sortBy?: string;
  sortOrder?: string;
}

interface UseJobsResult {
  jobs: Job[];
  isLoading: boolean;
  error: string | null;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

// Transform backend job to frontend job format
export function transformJob(backendJob: any): Job {
  const hospitalNode = backendJob?.hospital;
  const profileNode = hospitalNode?.hospitalProfile;

  const hospitalName =
    backendJob?.hospitalName ||
    profileNode?.hospitalName ||
    hospitalNode?.fullName ||
    hospitalNode?.name ||
    (typeof hospitalNode === 'string' ? hospitalNode : 'Unknown Hospital');

  const locationCity =
    backendJob?.location?.city ||
    backendJob?.fullLocation?.city ||
    (typeof backendJob?.location === 'string' ? backendJob.location : 'Unknown');

  const minimumExperience =
    backendJob?.minimumExperience ??
    backendJob?.experience ??
    backendJob?.requirements?.minimumExperience ??
    backendJob?.experienceRequired?.min;

  const experienceText =
    typeof backendJob?.experience === 'string'
      ? backendJob.experience
      : typeof minimumExperience === 'number'
        ? `${minimumExperience} Years`
        : backendJob?.experience || 'Not specified';

  const salaryText =
    backendJob?.salary ||
    backendJob?.compensation?.display ||
    backendJob?.salaryDisplay ||
    (backendJob?.compensation?.amount
      ? `₹${backendJob.compensation.amount.toLocaleString('en-IN')}/${backendJob.compensation.type === 'hourly' ? 'hr' :
        backendJob.compensation.type === 'daily' ? 'day' :
          backendJob.compensation.type === 'per_patient' ? 'patient' :
            'month'
      }`
      : backendJob?.salary || 'Negotiable');

  // Extract avatar
  let avatar = backendJob?.avatar;
  if (!avatar) {
    if (profileNode?.images?.logo) avatar = profileNode.images.logo;
    else if (hospitalNode?.avatar) avatar = hospitalNode.avatar;
    else if (hospitalNode?.logo) avatar = hospitalNode.logo;
  }

  return {
    id: backendJob._id || backendJob.id,
    _id: backendJob._id,
    title: backendJob.title,
    hospital: hospitalName,
    hospitalId: (typeof hospitalNode === 'string' ? hospitalNode : (hospitalNode?._id || hospitalNode?.id)) || backendJob?.hospitalId,
    hospitalName: hospitalName,
    location: locationCity,
    experience: experienceText,
    minimumExperience: typeof minimumExperience === 'number' ? minimumExperience : undefined,
    salary: salaryText,
    salaryRange: backendJob.salaryRange,
    avatar: avatar || null,
    status: backendJob.status || 'Open',
    views: backendJob.views || 0,
    specialization: backendJob.specialization || 'General',
    dates: (() => {
      const duration = backendJob.duration || {};
      const startDate = duration.startDate || backendJob.startDate;
      const endDate = duration.endDate || backendJob.endDate;

      if (startDate) {
        const start = new Date(startDate);
        const startYear = start.getFullYear();

        if (endDate) {
          const end = new Date(endDate);
          const endYear = end.getFullYear();

          if (startYear === endYear) {
            return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
          }
          return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        }

        // Only start date exists (Ongoing)
        return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - Ongoing`;
      }
      return backendJob.dates || 'Flexible';
    })(),
    startDate: backendJob.duration?.startDate || backendJob.startDate,
    endDate: backendJob.duration?.endDate || backendJob.endDate,
    applicants: backendJob.applicationCount || backendJob.applicants || 0,
    applicationCount: backendJob.applicationCount,
    description: backendJob.description || '',
    qualifications: backendJob.qualifications || backendJob.requirements?.qualifications || [],
    skills:
      backendJob.skills?.map((s: any) => (typeof s === 'string' ? s : s.name)) ||
      backendJob.requirements?.skills ||
      [],
    shiftTime: backendJob.shiftDetails?.startTime && backendJob.shiftDetails?.endTime
      ? `${backendJob.shiftDetails.startTime} - ${backendJob.shiftDetails.endTime}`
      : backendJob.shiftTime || 'Day Shift',
    shiftType: backendJob.shiftDetails?.type || backendJob.shiftType || 'Day Shift',
    jobType: backendJob.jobType,
    hasApplied: backendJob.hasApplied || false,
    facilities: backendJob.facilities || {
      meals: false,
      transport: false,
      accommodation: false,
      insurance: false,
    },
  };
}

export function useJobs(options: UseJobsOptions = {}): UseJobsResult {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(options.page || 1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Track previous query parameters to detect changes (Requirement 11.4)
  const prevQueryRef = useRef<string>('');
  
  // API call optimization (Requirements 12.1, 12.2, 12.3, 12.4, 12.5)
  const apiOptimization = useApiOptimization<UseJobsOptions>();

  const fetchJobs = useCallback(async (page: number = 1, append: boolean = false) => {
    const params = {
      page,
      limit: options.limit || 10,
      search: options.search,
      specialization: options.specialization,
      location: options.location,
      jobType: options.jobType,
      salaryMin: options.salaryMin,
      salaryMax: options.salaryMax,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
    };
    
    // API OPTIMIZATION: Prevent duplicate API calls (Requirement 9.2)
    // Skip only if not appending (load more) and parameters haven't changed
    // This prevents unnecessary API calls when the same search is performed multiple times
    if (!append && apiOptimization.shouldSkipRequest(params)) {
      return;
    }
    
    // API OPTIMIZATION: Prevent concurrent requests (Requirement 9.3)
    // Don't trigger duplicate requests if one is in progress
    // This prevents race conditions from rapid user interactions
    if (apiOptimization.isRequestInProgress() && !append) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Prepare request and get abort signal (Requirement 9.3)
      // This sets up request cancellation support for when parameters change
      apiOptimization.prepareRequest(params);
      
      const response = await jobsApi.searchJobs(params);

      if (response.success) {
        const items = Array.isArray(response.data) ? response.data : [];
        const transformedJobs = items.map(transformJob);
        
        // When not appending (new search/filter), clear previous results
        // When appending (load more), add to existing results
        setJobs((prev) => (append ? [...prev, ...transformedJobs] : transformedJobs));

        // Backend sends pagination at response.meta, not response.meta.pagination
        const pagination = response.meta;
        setTotalCount(pagination?.totalItems ?? transformedJobs.length);
        setCurrentPage(pagination?.page ?? page);
        setTotalPages(pagination?.totalPages ?? 1);
      }
    } catch (err) {
      // Don't set error if request was aborted (cancelled)
      // Aborted requests are expected when parameters change
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const message = err instanceof ApiError ? err.message : 'Failed to fetch jobs';
      setError(message);
    } finally {
      setIsLoading(false);
      apiOptimization.completeRequest();
    }
  }, [options.search, options.specialization, options.location, options.jobType, options.salaryMin, options.salaryMax, options.sortBy, options.sortOrder, options.limit, apiOptimization]);

  useEffect(() => {
    // Create a query signature to detect parameter changes (Requirement 11.1, 11.2)
    // We stringify the parameters to create a unique signature for comparison
    const currentQuery = JSON.stringify({
      search: options.search,
      specialization: options.specialization,
      location: options.location,
      jobType: options.jobType,
      salaryMin: options.salaryMin,
      salaryMax: options.salaryMax,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
    });

    // Detect if query parameters have changed (Requirements 11.1, 11.2)
    // Skip the check on initial mount (when prevQueryRef is empty)
    const queryChanged = prevQueryRef.current !== '' && prevQueryRef.current !== currentQuery;
    
    if (queryChanged) {
      // PAGINATION RESET LOGIC (Requirement 11.3)
      // When search/filter parameters change, we need to:
      // 1. Clear previous results to avoid showing stale data
      // 2. Reset to page 1 since we're starting a new search
      // 3. Cancel any pending requests to prevent race conditions
      setJobs([]);           // Clear previous results
      setCurrentPage(1);     // Reset to page 1
      // Cancel pending requests when input changes (Requirement 9.3)
      apiOptimization.cancelPendingRequest();
    }
    
    // Update the previous query reference for next comparison
    prevQueryRef.current = currentQuery;
    
    // Fetch results - always start from page 1 when query changes
    fetchJobs(1);
  }, [fetchJobs, apiOptimization]);

  const refresh = useCallback(async () => {
    await fetchJobs(1);
  }, [fetchJobs]);

  const loadMore = useCallback(async () => {
    // Only load more if query hasn't changed (Requirement 11.4)
    if (currentPage < totalPages && !isLoading) {
      await fetchJobs(currentPage + 1, true);
    }
  }, [currentPage, totalPages, isLoading, fetchJobs]);

  return {
    jobs,
    isLoading,
    error,
    totalCount,
    currentPage,
    totalPages,
    refresh,
    loadMore,
    hasMore: currentPage < totalPages,
  };
}

// Hook for fetching a single job
export function useJobDetails(jobId: string) {
  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJob = useCallback(async () => {
    if (!jobId) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await jobsApi.getJobDetails(jobId);
      if (response.success && response.data?.job) {
        setJob(transformJob(response.data.job));
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to fetch job details';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  return { job, isLoading, error, refresh: fetchJob };
}

// Hook for applying to a job
export function useJobApplication() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(async (jobId: string, coverLetter?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await doctorApi.applyToJob(jobId, coverLetter);
      return { success: response.success, data: response.data };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to apply';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const withdraw = useCallback(async (jobId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await doctorApi.withdrawApplication(jobId);
      return { success: response.success };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to withdraw';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { apply, withdraw, isLoading, error };
}

// Hook for featured/recent jobs
export function useFeaturedJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await jobsApi.getFeaturedJobs();
      if (response.success && response.data?.jobs) {
        setJobs(response.data.jobs.map(transformJob));
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to fetch featured jobs';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  return { jobs, isLoading, error, refresh: fetchJobs };
}

export function useRecentJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await jobsApi.getRecentJobs();
      if (response.success && response.data) {
        // Handle multiple response formats
        let jobsData: any[] = [];
        if (Array.isArray(response.data)) {
          jobsData = response.data;
        } else if (Array.isArray(response.data.jobs)) {
          jobsData = response.data.jobs;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          jobsData = response.data.data;
        }
        setJobs(jobsData.map(transformJob));
      } else {
        setJobs([]);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to fetch recent jobs';

      // Handle rate limiting specifically
      if (err instanceof ApiError && err.message?.toLowerCase().includes('too many')) {
        setError('Too many requests. Please wait a moment and try again.');
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  return { jobs, isLoading, error, refresh: fetchJobs };
}
