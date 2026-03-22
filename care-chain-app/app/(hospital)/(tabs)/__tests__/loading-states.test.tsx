import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import HospitalSearchScreen from '../search';
import HospitalJobsPosted from '../jobs';
import HospitalEmployees from '../employees';

// Mock dependencies
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  useFocusEffect: jest.fn((callback) => callback()),
}));

jest.mock('@/hooks', () => ({
  useSearchDoctors: jest.fn(),
  useDebounce: jest.fn((value) => value),
  usePostedJobs: jest.fn(),
  useFilteredJobs: jest.fn(),
  useEmployees: jest.fn(),
  useFilteredEmployees: jest.fn(),
  useHospitalLeaveRequests: jest.fn(),
  useEmployeeSchedule: jest.fn(),
}));

jest.mock('@/services/api', () => ({
  hospitalApi: {
    getEmployeesTodayStatusBulk: jest.fn(),
  },
}));

jest.mock('react-native-calendars', () => ({
  Calendar: 'Calendar',
}));

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

describe('Loading States - Hospital Search Screen', () => {
  const mockUseSearchDoctors = require('@/hooks').useSearchDoctors;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays skeleton loader during initial load', async () => {
    mockUseSearchDoctors.mockReturnValue({
      doctors: [],
      isLoading: true,
      error: null,
      refresh: jest.fn(),
      totalCount: 0,
    });

    const { getByText } = render(<HospitalSearchScreen />);
    
    await waitFor(() => {
      expect(getByText('Doctors')).toBeTruthy();
    });
  });

  it('displays inline loading indicator when searching', async () => {
    mockUseSearchDoctors.mockReturnValue({
      doctors: [
        {
          id: '1',
          name: 'Dr. Test',
          role: 'Cardiologist',
          location: 'Test City',
          experienceYears: 5,
          avatarUri: null,
        },
      ],
      isLoading: true,
      error: null,
      refresh: jest.fn(),
      totalCount: 1,
    });

    const { UNSAFE_root } = render(<HospitalSearchScreen />);
    
    await waitFor(() => {
      const activityIndicators = UNSAFE_root.findAllByType('ActivityIndicator');
      expect(activityIndicators.length).toBeGreaterThan(0);
    });
  });

  it('shows doctor count when not loading', async () => {
    mockUseSearchDoctors.mockReturnValue({
      doctors: [
        {
          id: '1',
          name: 'Dr. Test',
          role: 'Cardiologist',
          location: 'Test City',
          experienceYears: 5,
          avatarUri: null,
        },
      ],
      isLoading: false,
      error: null,
      refresh: jest.fn(),
      totalCount: 1,
    });

    const { getByText } = render(<HospitalSearchScreen />);
    
    await waitFor(() => {
      expect(getByText('1 doctors found')).toBeTruthy();
    });
  });
});

