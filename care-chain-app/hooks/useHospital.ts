// hooks/useHospital.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { hospitalApi, ApiError } from '../services/api';
import { useApiOptimization } from './useApiOptimization';

export interface PostedJob {
  id: string;
  _id?: string;
  title: string;
  specialization: string;
  location: string;
  status: 'draft' | 'open' | 'paused' | 'filled' | 'expired' | 'closed' | 'cancelled' | 'trash';
  views: number;
  applicants: number;
  applicationCount?: number;
  rejections: number;
  salary: string;
  salaryRange?: {
    min: number;
    max: number;
    currency: string;
    period: string;
  };
  dates: string;
  startDate?: string;
  endDate?: string;
  shiftTime?: string;
  jobType?: string;
  createdAt: string;
}

function transformPostedJob(backendJob: any): PostedJob {
  // Format salary - handle compensation object from backend
  let salaryDisplay = 'Negotiable';
  if (backendJob.compensation) {
    const comp = backendJob.compensation;
    const amount = comp.amount;
    if (amount) {
      const formattedAmount = amount.toLocaleString('en-IN');
      const periodLabel = comp.type === 'hourly' ? '/hr' :
        comp.type === 'daily' ? '/day' :
          comp.type === 'weekly' ? '/week' : '/month';
      salaryDisplay = `₹${formattedAmount}${periodLabel}`;
    }
  } else if (backendJob.salary) {
    salaryDisplay = backendJob.salary;
  }

  // Format shift time - handle shift object from backend
  let shiftTimeDisplay = 'Not specified';
  if (backendJob.shift) {
    const shift = backendJob.shift;
    if (shift.startTime && shift.endTime) {
      shiftTimeDisplay = `${shift.startTime} - ${shift.endTime}`;
    } else if (shift.time) {
      shiftTimeDisplay = shift.time;
    }
  } else if (backendJob.shiftTime) {
    shiftTimeDisplay = backendJob.shiftTime;
  }

  return {
    id: backendJob._id || backendJob.id,
    _id: backendJob._id,
    title: backendJob.title,
    specialization: backendJob.specialization || 'General',
    location: backendJob.location?.city || backendJob.location || 'Unknown',
    status: backendJob.status,
    views: backendJob.stats?.views ?? backendJob.views ?? 0,
    applicants:
      backendJob.stats?.applications ??
      backendJob.applicationCount ??
      backendJob.applicants ??
      0,
    applicationCount: backendJob.applicationCount,
    rejections: backendJob.stats?.rejected ?? 0,
    salary: salaryDisplay,
    salaryRange: backendJob.salaryRange,
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
      return backendJob.duration?.display || backendJob.dates || 'Ongoing';
    })(),
    startDate: backendJob.duration?.startDate || backendJob.startDate,
    endDate: backendJob.duration?.endDate || backendJob.endDate,
    shiftTime: shiftTimeDisplay,
    jobType: backendJob.jobType,
    createdAt: backendJob.createdAt,
  };
}


