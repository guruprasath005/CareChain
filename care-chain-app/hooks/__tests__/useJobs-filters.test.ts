/**
 * Test: useJobs hook filter parameter transmission
 * 
 * This test verifies that all filter parameters are correctly passed
 * to the jobsApi.searchJobs method and that pagination reset logic
 * works when search/filters change.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8, 9.2, 9.3
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useJobs } from '../useJobs';
import { jobsApi } from '../../services/api';

// Mock the API
jest.mock('../../services/api', () => ({
  jobsApi: {
    searchJobs: jest.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number, public data?: any) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

// Mock the useApiOptimization hook
jest.mock('../useApiOptimization', () => ({
  useApiOptimization: () => ({
    shouldSkipRequest: jest.fn(() => false),
    isRequestInProgress: jest.fn(() => false),
    prepareRequest: jest.fn(),
    completeRequest: jest.fn(),
    cancelPendingRequest: jest.fn(),
  }),
}));

describe('useJobs - Filter Parameters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (jobsApi.searchJobs as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
      meta: {
        totalItems: 0,
        page: 1,
        totalPages: 1,
      },
    });
  });

  it('should pass all filter parameters to API', async () => {
    const filterOptions = {
      search: 'test query',
      specialization: 'Cardiology',
      location: 'Mumbai',
      jobType: 'full_time',
      salaryMin: 50000,
      salaryMax: 100000,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      limit: 20,
    };

    renderHook(() => useJobs(filterOptions));

    await waitFor(() => {
      expect(jobsApi.searchJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'test query',
          specialization: 'Cardiology',
          location: 'Mumbai',
          jobType: 'full_time',
          salaryMin: 50000,
          salaryMax: 100000,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          page: 1,
          limit: 20,
        })
      );
    });
  });

  it('should pass only provided filter parameters', async () => {
    const filterOptions = {
      specialization: 'Cardiology',
      location: 'Mumbai',
    };

    renderHook(() => useJobs(filterOptions));

    await waitFor(() => {
      expect(jobsApi.searchJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          specialization: 'Cardiology',
          location: 'Mumbai',
          page: 1,
          limit: 10,
        })
      );
    });
  });

  it('should handle salary range filters', async () => {
    const filterOptions = {
      salaryMin: 30000,
      salaryMax: 80000,
    };

    renderHook(() => useJobs(filterOptions));

    await waitFor(() => {
      expect(jobsApi.searchJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          salaryMin: 30000,
          salaryMax: 80000,
        })
      );
    });
  });

  it('should handle job type filter', async () => {
    const filterOptions = {
      jobType: 'part_time',
    };

    renderHook(() => useJobs(filterOptions));

    await waitFor(() => {
      expect(jobsApi.searchJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          jobType: 'part_time',
        })
      );
    });
  });

  it('should handle sort parameters', async () => {
    const filterOptions = {
      sortBy: 'salary',
      sortOrder: 'asc',
    };

    renderHook(() => useJobs(filterOptions));

    await waitFor(() => {
      expect(jobsApi.searchJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'salary',
          sortOrder: 'asc',
        })
      );
    });
  });

  it('should combine search query with filters', async () => {
    const filterOptions = {
      search: 'cardiologist',
      specialization: 'Cardiology',
      location: 'Mumbai',
      salaryMin: 50000,
    };

    renderHook(() => useJobs(filterOptions));

    await waitFor(() => {
      expect(jobsApi.searchJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'cardiologist',
          specialization: 'Cardiology',
          location: 'Mumbai',
          salaryMin: 50000,
        })
      );
    });
  });

  it('should reset pagination when search changes', async () => {
    const { rerender } = renderHook(
      ({ options }) => useJobs(options),
      {
        initialProps: { options: { search: 'initial' } },
      }
    );

    await waitFor(() => {
      expect(jobsApi.searchJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'initial',
          page: 1,
        })
      );
    });

    jest.clearAllMocks();

    // Change search query
    rerender({ options: { search: 'updated' } });

    await waitFor(() => {
      expect(jobsApi.searchJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'updated',
          page: 1,
        })
      );
    });
  });

  it('should reset pagination when filters change', async () => {
    const { rerender } = renderHook(
      ({ options }) => useJobs(options),
      {
        initialProps: { options: { specialization: 'Cardiology' } },
      }
    );

    await waitFor(() => {
      expect(jobsApi.searchJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          specialization: 'Cardiology',
          page: 1,
        })
      );
    });

    jest.clearAllMocks();

    // Change filter
    rerender({ options: { specialization: 'Neurology' } });

    await waitFor(() => {
      expect(jobsApi.searchJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          specialization: 'Neurology',
          page: 1,
        })
      );
    });
  });
});
