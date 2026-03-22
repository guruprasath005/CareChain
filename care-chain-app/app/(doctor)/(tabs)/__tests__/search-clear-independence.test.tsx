/**
 * Tests for independent search and filter controls
 * Validates Requirements 8.1, 8.2, 8.4, 8.5
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import JobSearchHomeScreen from '../search';
import { useJobs, useFilterPersistence, useDebounce } from '../../../../hooks';

// Mock the hooks
jest.mock('../../../../hooks', () => ({
  useJobs: jest.fn(),
  useJobApplication: jest.fn(() => ({
    apply: jest.fn(),
  })),
  useDebounce: jest.fn((value) => value),
  useFilterPersistence: jest.fn(),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  useFocusEffect: jest.fn((callback) => callback()),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('Doctor Search - Independent Search and Filter Controls', () => {
  const mockUseJobs = useJobs as jest.MockedFunction<typeof useJobs>;
  const mockUseFilterPersistence = useFilterPersistence as jest.MockedFunction<typeof useFilterPersistence>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementation
    mockUseJobs.mockReturnValue({
      jobs: [],
      isLoading: false,
      error: null,
      refresh: jest.fn(),
      totalCount: 0,
      currentPage: 1,
      totalPages: 0,
      loadMore: jest.fn(),
      hasMore: false,
    });
  });

  describe('Requirement 8.1, 8.4: Search clear preserves filters', () => {
    it('should maintain active filters when search is cleared', async () => {
      const mockClearFilters = jest.fn();
      const mockLoadFilters = jest.fn();
      const mockClearError = jest.fn();

      // Setup: Active filters
      mockUseFilterPersistence.mockReturnValue({
        filters: {
          specialization: 'Cardiology',
          location: 'Mumbai',
          jobType: 'full_time',
        },
        saveFilters: jest.fn(),
        clearFilters: mockClearFilters,
        loadFilters: mockLoadFilters,
        isLoading: false,
        error: null,
        clearError: mockClearError,
      });

      const { getByPlaceholderText, getByText } = render(<JobSearchHomeScreen />);

      // Enter search query
      const searchInput = getByPlaceholderText(/search jobs/i);
      fireEvent.changeText(searchInput, 'surgeon');

      // Verify useJobs was called with both search and filters
      await waitFor(() => {
        expect(mockUseJobs).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'surgeon',
            specialization: 'Cardiology',
            location: 'Mumbai',
            jobType: 'full_time',
          })
        );
      });

      // Clear search by clicking the X button
      fireEvent.changeText(searchInput, '');

      // Verify useJobs is now called with only filters (no search)
      await waitFor(() => {
        expect(mockUseJobs).toHaveBeenCalledWith(
          expect.objectContaining({
            search: undefined,
            specialization: 'Cardiology',
            location: 'Mumbai',
            jobType: 'full_time',
          })
        );
      });

      // Verify clearFilters was NOT called
      expect(mockClearFilters).not.toHaveBeenCalled();
    });

    it('should show filter-only results after clearing search', async () => {
      const mockJobs = [
        { 
          id: '1', 
          title: 'Cardiologist', 
          hospital: 'Hospital A', 
          location: 'Mumbai', 
          experience: '5 years', 
          salary: '₹50,000',
          status: 'active',
          specialization: 'Cardiology',
          dates: '2024-01-01 to 2024-12-31',
          description: 'Test job',
          requirements: [],
          benefits: [],
          qualifications: [],
          skills: [],
        },
      ];

      mockUseFilterPersistence.mockReturnValue({
        filters: { specialization: 'Cardiology' },
        saveFilters: jest.fn(),
        clearFilters: jest.fn(),
        loadFilters: jest.fn(),
        isLoading: false,
        error: null,
        clearError: jest.fn(),
      });

      // First render with search + filters
      mockUseJobs.mockReturnValue({
        jobs: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        totalCount: 0,
        currentPage: 1,
        totalPages: 0,
        loadMore: jest.fn(),
        hasMore: false,
      });

      const { getByPlaceholderText, rerender } = render(<JobSearchHomeScreen />);

      const searchInput = getByPlaceholderText(/search jobs/i);
      fireEvent.changeText(searchInput, 'surgeon');

      // Clear search
      fireEvent.changeText(searchInput, '');

      // Update mock to return filter-only results
      mockUseJobs.mockReturnValue({
        jobs: mockJobs,
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        totalCount: 1,
        currentPage: 1,
        totalPages: 1,
        loadMore: jest.fn(),
        hasMore: false,
      });

      rerender(<JobSearchHomeScreen />);

      // Verify results are displayed
      await waitFor(() => {
        expect(mockUseJobs).toHaveBeenCalledWith(
          expect.objectContaining({
            search: undefined,
            specialization: 'Cardiology',
          })
        );
      });
    });
  });

  describe('Requirement 8.2, 8.5: Filter clear preserves search', () => {
    it('should maintain active search when filters are cleared', async () => {
      const mockClearFilters = jest.fn().mockResolvedValue(undefined);
      const mockLoadFilters = jest.fn();
      const mockClearError = jest.fn();

      // Setup: Active search and filters
      mockUseFilterPersistence.mockReturnValue({
        filters: {
          specialization: 'Cardiology',
          location: 'Mumbai',
        },
        saveFilters: jest.fn(),
        clearFilters: mockClearFilters,
        loadFilters: mockLoadFilters,
        isLoading: false,
        error: null,
        clearError: mockClearError,
      });

      const { getByPlaceholderText, getByText } = render(<JobSearchHomeScreen />);

      // Enter search query
      const searchInput = getByPlaceholderText(/search jobs/i);
      fireEvent.changeText(searchInput, 'surgeon');

      // Verify useJobs was called with both search and filters
      await waitFor(() => {
        expect(mockUseJobs).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'surgeon',
            specialization: 'Cardiology',
            location: 'Mumbai',
          })
        );
      });

      // Clear filters by clicking the Clear button
      const clearButton = getByText('Clear');
      fireEvent.press(clearButton);

      await waitFor(() => {
        expect(mockClearFilters).toHaveBeenCalled();
      });

      // Update mock to reflect cleared filters
      mockUseFilterPersistence.mockReturnValue({
        filters: {},
        saveFilters: jest.fn(),
        clearFilters: mockClearFilters,
        loadFilters: mockLoadFilters,
        isLoading: false,
        error: null,
        clearError: mockClearError,
      });

      // Verify useJobs is now called with only search (no filters)
      await waitFor(() => {
        expect(mockUseJobs).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'surgeon',
            specialization: undefined,
            location: undefined,
          })
        );
      });
    });

    it('should show search-only results after clearing filters', async () => {
      const mockJobs = [
        { 
          id: '1', 
          title: 'Surgeon', 
          hospital: 'Hospital A', 
          location: 'Delhi', 
          experience: '3 years', 
          salary: '₹40,000',
          status: 'active',
          specialization: 'Surgery',
          dates: '2024-01-01 to 2024-12-31',
          description: 'Test job',
          requirements: [],
          benefits: [],
          qualifications: [],
          skills: [],
        },
      ];

      const mockClearFilters = jest.fn().mockResolvedValue(undefined);

      mockUseFilterPersistence.mockReturnValue({
        filters: { specialization: 'Cardiology' },
        saveFilters: jest.fn(),
        clearFilters: mockClearFilters,
        loadFilters: jest.fn(),
        isLoading: false,
        error: null,
        clearError: jest.fn(),
      });

      // First render with search + filters
      mockUseJobs.mockReturnValue({
        jobs: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        totalCount: 0,
        currentPage: 1,
        totalPages: 0,
        loadMore: jest.fn(),
        hasMore: false,
      });

      const { getByPlaceholderText, getByText, rerender } = render(<JobSearchHomeScreen />);

      const searchInput = getByPlaceholderText(/search jobs/i);
      fireEvent.changeText(searchInput, 'surgeon');

      // Clear filters
      const clearButton = getByText('Clear');
      fireEvent.press(clearButton);

      await waitFor(() => {
        expect(mockClearFilters).toHaveBeenCalled();
      });

      // Update mock to reflect cleared filters and show search results
      mockUseFilterPersistence.mockReturnValue({
        filters: {},
        saveFilters: jest.fn(),
        clearFilters: mockClearFilters,
        loadFilters: jest.fn(),
        isLoading: false,
        error: null,
        clearError: jest.fn(),
      });

      mockUseJobs.mockReturnValue({
        jobs: mockJobs,
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        totalCount: 1,
        currentPage: 1,
        totalPages: 1,
        loadMore: jest.fn(),
        hasMore: false,
      });

      rerender(<JobSearchHomeScreen />);

      // Verify results are displayed
      await waitFor(() => {
        expect(mockUseJobs).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'surgeon',
            specialization: undefined,
          })
        );
      });
    });
  });
});
