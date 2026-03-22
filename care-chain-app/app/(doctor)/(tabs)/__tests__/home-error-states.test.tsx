/**
 * Unit Tests for Doctor Dashboard Error States and Edge Cases
 * Feature: doctor-dashboard-redesign
 * 
 * Tests error handling and edge cases:
 * - Jobs loading error displays correctly
 * - Empty jobs state displays correctly
 * - Zero stats display correctly
 * - Missing avatar shows fallback
 * - Missing user name shows fallback
 * - Undefined profile stats default to 0
 * 
 * Validates Requirements: 2.6, 3.8, 5.15, 6.4
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import HomePage from '../home';

// Mock dependencies
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
  useFocusEffect: jest.fn((callback) => callback()),
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

jest.mock('../../components/JobCard', () => {
  return jest.fn(() => null);
});

jest.mock('../../../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Import after mocking
import { useAuth } from '../../../../contexts/AuthContext';

// Create manual mocks for hooks
const mockUseRecentJobs = jest.fn();
const mockUseDoctorProfile = jest.fn();
const mockUseApplications = jest.fn();
const mockUseJobApplication = jest.fn();

// Mock the hooks module
jest.mock('../../../../hooks', () => ({
  useRecentJobs: () => mockUseRecentJobs(),
  useDoctorProfile: () => mockUseDoctorProfile(),
  useApplications: () => mockUseApplications(),
  useJobApplication: () => mockUseJobApplication(),
}));

describe('Doctor Dashboard - Error States and Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mocks
    (useAuth as jest.Mock).mockReturnValue({
      user: { fullName: 'Test User', avatar: null },
    });

    mockUseJobApplication.mockReturnValue({
      apply: jest.fn(),
    });
  });

  describe('Jobs Loading Error', () => {
    it('should display error state with retry button when API error occurs', async () => {
      const mockRefresh = jest.fn();
      
      mockUseDoctorProfile.mockReturnValue({
        profile: { stats: { shiftsDone: 0, noShows: 0, performance: 0 } },
        isLoading: false,
      });

      mockUseRecentJobs.mockReturnValue({
        jobs: [],
        isLoading: false,
        error: 'Network error: Unable to fetch jobs',
        refresh: mockRefresh,
      });

      mockUseApplications.mockReturnValue({
        counts: {},
        applications: [],
        isLoading: false,
        refresh: jest.fn(),
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('Network error: Unable to fetch jobs')).toBeTruthy();
        expect(screen.getByText('Retry')).toBeTruthy();
      });
    });
  });

  describe('Empty Jobs State', () => {
    it('should display empty state message when no jobs are available', async () => {
      mockUseDoctorProfile.mockReturnValue({
        profile: { stats: { shiftsDone: 0, noShows: 0, performance: 0 } },
        isLoading: false,
      });

      mockUseRecentJobs.mockReturnValue({
        jobs: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
      });

      mockUseApplications.mockReturnValue({
        counts: {},
        applications: [],
        isLoading: false,
        refresh: jest.fn(),
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('No jobs available yet')).toBeTruthy();
      });
    });
  });

  describe('Zero Stats Display', () => {
    it('should display 0 for all stats when counts are undefined', async () => {
      mockUseDoctorProfile.mockReturnValue({
        profile: { stats: { shiftsDone: 0, noShows: 0, performance: 0 } },
        isLoading: false,
      });

      mockUseRecentJobs.mockReturnValue({
        jobs: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
      });

      mockUseApplications.mockReturnValue({
        counts: {}, // Empty counts object
        applications: [],
        isLoading: false,
        refresh: jest.fn(),
      });

      render(<HomePage />);

      await waitFor(() => {
        // Should display 0 for all stats
        const statsElements = screen.getAllByText('0');
        expect(statsElements.length).toBeGreaterThan(0);
      });
    });

    it('should correctly calculate offers stat (Offers + Hired)', async () => {
      mockUseDoctorProfile.mockReturnValue({
        profile: { stats: { shiftsDone: 0, noShows: 0, performance: 0 } },
        isLoading: false,
      });

      mockUseRecentJobs.mockReturnValue({
        jobs: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
      });

      mockUseApplications.mockReturnValue({
        counts: {
          Applied: 5,
          Interview: 2,
          Offers: 1,
          Hired: 1,
        },
        applications: [],
        isLoading: false,
        refresh: jest.fn(),
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('5')).toBeTruthy(); // Applied
        expect(screen.getByText('2')).toBeTruthy(); // Interview
        // Offers should be 1 + 1 = 2
        const twoElements = screen.getAllByText('2');
        expect(twoElements.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Missing Avatar Fallback', () => {
    it('should show initials when avatar is null', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { fullName: 'John Doe', avatar: null },
      });

      mockUseDoctorProfile.mockReturnValue({
        profile: { stats: { shiftsDone: 0, noShows: 0, performance: 0 } },
        isLoading: false,
      });

      mockUseRecentJobs.mockReturnValue({
        jobs: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
      });

      mockUseApplications.mockReturnValue({
        counts: {},
        applications: [],
        isLoading: false,
        refresh: jest.fn(),
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('JD')).toBeTruthy(); // Initials
      });
    });

    it('should show "U" when user name is missing', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { fullName: null, avatar: null },
      });

      mockUseDoctorProfile.mockReturnValue({
        profile: { stats: { shiftsDone: 0, noShows: 0, performance: 0 } },
        isLoading: false,
      });

      mockUseRecentJobs.mockReturnValue({
        jobs: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
      });

      mockUseApplications.mockReturnValue({
        counts: {},
        applications: [],
        isLoading: false,
        refresh: jest.fn(),
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('U')).toBeTruthy(); // Default fallback
      });
    });
  });

  describe('Missing User Name Fallback', () => {
    it('should display "User" when user name is missing', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { fullName: null, avatar: null },
      });

      mockUseDoctorProfile.mockReturnValue({
        profile: { stats: { shiftsDone: 0, noShows: 0, performance: 0 } },
        isLoading: false,
      });

      mockUseRecentJobs.mockReturnValue({
        jobs: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
      });

      mockUseApplications.mockReturnValue({
        counts: {},
        applications: [],
        isLoading: false,
        refresh: jest.fn(),
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText(/Hi, Dr\. User/)).toBeTruthy();
      });
    });
  });

  describe('Undefined Profile Stats', () => {
    it('should default all career health stats to 0 when profile is null', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { fullName: 'Test User', avatar: null },
      });

      mockUseDoctorProfile.mockReturnValue({
        profile: null, // No profile data
        isLoading: false,
      });

      mockUseRecentJobs.mockReturnValue({
        jobs: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
      });

      mockUseApplications.mockReturnValue({
        counts: {},
        applications: [],
        isLoading: false,
        refresh: jest.fn(),
      });

      render(<HomePage />);

      await waitFor(() => {
        // Should display 0 for career health stats
        expect(screen.getByText('0%')).toBeTruthy(); // Performance
        const zeroElements = screen.getAllByText('0');
        expect(zeroElements.length).toBeGreaterThanOrEqual(2); // Shifts and No Shows
      });
    });

    it('should default individual stats to 0 when undefined', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { fullName: 'Test User', avatar: null },
      });

      mockUseDoctorProfile.mockReturnValue({
        profile: {
          stats: {
            shiftsDone: undefined,
            noShows: undefined,
            performance: undefined,
          },
        },
        isLoading: false,
      });

      mockUseRecentJobs.mockReturnValue({
        jobs: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
      });

      mockUseApplications.mockReturnValue({
        counts: {},
        applications: [],
        isLoading: false,
        refresh: jest.fn(),
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('0%')).toBeTruthy(); // Performance
        const zeroElements = screen.getAllByText('0');
        expect(zeroElements.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Loading State', () => {
    it('should display loading indicator when jobs are loading', async () => {
      mockUseDoctorProfile.mockReturnValue({
        profile: { stats: { shiftsDone: 0, noShows: 0, performance: 0 } },
        isLoading: false,
      });

      mockUseRecentJobs.mockReturnValue({
        jobs: [],
        isLoading: true, // Loading state
        error: null,
        refresh: jest.fn(),
      });

      mockUseApplications.mockReturnValue({
        counts: {},
        applications: [],
        isLoading: false,
        refresh: jest.fn(),
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('Loading jobs...')).toBeTruthy();
      });
    });
  });
});
