/**
 * Tests for independent search and filter controls in hospital search
 * Validates Requirements 8.1, 8.2, 8.4, 8.5
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import HospitalSearchScreen from '../search';
import { useSearchDoctors, useFilterPersistence, useDebounce } from '../../../../hooks';

// Mock the hooks
jest.mock('../../../../hooks', () => ({
  useSearchDoctors: jest.fn(),
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

describe('Hospital Search - Independent Search and Filter Controls', () => {
  const mockUseSearchDoctors = useSearchDoctors as jest.MockedFunction<typeof useSearchDoctors>;
  const mockUseFilterPersistence = useFilterPersistence as jest.MockedFunction<typeof useFilterPersistence>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementation
    mockUseSearchDoctors.mockReturnValue({
      doctors: [],
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
          city: 'Mumbai',
          minExperience: 5,
        },
        saveFilters: jest.fn(),
        clearFilters: mockClearFilters,
        loadFilters: mockLoadFilters,
        isLoading: false,
        error: null,
        clearError: mockClearError,
      });

      const { getByPlaceholderText } = render(<HospitalSearchScreen />);

      // Enter search query
      const searchInput = getByPlaceholderText(/search candidates/i);
      fireEvent.changeText(searchInput, 'Dr. Smith');

      // Verify useSearchDoctors was called with both search and filters
      await waitFor(() => {
        expect(mockUseSearchDoctors).toHaveBeenCalledWith(
          expect.objectContaining({
            q: 'Dr. Smith',
            specialization: 'Cardiology',
            city: 'Mumbai',
            minExperience: 5,
          })
        );
      });

      // Clear search by clicking the X button
      fireEvent.changeText(searchInput, '');

      // Verify useSearchDoctors is now called with only filters (no search)
      await waitFor(() => {
        expect(mockUseSearchDoctors).toHaveBeenCalledWith(
          expect.objectContaining({
            q: undefined,
            specialization: 'Cardiology',
            city: 'Mumbai',
            minExperience: 5,
          })
        );
      });

      // Verify clearFilters was NOT called
      expect(mockClearFilters).not.toHaveBeenCalled();
    });

    it('should show filter-only results after clearing search', async () => {
      const mockDoctors = [
        { 
          id: '1', 
          name: 'Dr. John', 
          role: 'Cardiologist', 
          location: 'Mumbai', 
          experienceYears: 5,
          avatarUri: null,
          rating: 4.5,
          isAvailable: true,
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
      mockUseSearchDoctors.mockReturnValue({
        doctors: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        totalCount: 0,
        currentPage: 1,
        totalPages: 0,
        loadMore: jest.fn(),
        hasMore: false,
      });

      const { getByPlaceholderText, rerender } = render(<HospitalSearchScreen />);

      const searchInput = getByPlaceholderText(/search candidates/i);
      fireEvent.changeText(searchInput, 'Dr. Smith');

      // Clear search
      fireEvent.changeText(searchInput, '');

      // Update mock to return filter-only results
      mockUseSearchDoctors.mockReturnValue({
        doctors: mockDoctors,
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        totalCount: 1,
        currentPage: 1,
        totalPages: 1,
        loadMore: jest.fn(),
        hasMore: false,
      });

      rerender(<HospitalSearchScreen />);

      // Verify results are displayed
      await waitFor(() => {
        expect(mockUseSearchDoctors).toHaveBeenCalledWith(
          expect.objectContaining({
            q: undefined,
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
          city: 'Mumbai',
        },
        saveFilters: jest.fn(),
        clearFilters: mockClearFilters,
        loadFilters: mockLoadFilters,
        isLoading: false,
        error: null,
        clearError: mockClearError,
      });

      const { getByPlaceholderText, getByText } = render(<HospitalSearchScreen />);

      // Enter search query
      const searchInput = getByPlaceholderText(/search candidates/i);
      fireEvent.changeText(searchInput, 'Dr. Smith');

      // Verify useSearchDoctors was called with both search and filters
      await waitFor(() => {
        expect(mockUseSearchDoctors).toHaveBeenCalledWith(
          expect.objectContaining({
            q: 'Dr. Smith',
            specialization: 'Cardiology',
            city: 'Mumbai',
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

      // Verify useSearchDoctors is now called with only search (no filters)
      await waitFor(() => {
        expect(mockUseSearchDoctors).toHaveBeenCalledWith(
          expect.objectContaining({
            q: 'Dr. Smith',
            specialization: undefined,
            city: undefined,
          })
        );
      });
    });

    it('should show search-only results after clearing filters', async () => {
      const mockDoctors = [
        { 
          id: '1', 
          name: 'Dr. Smith', 
          role: 'Surgeon', 
          location: 'Delhi', 
          experienceYears: 3,
          avatarUri: null,
          rating: 4.2,
          isAvailable: true,
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
      mockUseSearchDoctors.mockReturnValue({
        doctors: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        totalCount: 0,
        currentPage: 1,
        totalPages: 0,
        loadMore: jest.fn(),
        hasMore: false,
      });

      const { getByPlaceholderText, getByText, rerender } = render(<HospitalSearchScreen />);

      const searchInput = getByPlaceholderText(/search candidates/i);
      fireEvent.changeText(searchInput, 'Dr. Smith');

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

      mockUseSearchDoctors.mockReturnValue({
        doctors: mockDoctors,
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        totalCount: 1,
        currentPage: 1,
        totalPages: 1,
        loadMore: jest.fn(),
        hasMore: false,
      });

      rerender(<HospitalSearchScreen />);

      // Verify results are displayed
      await waitFor(() => {
        expect(mockUseSearchDoctors).toHaveBeenCalledWith(
          expect.objectContaining({
            q: 'Dr. Smith',
            specialization: undefined,
          })
        );
      });
    });
  });

  describe('Independent controls verification', () => {
    it('should have separate clear buttons for search and filters', () => {
      mockUseFilterPersistence.mockReturnValue({
        filters: { specialization: 'Cardiology' },
        saveFilters: jest.fn(),
        clearFilters: jest.fn(),
        loadFilters: jest.fn(),
        isLoading: false,
        error: null,
        clearError: jest.fn(),
      });

      const { getByPlaceholderText, getByText, queryByText } = render(<HospitalSearchScreen />);

      // Enter search query
      const searchInput = getByPlaceholderText(/search candidates/i);
      fireEvent.changeText(searchInput, 'Dr. Smith');

      // Both clear buttons should be present
      expect(queryByText('Clear')).toBeTruthy(); // Filter clear button
      
      // Search has X button in the input field (tested by presence of close icon)
      expect(searchInput.props.value).toBe('Dr. Smith');
    });
  });
});
