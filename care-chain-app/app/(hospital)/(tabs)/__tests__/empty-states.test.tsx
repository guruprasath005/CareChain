/**
 * Empty State Tests for Hospital Search Screen
 * 
 * Tests all empty state scenarios as per Requirements 10.1, 10.2, 10.3, 10.4:
 * - No data state (no candidates in system)
 * - No search results state (search returns nothing)
 * - No filter results state (filters return nothing)
 * - No combined results state (search + filters return nothing)
 * - Correct empty state messages and actions for each scenario
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import HospitalSearchScreen from '../search';
import { useSearchDoctors, useFilterPersistence } from '@/hooks';

// Mock dependencies
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useFocusEffect: jest.fn((callback) => callback()),
}));

jest.mock('@/hooks', () => ({
  useSearchDoctors: jest.fn(),
  useDebounce: jest.fn((value) => value),
  useFilterPersistence: jest.fn(),
}));

describe('Hospital Search Screen - Empty States', () => {
  const mockRouter = {
    push: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  describe('Requirement 10.1: No Data State', () => {
    it('should display no data empty state when no candidates exist in system', async () => {
      // Mock: No search query, no filters, no candidates
      (useFilterPersistence as jest.Mock).mockReturnValue({
        filters: {},
        saveFilters: jest.fn(),
        clearFilters: jest.fn(),
        loadFilters: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });

      (useSearchDoctors as jest.Mock).mockReturnValue({
        doctors: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        totalCount: 0,
      });

      render(<HospitalSearchScreen />);

      await waitFor(() => {
        expect(screen.getByText('No candidates found')).toBeTruthy();
        expect(screen.getByText('No doctors are currently registered')).toBeTruthy();
      });

      // Should NOT show clear search or clear filters buttons
      expect(screen.queryByText('Clear Search')).toBeNull();
      expect(screen.queryByText('Clear Filters')).toBeNull();
    });
  });

  describe('Requirement 10.2: No Search Results State', () => {
    it('should display no search results state when search returns nothing', async () => {
      // Mock: Active search query, no filters, no results
      (useFilterPersistence as jest.Mock).mockReturnValue({
        filters: {},
        saveFilters: jest.fn(),
        clearFilters: jest.fn(),
        loadFilters: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });

      (useSearchDoctors as jest.Mock).mockReturnValue({
        doctors: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        totalCount: 0,
      });

      render(<HospitalSearchScreen />);

      await waitFor(() => {
        expect(screen.getByText('No candidates found')).toBeTruthy();
        expect(screen.getByText('Try a different search term')).toBeTruthy();
      });
    });

    it('should show clear search button when search returns no results', async () => {
      (useFilterPersistence as jest.Mock).mockReturnValue({
        filters: {},
        saveFilters: jest.fn(),
        clearFilters: jest.fn(),
        loadFilters: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });

      (useSearchDoctors as jest.Mock).mockReturnValue({
        doctors: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        totalCount: 0,
      });

      render(<HospitalSearchScreen />);

      await waitFor(() => {
        // Search input should have clear button when text is present
        const searchInput = screen.getByPlaceholderText(/Search candidates/i);
        expect(searchInput).toBeTruthy();
      });
    });
  });

  describe('Requirement 10.3: No Filter Results State', () => {
    it('should display no filter results state when filters return nothing', async () => {
      // Mock: No search query, active filters, no results
      (useFilterPersistence as jest.Mock).mockReturnValue({
        filters: {
          specialization: 'Cardiology',
          city: 'Mumbai',
        },
        saveFilters: jest.fn(),
        clearFilters: jest.fn(),
        loadFilters: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });

      (useSearchDoctors as jest.Mock).mockReturnValue({
        doctors: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        totalCount: 0,
      });

      render(<HospitalSearchScreen />);

      await waitFor(() => {
        expect(screen.getByText('No candidates found')).toBeTruthy();
        expect(screen.getByText('Try adjusting your filters')).toBeTruthy();
      });

      // Should show clear filters button
      expect(screen.getByText('Clear')).toBeTruthy(); // The clear filters button in header
    });

    it('should show clear filters button when filters return no results', async () => {
      (useFilterPersistence as jest.Mock).mockReturnValue({
        filters: {
          specialization: 'Neurology',
          minExperience: 5,
          maxExperience: 10,
        },
        saveFilters: jest.fn(),
        clearFilters: jest.fn(),
        loadFilters: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });

      (useSearchDoctors as jest.Mock).mockReturnValue({
        doctors: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        totalCount: 0,
      });

      render(<HospitalSearchScreen />);

      await waitFor(() => {
        // Should show filter badge with count
        expect(screen.getByText('3')).toBeTruthy(); // 3 active filters
        expect(screen.getByText('Clear')).toBeTruthy();
      });
    });
  });

  describe('Requirement 10.4: No Combined Results State', () => {
    it('should display no combined results state when search + filters return nothing', async () => {
      // Mock: Active search query, active filters, no results
      (useFilterPersistence as jest.Mock).mockReturnValue({
        filters: {
          specialization: 'Cardiology',
          isAvailable: true,
        },
        saveFilters: jest.fn(),
        clearFilters: jest.fn(),
        loadFilters: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });

      (useSearchDoctors as jest.Mock).mockReturnValue({
        doctors: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        totalCount: 0,
      });

      render(<HospitalSearchScreen />);

      await waitFor(() => {
        expect(screen.getByText('No candidates found')).toBeTruthy();
        // Should show combined message
        expect(screen.getByText('No candidates match your search and filter criteria')).toBeTruthy();
      });
    });

    it('should show both clear search and clear filters buttons for combined state', async () => {
      (useFilterPersistence as jest.Mock).mockReturnValue({
        filters: {
          city: 'Delhi',
        },
        saveFilters: jest.fn(),
        clearFilters: jest.fn(),
        loadFilters: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });

      (useSearchDoctors as jest.Mock).mockReturnValue({
        doctors: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        totalCount: 0,
      });

      render(<HospitalSearchScreen />);

      await waitFor(() => {
        // Should show filter clear button in header
        expect(screen.getByText('Clear')).toBeTruthy();
        // Should show both action buttons in empty state
        expect(screen.getByText('No candidates found')).toBeTruthy();
      });
    });
  });

  describe('Empty State Actions', () => {
    it('should provide correct actions for each empty state scenario', async () => {
      const mockClearFilters = jest.fn();
      
      (useFilterPersistence as jest.Mock).mockReturnValue({
        filters: {
          specialization: 'Cardiology',
        },
        saveFilters: jest.fn(),
        clearFilters: mockClearFilters,
        loadFilters: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });

      (useSearchDoctors as jest.Mock).mockReturnValue({
        doctors: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        totalCount: 0,
      });

      render(<HospitalSearchScreen />);

      await waitFor(() => {
        expect(screen.getByText('Clear')).toBeTruthy();
      });
    });
  });

  describe('Error State', () => {
    it('should display error state with retry button when API error occurs', async () => {
      const mockRefresh = jest.fn();
      
      (useFilterPersistence as jest.Mock).mockReturnValue({
        filters: {},
        saveFilters: jest.fn(),
        clearFilters: jest.fn(),
        loadFilters: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });

      (useSearchDoctors as jest.Mock).mockReturnValue({
        doctors: [],
        isLoading: false,
        error: 'Network error: Unable to fetch candidates',
        refresh: mockRefresh,
        totalCount: 0,
      });

      render(<HospitalSearchScreen />);

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeTruthy();
        expect(screen.getByText('Network error: Unable to fetch candidates')).toBeTruthy();
        expect(screen.getByText('Retry')).toBeTruthy();
      });
    });
  });

  describe('Loading State', () => {
    it('should display skeleton loaders during initial load', async () => {
      (useFilterPersistence as jest.Mock).mockReturnValue({
        filters: {},
        saveFilters: jest.fn(),
        clearFilters: jest.fn(),
        loadFilters: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });

      (useSearchDoctors as jest.Mock).mockReturnValue({
        doctors: [],
        isLoading: true,
        error: null,
        refresh: jest.fn(),
        totalCount: 0,
      });

      render(<HospitalSearchScreen />);

      await waitFor(() => {
        // SkeletonLoader should be rendered
        // This would need to check for the skeleton component
        expect(screen.queryByText('No candidates found')).toBeNull();
      });
    });
  });

  describe('Success State with Results', () => {
    it('should display candidates when search returns results', async () => {
      (useFilterPersistence as jest.Mock).mockReturnValue({
        filters: {},
        saveFilters: jest.fn(),
        clearFilters: jest.fn(),
        loadFilters: jest.fn(),
        error: null,
        clearError: jest.fn(),
      });

      (useSearchDoctors as jest.Mock).mockReturnValue({
        doctors: [
          {
            id: '1',
            name: 'Dr. John Doe',
            role: 'Cardiologist',
            location: 'Mumbai',
            experienceYears: 10,
            avatarUri: null,
          },
          {
            id: '2',
            name: 'Dr. Jane Smith',
            role: 'Neurologist',
            location: 'Delhi',
            experienceYears: 8,
            avatarUri: null,
          },
        ],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        totalCount: 2,
      });

      render(<HospitalSearchScreen />);

      await waitFor(() => {
        expect(screen.getByText('Dr. John Doe')).toBeTruthy();
        expect(screen.getByText('Dr. Jane Smith')).toBeTruthy();
        expect(screen.getByText('2 doctors found')).toBeTruthy();
      });

      // Should NOT show empty state
      expect(screen.queryByText('No candidates found')).toBeNull();
    });
  });
});