export function usePostedJobs(status?: string, searchQuery?: string, filters?: {
  status?: string;
  datePosted?: string;
  minApplicants?: number;
  maxApplicants?: number;
}) {
  const [jobs, setJobs] = useState<PostedJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ active: 0, closed: 0, total: 0 });

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await hospitalApi.getPostedJobs({ 
        status, 
        q: searchQuery,
        filterStatus: filters?.status,
        datePosted: filters?.datePosted,
        minApplicants: filters?.minApplicants,
        maxApplicants: filters?.maxApplicants,
      });
      if (response.success && response.data) {
        const items = Array.isArray(response.data)
          ? response.data
          : Array.isArray((response.data as any)?.jobs)
            ? (response.data as any).jobs
            : [];

        const transformedJobs = items.map(transformPostedJob);
        setJobs(transformedJobs);

        if ((response.data as any).stats) {
          setStats((response.data as any).stats);
        } else {
          // Calculate stats from jobs
          const activeCount = transformedJobs.filter(
            (j: PostedJob) => j.status === 'open' || j.status === 'paused'
          ).length;
          const closedCount = transformedJobs.filter(
            (j: PostedJob) =>
              j.status === 'closed' ||
              j.status === 'expired' ||
              j.status === 'filled' ||
              j.status === 'cancelled'
          ).length;
          setStats({
            active: activeCount,
            closed: closedCount,
            total: transformedJobs.length,
          });
        }
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to fetch jobs';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [status, searchQuery, filters]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const closeJob = useCallback(async (jobId: string) => {
    try {
      const response = await hospitalApi.closeJob(jobId);
      if (response.success) {
        await fetchJobs();
        return { success: true };
      }
      return { success: false, error: 'Failed to close job' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to close job';
      return { success: false, error: message };
    }
  }, [fetchJobs]);

  const deleteJob = useCallback(async (jobId: string) => {
    try {
      const response = await hospitalApi.deleteJob(jobId);
      if (response.success) {
        await fetchJobs();
        return { success: true };
      }
      return { success: false, error: 'Failed to delete job' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete job';
      return { success: false, error: message };
    }
  }, [fetchJobs]);

  const restoreJob = useCallback(async (jobId: string) => {
    try {
      const response = await hospitalApi.restoreJob(jobId);
      if (response.success) {
        await fetchJobs();
        return { success: true };
      }
      return { success: false, error: 'Failed to restore job' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to restore job';
      return { success: false, error: message };
    }
  }, [fetchJobs]);

  const deleteJobPermanently = useCallback(async (jobId: string) => {
    try {
      const response = await hospitalApi.deleteJobPermanently(jobId);
      if (response.success) {
        await fetchJobs();
        return { success: true };
      }
      return { success: false, error: 'Failed to delete job permanently' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete job permanently';
      return { success: false, error: message };
    }
  }, [fetchJobs]);

  const updateJob = useCallback(async (jobId: string, data: any) => {
    try {
      const response = await hospitalApi.updateJob(jobId, data);
      if (response.success) {
        await fetchJobs();
        return { success: true, job: response.data?.job };
      }
      return { success: false, error: 'Failed to update job' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update job';
      return { success: false, error: message };
    }
  }, [fetchJobs]);

  return {
    jobs,
    isLoading,
    loading: isLoading,
    error,
    stats,
    refresh: fetchJobs,
    refetch: fetchJobs,
    closeJob,
    deleteJob,
    restoreJob,
    deleteJobPermanently,
    updateJob,
  };
}

// Hook for job applications (hospital side)
// Backend application statuses: applied, under_review, shortlisted, interview_scheduled, interviewed, offer_made, hired, rejected
export type ApplicationStatus =
  | 'applied'
  | 'under_review'
  | 'shortlisted'
  | 'interview_scheduled'
  | 'interviewed'
  | 'offer_made'
  | 'hired'
  | 'rejected';

export interface JobApplication {
  id: string;
  doctorId: string;
  doctor: {
    id: string;
    fullName: string;
    avatar?: string;
    specialization?: string;
    experience?: string;
    location?: string;
    rating?: number;
    skills?: string[];
  };
  status: ApplicationStatus;
  appliedAt: string;
  coverLetter?: string;
  interview?: {
    scheduledAt: string;
    type: string;
    location?: string;
    meetingLink?: string;
    notes?: string;
  };
}

function transformJobApplication(app: any): JobApplication {
  return {
    id: app._id || app.id,
    doctorId: app.doctor?._id || app.doctorId,
    doctor: {
      id: app.doctor?._id || app.doctor?.id || '',
      fullName: app.doctor?.fullName || 'Doctor',
      avatar: app.doctor?.avatar || app.doctor?.avatarUrl,
      specialization: app.doctor?.doctorProfile?.specialization || app.doctor?.specialization,
      experience: (app.doctor?.doctorProfile?.yearsOfExperience || app.doctor?.experienceYears)
        ? `${app.doctor?.doctorProfile?.yearsOfExperience || app.doctor?.experienceYears}+ Years`
        : undefined,
      location: app.doctor?.doctorProfile?.address?.city || app.doctor?.address?.city || app.doctor?.location,
      rating: app.doctor?.doctorProfile?.platformStats?.rating || app.doctor?.rating,
      skills: (app.doctor?.doctorProfile?.skills || app.doctor?.skills)?.map((s: any) => typeof s === 'string' ? s : s.name),
    },
    status: app.status,
    appliedAt: app.appliedAt || app.createdAt,
    coverLetter: app.coverLetter,
    interview: app.interview,
  };
}

export function useJobApplications(jobId: string, status?: string) {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    if (!jobId) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await hospitalApi.getApplications(jobId, status);
      if (response.success && response.data) {
        // Handle multiple response formats (paginated array or applications property)
        let appsData: any[] = [];
        if (Array.isArray(response.data)) {
          appsData = response.data;
        } else if (Array.isArray(response.data.applications)) {
          appsData = response.data.applications;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          appsData = response.data.data;
        }
        setApplications(appsData.map(transformJobApplication));
      } else {
        setApplications([]);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to fetch applications';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [jobId, status]);


  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const updateStatus = useCallback(async (
    applicationId: string,
    newStatus:
      | 'under_review'
      | 'shortlisted'
      | 'interview_scheduled'
      | 'interviewed'
      | 'offer_made'
      | 'hired'
      | 'rejected',
    notes?: string
  ) => {
    try {
      const response = await hospitalApi.updateApplicationStatus(applicationId, newStatus, notes);
      if (response.success) {
        await fetchApplications();
        return { success: true };
      }
      return { success: false, error: 'Failed to update status' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update status';
      return { success: false, error: message };
    }
  }, [fetchApplications]);

  const scheduleInterview = useCallback(async (
    applicationId: string,
    interviewData: {
      scheduledAt: string;
      type: 'in_person' | 'video' | 'phone';
      location?: string;
      meetingLink?: string;
      notes?: string;
    }
  ) => {
    try {
      const response = await hospitalApi.scheduleInterview(applicationId, interviewData);
      if (response.success) {
        await fetchApplications();
        return { success: true };
      }
      return { success: false, error: 'Failed to schedule interview' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to schedule interview';
      return { success: false, error: message };
    }
  }, [fetchApplications]);

  const hire = useCallback(async (
    applicationId: string,
    assignmentData: {
      startDate: string;
      endDate: string;
      salary: number;
      notes?: string;
    }
  ) => {
    try {
      const response = await hospitalApi.hireApplicant(applicationId, assignmentData);
      if (response.success) {
        await fetchApplications();
        return { success: true };
      }
      return { success: false, error: 'Failed to hire' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to hire';
      return { success: false, error: message };
    }
  }, [fetchApplications]);

  return {
    applications,
    isLoading,
    error,
    refresh: fetchApplications,
    updateStatus,
    scheduleInterview,
    hire,
  };
}

// Hook for employees
export interface Employee {
  id: string;
  assignmentId: string;
  doctor: {
    id: string;
    fullName: string;
    avatar?: string;
    specialization?: string;
    email?: string;
    phone?: string;
  };
  job: {
    id: string;
    title: string;
  };
  startDate: string;
  endDate: string;
  salary: number;
  salaryType?: string;
  status: 'active' | 'completed' | 'terminated';
  jobType?: string;
  shift?: string;
  department?: string;
}

function formatPhone(phone: any, countryCode?: string): string | undefined {
  if (!phone) return undefined;
  // If phone is just a string/number
  if (typeof phone === 'string' || typeof phone === 'number') {
    const pStr = String(phone);
    if (!countryCode) return pStr;
    return `${countryCode} ${pStr}`;
  }
  // If phone is object
  if (typeof phone === 'object') {
    const code = (phone.countryCode || phone.code || '').toString().trim();
    const number = (phone.number || phone.phoneNumber || phone.value || '').toString().trim();
    const maskedNumber = (phone.maskedNumber || '').toString().trim();

    if (number) return code ? `${code} ${number}` : number;
    if (maskedNumber) return code ? `${code} ${maskedNumber}` : maskedNumber;
  }
  return undefined;
}

function transformEmployee(emp: any): Employee {
  // Backend `/hospital/employees` returns an array in `response.data`.
  // Depending on backend version, each item may be:
  // - an assignment-shaped object with nested `doctor`/`job`, OR
  // - a lightweight card DTO with fields like `name`, `role`, `avatar`, `shift`, `ward`.
  const doctor = emp.doctor && typeof emp.doctor === 'object'
    ? emp.doctor
    : {
      _id: emp.doctorId,
      id: emp.doctorId,
      fullName: emp.name || emp.displayName || 'Doctor',
      avatar: emp.avatar,
      specialization: emp.role,
    };

  const job = emp.job && typeof emp.job === 'object'
    ? emp.job
    : {
      _id: emp.jobId,
      id: emp.jobId,
      title: emp.jobTitle || emp.title || 'Job',
      department: emp.department || emp.ward,
    };

  return {
    id: emp._id || emp.assignmentId || emp.id,
    assignmentId: emp._id || emp.assignmentId || emp.id,
    doctor: {
      id: doctor?._id || doctor?.id || '',
      fullName: doctor?.fullName || emp.name || 'Doctor',
      avatar: doctor?.avatar,
      specialization: doctor?.doctorProfile?.specialization || doctor?.specialization || emp.role,
      email: doctor?.email,
      phone: formatPhone(doctor?.phoneNumber, doctor?.phoneCountryCode) || formatPhone(doctor?.phone),
    },
    job: {
      id: job?._id || job?.id || '',
      title: job?.title || emp.jobTitle || 'Job',
    },
    startDate: emp.startDate,
    endDate: emp.endDate,
    salary: emp.compensation?.amount || emp.salary,
    salaryType: emp.compensation?.type || 'monthly',
    status: (emp.statusRaw || emp.status) as any,
    jobType: job?.jobType || emp.jobType || (emp.schedule?.shiftType === 'day' ? 'Full-Time' : 'Shift-Based'),
    shift: emp.schedule?.shiftStart && emp.schedule?.shiftEnd
      ? `${emp.schedule.shiftStart} - ${emp.schedule.shiftEnd}`
      : (emp.shift || 'Regular Shift'),
    department: emp.department || job?.department || emp.ward || 'General',
  };
}

export function useEmployees(status?: string) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await hospitalApi.getEmployees(status);
      const items = Array.isArray(response.data)
        ? response.data
        : Array.isArray((response.data as any)?.employees)
          ? (response.data as any).employees
          : Array.isArray((response.data as any)?.items)
            ? (response.data as any).items
            : [];

      if (response.success) {
        const mapped = items.map(transformEmployee);
        const unique = new Map<string, Employee>();
        for (const emp of mapped) {
          const key = emp.assignmentId || emp.id;
          if (!key) continue;
          if (!unique.has(key)) unique.set(key, emp);
        }

        setEmployees(Array.from(unique.values()));
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to fetch employees';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const terminate = useCallback(async (assignmentId: string, reason: string) => {
    try {
      const response = await hospitalApi.terminateEmployee(assignmentId, reason);
      if (response.success) {
        await fetchEmployees();
        return { success: true };
      }
      return { success: false, error: 'Failed to terminate' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to terminate';
      return { success: false, error: message };
    }
  }, [fetchEmployees]);

  const updateEmployee = useCallback(async (assignmentId: string, data: any) => {
    try {
      const response = await hospitalApi.updateEmployee(assignmentId, data);
      if (response.success) {
        await fetchEmployees();
        return { success: true };
      }
      return { success: false, error: 'Failed to update employee' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update employee';
      return { success: false, error: message };
    }
  }, [fetchEmployees]);

  const updateStatus = useCallback(async (
    assignmentId: string,
    nextStatus: 'active' | 'paused' | 'on_leave' | 'completed' | 'terminated',
    reason?: string
  ) => {
    try {
      const response = await hospitalApi.updateEmployeeStatus(assignmentId, nextStatus, reason);
      if (response.success) {
        await fetchEmployees();
        return { success: true };
      }
      return { success: false, error: 'Failed to update status' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update status';
      return { success: false, error: message };
    }
  }, [fetchEmployees]);

  return {
    employees,
    isLoading,
    loading: isLoading,
    error,
    refresh: fetchEmployees,
    refetch: fetchEmployees,
    terminate,
    updateEmployee,
    updateStatus,
  };
}

// Hook for hospital leave requests
export interface HospitalLeaveRequest {
  id: string;
  doctorName: string;
  doctorAvatar?: string;
  doctorRole: string;
  jobTitle: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  leaveType: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string;
}

export function useHospitalLeaveRequests(status?: string, assignmentId?: string) {
  const [requests, setRequests] = useState<HospitalLeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await hospitalApi.getLeaveRequests({ status, assignmentId });
      if (response.success && response.data) {
        const items = Array.isArray(response.data) ? response.data : [];
        setRequests(items.map((item: any) => ({
          id: item.id || item._id,
          doctorName: item.doctor?.fullName || 'Doctor',
          doctorAvatar: item.doctor?.avatar,
          doctorRole: item.doctor?.specialization || 'Specialist',
          jobTitle: item.assignment?.job?.title || 'Job',
          startDate: item.startDate,
          endDate: item.endDate,
          totalDays: item.totalDays,
          leaveType: item.leaveType,
          reason: item.reason,
          status: item.status,
          appliedAt: item.createdAt,
        })));
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to fetch leave requests';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [status, assignmentId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const processRequest = useCallback(async (id: string, action: 'approve' | 'reject', notes?: string) => {
    try {
      const response = await hospitalApi.handleLeaveRequest(id, action, notes);
      if (response.success) {
        await fetchRequests();
        return { success: true };
      }
      return { success: false, error: 'Failed to process request' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to process request';
      return { success: false, error: message };
    }
  }, [fetchRequests]);

  return {
    requests,
    isLoading,
    error,
    refresh: fetchRequests,
    processRequest,
  };
}

// Hook for employee attendance (hospital-side)
export interface AttendanceRecord {
  id: string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  status: 'present' | 'absent' | 'late' | 'half_day';
  duration?: number;
  notes?: string;
}

export interface TodayAttendanceStatus {
  status: 'not_marked' | 'checked_in' | 'checked_out' | 'absent' | 'present';
  attendance: {
    id: string;
    checkInTime?: string;
    checkOutTime?: string;
    status: string;
  } | null;
  employee: {
    id: string;
    doctorName: string;
    avatar?: string;
    role?: string;
    shift?: string;
  };
}

export function useEmployeeAttendance(assignmentId?: string) {
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [todayStatus, setTodayStatus] = useState<TodayAttendanceStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (page: number = 1) => {
    if (!assignmentId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await hospitalApi.getEmployeeAttendance(assignmentId, page);
      if (response.success && response.data) {
        const items = Array.isArray(response.data) ? response.data : [];
        setHistory(items.map((item: any) => ({
          id: item.id || item._id,
          date: item.date,
          checkInTime: item.checkInTime,
          checkOutTime: item.checkOutTime,
          status: item.status,
          duration: item.duration,
          notes: item.notes,
        })));
      }
    } catch (err) {
      setError('Failed to fetch attendance history');
    } finally {
      setIsLoading(false);
    }
  }, [assignmentId]);

  const fetchTodayStatus = useCallback(async () => {
    if (!assignmentId) return;
    try {
      const response = await hospitalApi.getEmployeeTodayStatus(assignmentId);
      if (response.success && response.data) {
        setTodayStatus(response.data as TodayAttendanceStatus);
      }
    } catch (err) {
      console.error('Failed to fetch today status:', err);
    }
  }, [assignmentId]);

  useEffect(() => {
    if (assignmentId) {
      fetchHistory();
      fetchTodayStatus();
    }
  }, [assignmentId, fetchHistory, fetchTodayStatus]);

  return {
    history,
    todayStatus,
    isLoading,
    error,
    refresh: fetchHistory,
    refreshTodayStatus: fetchTodayStatus,
  };
}

// Hook for marking attendance (hospital-side)
export function useMarkAttendance() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markAttendance = useCallback(async (
    assignmentId: string,
    status: 'present' | 'checked_in' | 'checked_out' | 'absent' | 'half_day',
    notes?: string
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await hospitalApi.markEmployeeAttendance(assignmentId, { status, notes });
      if (response.success) {
        return { success: true, data: response.data };
      }
      return { success: false, error: 'Failed to mark attendance' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to mark attendance';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    markAttendance,
    isLoading,
    error,
  };
}

// Hook for posting a job
export function usePostJob() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const postJob = useCallback(async (jobData: {
    title: string;
    description: string;
    specialization: string;
    department?: string;
    jobType: 'full_time' | 'part_time' | 'contract' | 'locum_tenens' | 'per_diem' | string;
    duration: {
      startDate: string;
      endDate?: string;
      isOngoing?: boolean;
    };
    shift: {
      startTime: string;
      endTime: string;
      shiftType?: 'day' | 'night' | 'rotating' | 'flexible' | string;
      breakDuration?: number;
    };
    location?: {
      address?: string;
      city?: string;
      state?: string;
      pincode?: string;
      coordinates?: { type: 'Point'; coordinates: [number, number] };
    };
    compensation: {
      type: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'per_patient' | string;
      amount: number;
      currency?: string;
      isNegotiable?: boolean;
      minAmount?: number;
      maxAmount?: number;
    };
    facilities?: {
      meals?: boolean;
      transport?: boolean;
      accommodation?: boolean;
      insurance?: boolean;
    };
    requirements: {
      minimumExperience: number;
      qualifications?: string[];
      skills?: string[];
      certifications?: string[];
    };
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await hospitalApi.postJob(jobData);
      if (response.success) {
        return { success: true, job: response.data?.job };
      }
      return { success: false, error: 'Failed to post job' };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to post job';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    postJob,
    isLoading,
    error,
  };
}

// Hook for fetching a single job with applications (hospital view)
export interface HospitalJobDetails {
  id: string;
  title: string;
  description: string;
  specialization: string;
  location: string;
  status: string;
  views: number;
  applicants: number;
  salary: string;
  dates: string;
  shiftTime: string;
  shiftType: string;
  qualifications: string[];
  skills: string[];
  experience: string;
  facilities: {
    meals: boolean;
    transport: boolean;
    stay: boolean;
    accommodation?: boolean;
    insurance: boolean;
  };
  requirements?: {
    minimumExperience?: number;
    qualifications?: string[];
    skills?: string[];
  };
  applicationStats: {
    [key: string]: number;
  };
}

function transformHospitalJobDetails(job: any, stats: any): HospitalJobDetails {
  // Graceful stats handling
  const appStats = job.applicationStats || stats || {};

  // Safe helper for skills
  const safeSkills = (job.skills || job.requirements?.skills || []).map((s: any) => {
    if (!s) return 'Unknown Skill';
    return typeof s === 'string' ? s : (s.name || 'Unknown Skill');
  });

  // Extract qualifications safely
  const qualifications = job.qualifications || job.requirements?.qualifications || [];

  // minimumExperience check
  const minimumExperience = job.minimumExperience ?? job.requirements?.minimumExperience ?? 0;

  return {
    id: job._id || job.id || '',
    title: job.title || 'Job Title',
    description: job.description || '',
    specialization: job.specialization || 'General',
    location: job.location?.city || job.fullLocation?.city || 'Unknown',
    status: job.status || 'open',
    views: job.views || job.stats?.views || 0,
    applicants: job.applicants || job.stats?.applications || job.applicationCount || 0,
    salary: job.salary || job.compensation?.display ||
      (job.compensation?.amount ? `₹${job.compensation.amount.toLocaleString('en-IN')}/${job.compensation.type || 'month'}` : 'Negotiable'),
    dates: (() => {
      // Use logic consistent with JobPostedCard
      const duration = job.duration || {};
      const startDate = duration.startDate || job.startDate;
      const endDate = duration.endDate || job.endDate;

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
      return job.dates || 'Flexible';
    })(),
    shiftTime: job.shiftTime || (job.shift?.startTime && job.shift?.endTime
      ? `${job.shift.startTime} - ${job.shift.endTime}`
      : 'Not specified'),
    shiftType: job.shiftType || job.shift?.type || 'Day Shift',
    qualifications: Array.isArray(qualifications) ? qualifications : [],
    skills: safeSkills,
    experience: String(minimumExperience > 0 ? `${minimumExperience} Years` : '0 Years'),
    facilities: {
      meals: !!(job.facilities?.meals === true || job.facilities?.meals === 'Yes' || job.facilities?.includes?.('meals')),
      transport: !!(job.facilities?.transport === true || job.facilities?.transport === 'Yes' || job.facilities?.includes?.('transportation') || job.facilities?.includes?.('transport')),
      stay: !!(job.facilities?.accommodation === true || job.facilities?.stay === true || job.facilities?.stay === 'Yes' || job.facilities?.includes?.('accommodation') || job.facilities?.includes?.('stay')),
      accommodation: !!(job.facilities?.accommodation === true || job.facilities?.stay === true || job.facilities?.stay === 'Yes' || job.facilities?.includes?.('accommodation') || job.facilities?.includes?.('stay')),
      insurance: !!(job.facilities?.insurance === true || job.facilities?.insurance === 'Yes' || job.facilities?.includes?.('insurance')),
    },
    requirements: job.requirements,
    applicationStats: appStats,
  };
}

export function useHospitalJobDetails(jobId: string) {
  const [job, setJob] = useState<HospitalJobDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJob = useCallback(async () => {
    if (!jobId) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await hospitalApi.getJobWithApplications(jobId);
      if (response.success && response.data?.job) {
        setJob(transformHospitalJobDetails(response.data.job, response.data.applicationStats));
      } else {
        // Fallback if success is true but data missing (rare)
        setError('Job data not found');
      }
    } catch (err: any) {
      const message = err instanceof ApiError ? err.message : (err.message || 'Failed to fetch job details');
      setError(message);
      console.error('Job details fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  return { job, isLoading, error, refresh: fetchJob };
}

// Hook for candidate details (hospital side)
export interface CandidateDetails {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  overview: string;
  education: {
    institution: string;
    program: string;
    years: string;
  }[];
  licenses: {
    name: string;
    authority: string;
  }[];
  skills: string[];
  offPlatformExperiences: {
    role: string;
    department: string;
    institution: string;
    duration: string;
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
    documents: {
      id: string;
      title: string;
      meta: string;
      url?: string;
      fileType?: string;
    }[];
  }[];
  onPlatform: {
    jobsCompleted: number;
    jobsCompletedDeltaLabel: string;
    attendanceRate: number;
    attendanceLabel: string;
    recentActivity: {
      id: string;
      title: string;
      subtitle: string;
      when: string;
    }[];
  };
  invitationStatus?: 'pending' | 'accepted' | 'declined';
  conversationId?: string;
  hasInvited?: boolean; // deprecated but kept for compatibility temporarily
}

function transformCandidateDetails(doctor: any): CandidateDetails {
  // Transform backend doctor data to CandidateDetails
  const education = (doctor.education || []).map((e: any) => ({
    institution: e.institution || 'Unknown Institution',
    program: e.degree || e.program || 'Medical Degree',
    years: e.startYear && e.endYear ? `${e.startYear} - ${e.endYear}` : e.year || 'N/A',
  }));

  // Extract licenses with authority (issuing body)
  const licenses = (doctor.licenses || []).map((l: any) => {
    if (typeof l === 'string') {
      return { name: l, authority: '' };
    }
    return {
      name: l.name || l.number || l.registrationNumber || 'License',
      authority: l.issuingBody || l.authority || l.issuingAuthority || l.council || '',
    };
  });

  const skills = (doctor.skills || []).map((s: any) =>
    typeof s === 'string' ? s : (s.name || 'Skill')
  );

  // Transform all experiences
  const offPlatformExperiences = (doctor.workExperience || doctor.experience || []).map((exp: any, idx: number) => {
    const formatDate = (date?: string) => {
      if (!date) return undefined;
      const d = new Date(date);
      if (isNaN(d.getTime())) return undefined;
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    };

    const startFormatted = formatDate(exp.startDate);
    const endFormatted = exp.isCurrent ? 'Present' : formatDate(exp.endDate);
    const duration = startFormatted && endFormatted
      ? `${startFormatted} – ${endFormatted}`
      : exp.duration || `${doctor.yearsOfExperience || 0}+ years`;

    // Get documents from experience or from root-level documents
    const expDocs = exp.documents || [];
    const documents = expDocs.map((d: any, i: number) => ({
      id: d._id || d.id || `doc-${idx}-${i}`,
      title: d.title || d.name || d.fileName || d.type || 'Document',
      meta: [
        d.fileSize ? `${(d.fileSize / 1024).toFixed(1)} KB` : null,
        d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString() : null,
      ].filter(Boolean).join(' • ') || 'PDF',
      url: d.url || d.fileUrl || undefined,
      fileType: d.fileType || d.mimeType || (d.url?.endsWith('.pdf') ? 'pdf' : 'document'),
    }));

    return {
      role: exp.role || exp.position || exp.designation || doctor.specialization || 'Healthcare Professional',
      department: exp.department || 'Medical',
      institution: exp.institution || exp.hospital || exp.hospitalName || 'Previous Hospital',
      duration,
      startDate: exp.startDate,
      endDate: exp.endDate,
      isCurrent: exp.isCurrent || false,
      documents,
    };
  });

  // Use user.id (User table PK) for messaging; fall back to doctor.id for legacy data
  const userId = doctor.user?.id || doctor.userId || doctor._id || doctor.id;

  // Calculate attendance label based on rate
  const attendanceRate = doctor.platformStats?.attendanceRate ?? doctor.stats?.attendanceRate ?? 0;
  const attendanceLabel = attendanceRate >= 95 ? 'Excellent'
    : attendanceRate >= 85 ? 'Good'
      : attendanceRate >= 70 ? 'Average'
        : 'Needs Improvement';

  // Calculate delta label for jobs completed
  const jobsCompleted = doctor.platformStats?.jobsCompleted ?? doctor.stats?.completedJobs ?? 0;
  const prevMonthJobs = doctor.platformStats?.prevMonthJobsCompleted || 0;
  const deltaPercent = prevMonthJobs > 0 ? Math.round(((jobsCompleted - prevMonthJobs) / prevMonthJobs) * 100) : 0;
  const deltaLabel = deltaPercent > 0 ? `+${deltaPercent}% this month`
    : deltaPercent < 0 ? `${deltaPercent}% this month`
      : '';

  return {
    id: userId,
    name: `Dr. ${doctor.user?.fullName || doctor.fullName || 'Unknown'}`,
    avatar: doctor.user?.avatarUrl || doctor.avatar || doctor.avatarUrl,
    role: doctor.specialization || 'Medical Professional',
    overview: doctor.bio || doctor.about || 'No overview available.',
    education,
    licenses,
    skills,
    offPlatformExperiences,
    onPlatform: {
      jobsCompleted,
      jobsCompletedDeltaLabel: deltaLabel,
      attendanceRate,
      attendanceLabel,
      recentActivity: (doctor.platformStats?.recentActivity || []).map((a: any, i: number) => ({
        id: a._id || `activity-${i}`,
        title: a.title || a.jobTitle || 'Completed Job',
        subtitle: a.hospital || a.hospitalName || a.description || 'Healthcare assignment',
        when: a.date ? new Date(a.date).toLocaleDateString() : 'Recently',
      })),
    },
    hasInvited: doctor.hasInvited,
    invitationStatus: doctor.invitationStatus,
    conversationId: doctor.conversationId,
  };
}

export function useCandidateDetails(candidateId: string) {
  const [candidate, setCandidate] = useState<CandidateDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCandidate = useCallback(async () => {
    if (!candidateId) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await hospitalApi.getCandidateDetails(candidateId);
      if (response.success && response.data?.candidate) {
        setCandidate(transformCandidateDetails(response.data.candidate));
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to fetch candidate details';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    fetchCandidate();
  }, [fetchCandidate]);

  return { candidate, isLoading, error, refresh: fetchCandidate };
}

// Hook for searching doctors (for hospital to find candidates)
export interface SearchedDoctor {
  id: string;
  name: string;
  role: string;
  location: string;
  experienceYears: number;
  rating: number;
  avatarUri?: string | null;
  isAvailable: boolean;
  invitationStatus?: 'pending' | 'accepted' | 'declined';
  conversationId?: string;
}

interface UseSearchDoctorsOptions {
  q?: string;
  specialization?: string;
  city?: string;
  state?: string;
  minExperience?: number;
  maxExperience?: number;
  isAvailable?: boolean;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
}

export function useSearchDoctors(options: UseSearchDoctorsOptions = {}) {
  const [doctors, setDoctors] = useState<SearchedDoctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(options.page || 1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Track previous query parameters to detect changes (Requirement 11.4)
  const prevQueryRef = useRef<string>('');
  
  // API call optimization (Requirements 12.1, 12.2, 12.3, 12.4, 12.5)
  const apiOptimization = useApiOptimization<UseSearchDoctorsOptions>();

  const fetchDoctors = useCallback(async (page: number = 1, append: boolean = false) => {
    const params = {
      q: options.q,
      page,
      limit: options.limit || 10,
      specialization: options.specialization,
      city: options.city,
      state: options.state,
      minExperience: options.minExperience,
      maxExperience: options.maxExperience,
      isAvailable: options.isAvailable,
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
      
      const response = await hospitalApi.searchCandidates(params);

      if (response.success && response.data) {
        const items = Array.isArray(response.data)
          ? response.data
          : Array.isArray((response.data as any)?.doctors)
            ? (response.data as any).doctors
            : [];

        const transformedDoctors: SearchedDoctor[] = items.map((doc: any) => ({
          id: doc.id || doc._id,
          name: doc.displayName || doc.name || 'Unknown Doctor',
          role: doc.specialization || 'Doctor',
          location: doc.address?.city || doc.location?.city || 'Unknown',
          experienceYears: Number(doc.experienceYears ?? doc.yearsOfExperience ?? 0),
          rating: Number(doc.rating ?? 0),
          avatarUri: doc.avatar ?? null,
          isAvailable: Boolean(doc.isAvailable ?? true),
          invitationStatus: doc.invitationStatus,
          conversationId: doc.conversationId,
        }));

        // When not appending (new search/filter), clear previous results
        // When appending (load more), add to existing results
        setDoctors((prev) => (append ? [...prev, ...transformedDoctors] : transformedDoctors));

        const pagination = response.meta;
        setTotalCount(pagination?.totalItems ?? transformedDoctors.length);
        setCurrentPage(pagination?.page ?? page);
        setTotalPages(pagination?.totalPages ?? 1);
      }
    } catch (err) {
      // Don't set error if request was aborted (cancelled)
      // Aborted requests are expected when parameters change
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const message = err instanceof ApiError ? err.message : 'Failed to search doctors';
      setError(message);
    } finally {
      setIsLoading(false);
      apiOptimization.completeRequest();
    }
  }, [options.q, options.specialization, options.city, options.state, options.minExperience, options.maxExperience, options.isAvailable, options.sortBy, options.sortOrder, options.limit, apiOptimization]);

  useEffect(() => {
    // Create a query signature to detect parameter changes (Requirement 11.1, 11.2)
    // We stringify the parameters to create a unique signature for comparison
    const currentQuery = JSON.stringify({
      q: options.q,
      specialization: options.specialization,
      city: options.city,
      state: options.state,
      minExperience: options.minExperience,
      maxExperience: options.maxExperience,
      isAvailable: options.isAvailable,
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
      setDoctors([]);        // Clear previous results
      setCurrentPage(1);     // Reset to page 1
      // Cancel pending requests when input changes (Requirement 9.3)
      apiOptimization.cancelPendingRequest();
    }
    
    // Update the previous query reference for next comparison
    prevQueryRef.current = currentQuery;
    
    // Fetch results - always start from page 1 when query changes
    fetchDoctors(1);
  }, [fetchDoctors, apiOptimization]);

  const refresh = useCallback(async () => {
    await fetchDoctors(1);
  }, [fetchDoctors]);

  const loadMore = useCallback(async () => {
    // Only load more if query hasn't changed (Requirement 11.4)
    if (currentPage < totalPages && !isLoading) {
      await fetchDoctors(currentPage + 1, true);
    }
  }, [currentPage, totalPages, isLoading, fetchDoctors]);

  return {
    doctors,
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

// Hook for dashboard stats
export interface DashboardStats {
  totalJobsPosted: number;
  activeJobs: number;
  totalApplications: number;
  pendingApplications: number;
  totalHires: number;
  activeEmployees: number;
  latestApplication?: {
    id: string;
    jobId: string;
    doctorId: string;
    jobTitle: string;
    doctorName: string;
    appliedAt: Date;
  };
}

export function useHospitalDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await hospitalApi.getDashboard();
      if (response.success && response.data) {
        setStats(response.data as DashboardStats);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to fetch dashboard stats';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    stats,
    isLoading,
    error,
    refresh: fetchDashboard,
  };
}
