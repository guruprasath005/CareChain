/**
 * Test: useSearchDoctors hook filter parameter transmission
 * 
 * This test verifies that all filter parameters are correctly passed
 * to the hospitalApi.searchCandidates method.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.8, 9.2, 9.3
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useSearchDoctors } from '../useHospital';
import { hospitalApi } from '../../services/api';

// Mock the API
jest.mock('../../services/api', () => ({
  hospitalApi: {
    searchCandidates: jest.fn(),
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

describe('useSearchDoctors - Filter Parameters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (hospitalApi.searchCandidates as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
      meta: {
        pagination: {
          totalItems: 0,
          currentPage: 1,
          totalPages: 1,
        },
      },
    });
  });

  it('should pass all filter parameters to API', async () => {
    const filterOptions = {
      q: 'test query',
      specialization: 'Cardiology',
      city: 'Mumbai',
      state: 'Maharashtra',
      minExperience: 5,
      maxExperience: 10,
      isAvailable: true,
      limit: 20,
    };

    renderHook(() => useSearchDoctors(filterOptions));

    await waitFor(() => {
      expect(hospitalApi.searchCandidates).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'test query',
          specialization: 'Cardiology',
          city: 'Mumbai',
          state: 'Maharashtra',
          minExperience: 5,
          maxExperience: 10,
          isAvailable: true,
          page: 1,
          limit: 20,
        })
      );
    });
  });

  it('should pass only provided filter parameters', async () => {
    const filterOptions = {
      specialization: 'Cardiology',
      city: 'Mumbai',
    };

    renderHook(() => useSearchDoctors(filterOptions));

    await waitFor(() => {
      expect(hospitalApi.searchCandidates).toHaveBeenCalledWith(
        expect.objectContaining({
          specialization: 'Cardiology',
          city: 'Mumbai',
          page: 1,
          limit: 10,
        })
      );
    });
  });

  it('should handle experience range filters', async () => {
    const filterOptions = {
      minExperience: 3,
      maxExperience: 8,
    };

    renderHook(() => useSearchDoctors(filterOptions));

    await waitFor(() => {
      expect(hospitalApi.searchCandidates).toHaveBeenCalledWith(
        expect.objectContaining({
          minExperience: 3,
          maxExperience: 8,
        })
      );
    });
  });

  it('should handle availability filter', async () => {
    const filterOptions = {
      isAvailable: true,
    };

    renderHook(() => useSearchDoctors(filterOptions));

    await waitFor(() => {
      expect(hospitalApi.searchCandidates).toHaveBeenCalledWith(
        expect.objectContaining({
          isAvailable: true,
        })
      );
    });
  });

  it('should combine search query with filters', async () => {
    const filterOptions = {
      q: 'cardiologist',
      specialization: 'Cardiology',
      city: 'Mumbai',
      minExperience: 5,
    };

    renderHook(() => useSearchDoctors(filterOptions));

    await waitFor(() => {
      expect(hospitalApi.searchCandidates).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'cardiologist',
          specialization: 'Cardiology',
          city: 'Mumbai',
          minExperience: 5,
        })
      );
    });
  });
});
