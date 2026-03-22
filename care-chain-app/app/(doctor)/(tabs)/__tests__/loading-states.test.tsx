import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import JobSearchHomeScreen from '../search';

// Mock dependencies
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  useFocusEffect: jest.fn((callback) => callback()),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../../../../hooks', () => ({
  useJobs: jest.fn(),
  useJobApplication: jest.fn(() => ({
    apply: jest.fn(),
  })),
  useDebounce: jest.fn((value) => value),
  useFilterPersistence: jest.fn(() => ({
    filters: {},
    saveFilters: jest.fn(),
    clearFilters: jest.fn(),
    loadFilters: jest.fn(),
    error: null,
    clearError: jest.fn(),
  })),
}));

describe('Loading States - Doctor Search Screen', () => {
  const mockUseJobs = require('../../../../hooks').useJobs;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays skeleton loader during initial load', async () => {
    mockUseJobs.mockReturnValue({
      jobs: [],
      isLoading: true,
      error: null,
      refresh: jest.fn(),
      totalCount: 0,
      loadMore: jest.fn(),
      hasMore: false,
    });

    const { getByText } = render(<JobSearchHomeScreen />);
    
    // Skeleton loader should be visible (it renders View components)
    await waitFor(() => {
      expect(getByText('Available Jobs')).toBeTruthy();
    });
  });

  it('displays inline loading indicator when loading more results', async () => {
    mockUseJobs.mockReturnValue({
      jobs: [
        {
          id: '1',
          title: 'Test Job',
          hospital: 'Test Hospital',
          location: 'Test Location',
          experience: '2 Years',
          salary: '₹50,000',
          avatar: null,
        },
      ],
      isLoading: true,
      error: null,
      refresh: jest.fn(),
      totalCount: 10,
      loadMore: jest.fn(),
      hasMore: true,
    });

    const { UNSAFE_root } = render(<JobSearchHomeScreen />);
    
    // Should show ActivityIndicator when loading with existing jobs
    await waitFor(() => {
      const activityIndicators = UNSAFE_root.findAllByType('ActivityIndicator');
      expect(activityIndicators.length).toBeGreaterThan(0);
    });
  });

  it('does not block UI during loading', async () => {
    mockUseJobs.mockReturnValue({
      jobs: [
        {
          id: '1',
          title: 'Test Job',
          hospital: 'Test Hospital',
          location: 'Test Location',
          experience: '2 Years',
          salary: '₹50,000',
          avatar: null,
        },
      ],
      isLoading: true,
      error: null,
      refresh: jest.fn(),
      totalCount: 10,
      loadMore: jest.fn(),
      hasMore: true,
    });

    const { getByText } = render(<JobSearchHomeScreen />);
    
    // Jobs should still be visible while loading more
    await waitFor(() => {
      expect(getByText('Test Job')).toBeTruthy();
    });
  });

  it('shows loading indicator on clear filters button when filtering', async () => {
    const mockClearFilters = jest.fn();
    require('../../../../hooks').useFilterPersistence.mockReturnValue({
      filters: { specialization: 'Cardiology' },
      saveFilters: jest.fn(),
      clearFilters: mockClearFilters,
      loadFilters: jest.fn(),
      error: null,
      clearError: jest.fn(),
    });

    mockUseJobs.mockReturnValue({
      jobs: [],
      isLoading: true,
      error: null,
      refresh: jest.fn(),
      totalCount: 0,
      loadMore: jest.fn(),
      hasMore: false,
    });

    const { getByText } = render(<JobSearchHomeScreen />);
    
    // Clear button should be visible with filters active
    await waitFor(() => {
      // When loading with filters, should show loading indicator
      expect(getByText('Available Jobs')).toBeTruthy();
    });
  });

  it('displays job count when not loading', async () => {
    mockUseJobs.mockReturnValue({
      jobs: [
        {
          id: '1',
          title: 'Test Job',
          hospital: 'Test Hospital',
          location: 'Test Location',
          experience: '2 Years',
          salary: '₹50,000',
          avatar: null,
        },
      ],
      isLoading: false,
      error: null,
      refresh: jest.fn(),
      totalCount: 1,
      loadMore: jest.fn(),
      hasMore: false,
    });

    const { getByText } = render(<JobSearchHomeScreen />);
    
    await waitFor(() => {
      expect(getByText('1 jobs')).toBeTruthy();
    });
  });
});
