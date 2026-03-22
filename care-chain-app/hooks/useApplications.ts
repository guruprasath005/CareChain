import { useState, useEffect, useCallback } from 'react';
import { doctorApi, ApiError } from '../services/api';
import type { MyScheduleData, TodayTimingData, UpcomingScheduleItem } from '../data/activeJobs';

export interface Application {
  id: string;
  _id?: string;
  jobId: string;
  job: {
    id: string;
    title: string;
    hospital: string;
    location: string;
    experience: string;
    salary: string;
    avatar?: string | null;
  };
  status:
  | 'applied'
  | 'under_review'
  | 'shortlisted'
  | 'interview_scheduled'
  | 'interviewed'
  | 'offer_made'
  | 'hired'
  | 'rejected'
  | 'withdrawn';
  statusLabel?: string;
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

// Transform backend application to frontend format
function transformApplication(backendApp: any): Application {
  const status: Application['status'] = backendApp.status || 'applied';
  const statusLabel: string | undefined = backendApp.statusLabel;

  const jobNode = backendApp.job || {};
  const hospitalNode = backendApp.hospital || {};

  return {
    id: backendApp._id || backendApp.id,
    _id: backendApp._id,
    jobId: jobNode?._id || jobNode?.id || backendApp.jobId,
    job: {
      id: jobNode?._id || jobNode?.id || backendApp.jobId,
      title: jobNode?.title || 'Job Title',
      hospital: hospitalNode?.name || hospitalNode?.hospitalName || 'Hospital',
      location: jobNode?.location?.city || 'Location',
      experience: jobNode?.experience || '0 Years',
      salary: jobNode?.salary || 'Negotiable',
      avatar: hospitalNode?.logo || hospitalNode?.avatar || null,
    },
    status,
    statusLabel,
    appliedAt: backendApp.appliedAt || backendApp.createdAt,
    coverLetter: backendApp.coverLetter,
    interview: backendApp.interview,
  };
}

export function useApplications(filterStatus?: string) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ [key: string]: number }>({});

  const fetchApplications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await doctorApi.getApplications(filterStatus);
      if (response.success && response.data) {
        // Backend may return:
        // - ApiResponse.success({ applications: [...] })
        // - ApiResponse.paginated([...]) where data is an array
        // - ApiResponse.success({ items: [...] })
        let rawApps: any[] = [];
        if (Array.isArray(response.data)) {
          rawApps = response.data;
        } else if (Array.isArray((response.data as any).applications)) {
          rawApps = (response.data as any).applications;
        } else if (Array.isArray((response.data as any).items)) {
          rawApps = (response.data as any).items;
        }

        const apps = rawApps.map(transformApplication);
        setApplications(apps);

        // Calculate stable category counts (used across doctor UI)
        const categoryCounts: { [key: string]: number } = {
          Applied: 0,
          Shortlisted: 0,
          Interview: 0,
          Offers: 0,
          Hired: 0,
          Rejected: 0,
          Withdrawn: 0,
        };

        apps.forEach((app: Application) => {
          switch (app.status) {
            case 'applied':
            case 'under_review':
              categoryCounts.Applied += 1;
              break;
            case 'shortlisted':
              categoryCounts.Shortlisted += 1;
              break;
            case 'interview_scheduled':
            case 'interviewed':
              categoryCounts.Interview += 1;
              break;
            case 'offer_made':
            case 'hired':
              categoryCounts.Offers += 1;
              break;
            case 'rejected':
              categoryCounts.Rejected += 1;
              break;
            case 'withdrawn':
              categoryCounts.Withdrawn += 1;
              break;
          }
        });

        setCounts(categoryCounts);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to fetch applications';

      // Handle rate limiting specifically
      if (err instanceof ApiError && err.message?.toLowerCase().includes('too many')) {
        setError('Too many requests. Please wait a moment and try again.');
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  return {
    applications,
    isLoading,
    error,
    counts,
    refresh: fetchApplications,
  };
}

// Hook for active jobs (assigned jobs)
export interface ActiveJob {
  id: string;
  assignmentCode?: string;
  title: string;
  hospital: string;
  hospitalId?: string;
  location?: string;
  jobType?: string | null;
  timeRange?: string | null;
  status: 'active' | 'paused' | 'on_leave' | 'completed' | 'terminated';
  onCallStatus?: {
    isOnCall: boolean;
  };
  reportingTo?: {
    name?: string;
    designation?: string;
  };
  leaveBalance?: {
    total: number;
    used: number;
  };
}

function transformActiveJob(backendJob: any): ActiveJob {
  const schedule = backendJob.schedule || {};
  const entries = Array.isArray(schedule)
    ? schedule
    : Array.isArray(schedule.entries)
      ? schedule.entries
      : [];

  const todayStr = new Date().toISOString().split('T')[0];
  const todayEntry = entries.find((entry: any) => entry.date === todayStr);
  const entryTimeRange = todayEntry
    ? (todayEntry.isWorkDay ? `${todayEntry.startTime} - ${todayEntry.endTime}` : 'Day Off')
    : null;

  const rawShiftType: string | undefined =
    (typeof schedule?.shiftType === 'string' ? schedule.shiftType : undefined) ||
    (typeof backendJob?.job?.shift?.shiftType === 'string' ? backendJob.job.shift.shiftType : undefined);

  const normalizeShiftType = (value?: string | null) => {
    if (!value) return null;
    const lower = value.toLowerCase();
    if (lower === 'day') return 'Day Shift';
    if (lower === 'night') return 'Night Shift';
    if (lower === 'rotational') return 'Rotational Shift';
    if (lower === 'flexible') return 'Flexible Shift';
    // Convert snake_case to Title Case
    const cleaned = value.replace(/_/g, ' ');
    return cleaned
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const reportingTo = (backendJob?.reportingTo && typeof backendJob.reportingTo === 'object')
    ? backendJob.reportingTo
    : undefined;

  const reportingToName =
    (typeof reportingTo?.name === 'string' && reportingTo.name.trim() ? reportingTo.name.trim() : undefined) ||
    (typeof backendJob?.assignmentHospital?.fullName === 'string' && backendJob.assignmentHospital.fullName.trim()
      ? backendJob.assignmentHospital.fullName.trim()
      : undefined);

  return {
    id: backendJob._id || backendJob.id,
    assignmentCode: backendJob.assignmentCode,
    title: backendJob.title || 'Job Title',
    hospital: backendJob.assignmentHospital?.hospitalProfile?.hospitalName || backendJob.assignmentHospital?.fullName || backendJob.hospital?.hospitalName || backendJob.hospital || 'Hospital',
    hospitalId: backendJob.hospitalId || backendJob.hospital?._id || backendJob.hospital,
    location: (typeof backendJob.job?.location === 'object' ?
      [backendJob.job.location.street, backendJob.job.location.city].filter(Boolean).join(', ') :
      backendJob.job?.location) ||
      [backendJob.assignmentHospital?.hospitalProfile?.address?.street, backendJob.assignmentHospital?.hospitalProfile?.address?.city].filter(Boolean).join(', ') ||
      'Main Branch',
    // NOTE: Used across Doctor Active Job screens as the *shift type* label.
    jobType: normalizeShiftType(rawShiftType),
    timeRange: entryTimeRange ||
      (schedule?.shiftStart && schedule?.shiftEnd ? `${schedule.shiftStart} - ${schedule.shiftEnd}` : null) ||
      (backendJob.timeRange || null),
    status: backendJob.status || 'active',
    onCallStatus: backendJob.onCallStatus || { isOnCall: false },
    reportingTo: reportingToName ? { name: reportingToName, designation: reportingTo?.designation } : reportingTo,
    leaveBalance: backendJob.leaveBalance ? {
      total: backendJob.leaveBalance.annual?.total || 0,
      used: backendJob.leaveBalance.annual?.used || 0
    } : undefined
  };
}

export function useActiveJobs() {
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveJobs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await doctorApi.getActiveJobs();
      if (response.success && response.data) {
        // Handle both activeJobs and assignments response keys for backward compatibility
        const jobsData = response.data.activeJobs || response.data.assignments || [];
        const jobs: ActiveJob[] = jobsData.map(transformActiveJob);

        setActiveJobs(jobs);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to fetch active jobs';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveJobs();
  }, [fetchActiveJobs]);

  return {
    activeJobs,
    jobs: activeJobs, // Alias for backward compatibility
    isLoading,
    loading: isLoading, // Alias for backward compatibility
    error,
    refresh: fetchActiveJobs,
    refetch: fetchActiveJobs, // Alias for backward compatibility
  };
}

// Hook for schedule
export interface ScheduleItem {
  id: string;
  date: string;
  job: {
    id: string;
    title: string;
    hospital: string;
  };
  startTime: string;
  endTime: string;
  status: string;
  checkIn?: string;
  checkOut?: string;
}


// Helper to parse time string (HH:mm)
function parseTime(timeStr?: string) {
  if (!timeStr) return { time: '--:--', meridiem: '--' };
  const [hours, minutes] = timeStr.split(':').map(Number);
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return {
    time: `${displayHours}:${minutes.toString().padStart(2, '0')}`,
    meridiem
  };
}


function transformScheduleData(backendData: any): MyScheduleData {
  const { assignment, schedule = [], attendance = [] } = backendData;
  const now = new Date();

  // Doctor & Hospital Info
  const doctorName = assignment.doctor?.fullName || 'Doctor';
  const doctorRole = assignment.job?.title || 'Specialist';
  const clinicName = assignment.assignmentHospital?.hospitalProfile?.hospitalName || assignment.assignmentHospital?.fullName || 'Hospital';
  const location = (typeof assignment.job?.location === 'object' ?
    [assignment.job.location.street, assignment.job.location.city].filter(Boolean).join(', ') :
    assignment.job?.location) ||
    [assignment.assignmentHospital?.hospitalProfile?.address?.street, assignment.assignmentHospital?.hospitalProfile?.address?.city].filter(Boolean).join(', ') ||
    'Main Branch';
  const imageUri = assignment.assignmentHospital?.hospitalProfile?.logo || null;

  // Schedule Basics
  const scheduleEntries = Array.isArray(schedule)
    ? schedule
    : Array.isArray((schedule as any).entries)
      ? (schedule as any).entries
      : [];

  const todayStr = now.toISOString().split('T')[0];
  const todayEntry = scheduleEntries.find((entry: any) => entry.date === todayStr);
  let today: TodayTimingData | undefined;

  if (todayEntry?.isWorkDay) {
    const startObj = parseTime(todayEntry.startTime);
    const endObj = parseTime(todayEntry.endTime);
    today = {
      title: doctorRole,
      clinicName,
      location,
      imageUri,
      startTime: startObj.time,
      startMeridiem: startObj.meridiem,
      endTime: endObj.time,
      endMeridiem: endObj.meridiem,
      statusLabel: 'Active',
      shiftDurationLabel: 'Regular Shift'
    };
  }

  // Upcoming Schedule (Next 5 days)
  const upcoming: UpcomingScheduleItem[] = [];
  for (let i = 1; i <= 5; i++) {
    const nextDate = new Date(now);
    nextDate.setDate(now.getDate() + i);
    const dateStr = nextDate.toISOString().split('T')[0];
    const entry = scheduleEntries.find((item: any) => item.date === dateStr);
    const dName = nextDate.toLocaleDateString('en-US', { weekday: 'long' });

    if (entry && entry.isWorkDay) {
      const startObj = parseTime(entry.startTime);
      const endObj = parseTime(entry.endTime);
      upcoming.push({
        id: `sch-${i}`,
        dayShort: dName.substring(0, 3).toUpperCase(),
        dayNumber: nextDate.getDate().toString(),
        title: 'Scheduled Shift',
        subtitle: clinicName,
        startLabel: `${startObj.time} ${startObj.meridiem}`,
        endLabel: `${endObj.time} ${endObj.meridiem}`,
        isOff: false
      });
    } else if (entry && !entry.isWorkDay) {
      upcoming.push({
        id: `sch-${i}`,
        dayShort: dName.substring(0, 3).toUpperCase(),
        dayNumber: nextDate.getDate().toString(),
        title: 'No Shift Scheduled',
        subtitle: 'Enjoy your day off!!',
        isOff: true
      });
    } else {
      upcoming.push({
        id: `sch-${i}`,
        dayShort: dName.substring(0, 3).toUpperCase(),
        dayNumber: nextDate.getDate().toString(),
        title: 'No Schedule',
        subtitle: 'Enjoy your day off!!',
        isOff: true
      });
    }
  }

  return {
    id: assignment.id,
    doctorName,
    doctorRole,
    todayDateLabel: now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    today: today as any, // Cast to any to handle potential undefined matching legacy type
    upcoming
  };
}

export function useSchedule(assignmentId: string, startDate?: string, endDate?: string) {
  const [schedule, setSchedule] = useState<MyScheduleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = useCallback(async () => {
    if (!assignmentId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await doctorApi.getSchedule(assignmentId, startDate, endDate);
      if (response.success && response.data) {
        const finalSchedule = transformScheduleData(response.data);
        setSchedule(finalSchedule);
      } else {
        setSchedule(null);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to fetch schedule';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [assignmentId, startDate, endDate]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  return {
    schedule,
    isLoading,
    error,
    refresh: fetchSchedule,
  };
}