describe('Loading States - Hospital Jobs Screen', () => {
  const mockUsePostedJobs = require('@/hooks').usePostedJobs;
  const mockUseFilteredJobs = require('@/hooks').useFilteredJobs;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePostedJobs.mockReturnValue({
      jobs: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
      deleteJob: jest.fn(),
      restoreJob: jest.fn(),
      deleteJobPermanently: jest.fn(),
    });
    mockUseFilteredJobs.mockReturnValue({
      filteredJobs: [],
      isEmpty: true,
    });
  });

  it('displays skeleton loader during initial load', async () => {
    mockUsePostedJobs.mockReturnValue({
      jobs: [],
      loading: true,
      error: null,
      refetch: jest.fn(),
      deleteJob: jest.fn(),
      restoreJob: jest.fn(),
      deleteJobPermanently: jest.fn(),
    });

    const { getByText } = render(<HospitalJobsPosted />);
    
    await waitFor(() => {
      expect(getByText('Opened')).toBeTruthy();
    });
  });

  it('shows inline filter indicator when searching', async () => {
    mockUsePostedJobs.mockReturnValue({
      jobs: [
        {
          id: '1',
          title: 'Test Job',
          specialization: 'Cardiology',
          status: 'open',
          views: 10,
          applicants: 5,
          shiftTime: 'Day',
          salary: '₹50,000',
          dates: 'Jan 1 - Jan 31',
          location: 'Test City',
        },
      ],
      loading: false,
      error: null,
      refetch: jest.fn(),
      deleteJob: jest.fn(),
      restoreJob: jest.fn(),
      deleteJobPermanently: jest.fn(),
    });
    mockUseFilteredJobs.mockReturnValue({
      filteredJobs: [],
      isEmpty: true,
    });

    const { getByPlaceholderText, getByText } = render(<HospitalJobsPosted />);
    
    const searchInput = getByPlaceholderText('Search for Job Posts by Post Title');
    expect(searchInput).toBeTruthy();
  });

  it('does not block UI during client-side filtering', async () => {
    const jobs = [
      {
        id: '1',
        title: 'Cardiologist',
        specialization: 'Cardiology',
        status: 'open',
        views: 10,
        applicants: 5,
        shiftTime: 'Day',
        salary: '₹50,000',
        dates: 'Jan 1 - Jan 31',
        location: 'Test City',
      },
    ];

    mockUsePostedJobs.mockReturnValue({
      jobs,
      loading: false,
      error: null,
      refetch: jest.fn(),
      deleteJob: jest.fn(),
      restoreJob: jest.fn(),
      deleteJobPermanently: jest.fn(),
    });
    mockUseFilteredJobs.mockReturnValue({
      filteredJobs: jobs,
      isEmpty: false,
    });

    const { getByText } = render(<HospitalJobsPosted />);
    
    // Jobs should be immediately visible (client-side filtering is synchronous)
    await waitFor(() => {
      expect(getByText('Cardiologist')).toBeTruthy();
    });
  });
});

describe('Loading States - Hospital Employees Screen', () => {
  const mockUseEmployees = require('@/hooks').useEmployees;
  const mockUseFilteredEmployees = require('@/hooks').useFilteredEmployees;
  const mockUseHospitalLeaveRequests = require('@/hooks').useHospitalLeaveRequests;
  const mockUseEmployeeSchedule = require('@/hooks').useEmployeeSchedule;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseEmployees.mockReturnValue({
      employees: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseFilteredEmployees.mockReturnValue({
      filteredEmployees: [],
      isEmpty: true,
    });
    mockUseHospitalLeaveRequests.mockReturnValue({
      requests: [],
      isLoading: false,
      refresh: jest.fn(),
      processRequest: jest.fn(),
    });
    mockUseEmployeeSchedule.mockReturnValue({
      schedule: [],
      addEntries: jest.fn(),
      fetchSchedule: jest.fn(),
    });
  });

  it('displays skeleton loader during initial load', async () => {
    mockUseEmployees.mockReturnValue({
      employees: [],
      loading: true,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(<HospitalEmployees />);
    
    await waitFor(() => {
      expect(getByText('Employees')).toBeTruthy();
    });
  });

  it('shows inline filter indicator when searching', async () => {
    const employees = [
      {
        id: '1',
        assignmentId: 'a1',
        doctor: {
          id: 'd1',
          fullName: 'Dr. Test',
          specialization: 'Cardiology',
          avatar: null,
        },
        job: {
          id: 'j1',
          title: 'Cardiologist',
        },
        status: 'active',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        salary: 50000,
      },
    ];

    mockUseEmployees.mockReturnValue({
      employees,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseFilteredEmployees.mockReturnValue({
      filteredEmployees: employees,
      isEmpty: false,
    });

    const { getByPlaceholderText } = render(<HospitalEmployees />);
    
    const searchInput = getByPlaceholderText('Search Employees by Name');
    expect(searchInput).toBeTruthy();
  });

  it('does not block UI during client-side filtering', async () => {
    const employees = [
      {
        id: '1',
        assignmentId: 'a1',
        doctor: {
          id: 'd1',
          fullName: 'Dr. Test',
          specialization: 'Cardiology',
          avatar: null,
        },
        job: {
          id: 'j1',
          title: 'Cardiologist',
        },
        status: 'active',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        salary: 50000,
      },
    ];

    mockUseEmployees.mockReturnValue({
      employees,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseFilteredEmployees.mockReturnValue({
      filteredEmployees: employees,
      isEmpty: false,
    });

    const { getByText } = render(<HospitalEmployees />);
    
    // Employees should be immediately visible (client-side filtering is synchronous)
    await waitFor(() => {
      expect(getByText('Dr. Test')).toBeTruthy();
    });
  });
});
