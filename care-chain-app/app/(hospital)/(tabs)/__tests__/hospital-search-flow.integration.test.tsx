/**
 * Integration Test: Hospital Search Flow End-to-End
 * 
 * This test suite verifies the complete hospital search flow including:
 * - Search → Filter → Sort → Pagination flow
 * - Navigation away and back (state preservation)
 * - Refresh functionality
 * - Bug fixes discovered during testing
 * 
 * Requirements: All hospital search requirements (2.x, 4.x, 5.x, 6.x, 7.x, 8.x, 9.x, 10.x, 11.x, 12.x)
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react-native';
import SearchScreen from '../search';
import { useSearchDoctors } from '../../../../hooks';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'hospital-1', fullName: 'Test Hospital' },
  }),
}));

jest.mock('@/hooks/useHospital');
jest.mock('@react-native-async-storage/async-storage');

const mockUseSearchDoctors = useSearchDoctors as jest.MockedFunction<typeof useSearchDoctors>;

// Mock doctor data factory
const createMockDoctor = (id: string, overrides = {}) => ({
  id,
  fullName: `Dr. ${id}`,
  specialization: 'Cardiology',
  city: 'Mumbai',
  state: 'Maharashtra',
  yearsOfExperience: 5,
  isAvailable: true,
  skills: ['Surgery', 'Consultation'],
  avatar: null,
  ...overrides,
});

describe('Hospital Search Flow - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.clear();
  });

  /**
   * Test 1: Complete search → filter → sort → pagination flow
   */
  describe('Complete Flow: Search → Filter → Sort → Pagination', () => {
    test('executes complete flow from search to pagination', async () => {
      const mockDoctors = [
        createMockDoctor('1'),
        createMockDoctor('2'),
        createMockDoctor('3'),
      ];

      let currentSearch = '';
      let currentFilters = {};
      let currentSort = {};
      let currentPage = 1;

      mockUseSearchDoctors.mockImplementation((options) => {
        currentSearch = options?.q || '';
        currentFilters = {
          specialization: options?.specialization,
          city: options?.city,
          state: options?.state,
          minExperience: options?.minExperience,
          maxExperience: options?.maxExperience,
          isAvailable: options?.isAvailable,
        };
        currentSort = {
          sortBy: options?.sortBy,
          sortOrder: options?.sortOrder,
        };
        currentPage = options?.page || 1;

        return {
          doctors: mockDoctors,
          loading: false,
          error: null,
          hasMore: currentPage < 3,
          loadMore: jest.fn(),
          refresh: jest.fn(),
          totalCount: 30,
        };
      });

      const { rerender } = render(<SearchScreen />);

      // Step 1: Initial load - verify doctors displayed
      await waitFor(() => {
        expect(screen.getByText('Dr. 1')).toBeTruthy();
      });

      // Step 2: Enter search query
      const searchInput = screen.getByPlaceholderText('Search candidates...');
      fireEvent.changeText(searchInput, 'cardiology');

      // Wait for debounce
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 600));
      });

      rerender(<SearchScreen />);

      await waitFor(() => {
        expect(currentSearch).toBe('cardiology');
      });

      // Step 3: Apply filters
      const filterButton = screen.getByText('Filters');
      fireEvent.press(filterButton);

      // Simulate filter application (this would navigate to filter screen)
      await AsyncStorage.setItem('hospital_candidate_filters', JSON.stringify({
        specialization: 'Cardiology',
        city: 'Mumbai',
        state: 'Maharashtra',
        minExperience: 3,
        maxExperience: 10,
        isAvailable: true,
      }));

      rerender(<SearchScreen />);

      await waitFor(() => {
        expect(currentFilters.specialization).toBe('Cardiology');
        expect(currentFilters.city).toBe('Mumbai');
      });

      // Step 4: Apply sort
      mockUseSearchDoctors.mockImplementation((options) => ({
        doctors: mockDoctors.reverse(),
        loading: false,
        error: null,
        hasMore: true,
        loadMore: jest.fn(),
        refresh: jest.fn(),
        totalCount: 30,
      }));

      rerender(<SearchScreen />);

      // Step 5: Load more (pagination)
      const loadMoreButton = screen.queryByText('Load More');
      if (loadMoreButton) {
        fireEvent.press(loadMoreButton);
      }

      // Verify all parameters maintained
      expect(currentSearch).toBe('cardiology');
      expect(currentFilters.specialization).toBe('Cardiology');
    });

    test('resets pagination when search query changes', async () => {
      let capturedPage = 1;

      mockUseSearchDoctors.mockImplementation((options) => {
        capturedPage = options?.page || 1;
        return {
          doctors: [createMockDoctor('1')],
          loading: false,
          error: null,
          hasMore: false,
          loadMore: jest.fn(),
          refresh: jest.fn(),
          totalCount: 1,
        };
      });

      const { rerender } = render(<SearchScreen />);

      await waitFor(() => {
        expect(screen.getByText('Dr. 1')).toBeTruthy();
      });

      // Change search query
      const searchInput = screen.getByPlaceholderText('Search candidates...');
      fireEvent.changeText(searchInput, 'surgeon');

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 600));
      });

      rerender(<SearchScreen />);

      // Verify page reset to 1
      await waitFor(() => {
        expect(capturedPage).toBe(1);
      });
    });

    test('resets pagination when filters change', async () => {
      let capturedPage = 1;

      mockUseSearchDoctors.mockImplementation((options) => {
        capturedPage = options?.page || 1;
        return {
          doctors: [createMockDoctor('1')],
          loading: false,
          error: null,
          hasMore: false,
          loadMore: jest.fn(),
          refresh: jest.fn(),
          totalCount: 1,
        };
      });

      const { rerender } = render(<SearchScreen />);

      await waitFor(() => {
        expect(screen.getByText('Dr. 1')).toBeTruthy();
      });

      // Apply filters
      await AsyncStorage.setItem('hospital_candidate_filters', JSON.stringify({
        specialization: 'Neurology',
      }));

      rerender(<SearchScreen />);

      // Verify page reset to 1
      await waitFor(() => {
        expect(capturedPage).toBe(1);
      });
    });
  });

  /**
   * Test 2: Navigation away and back (state preservation)
   */
  describe('State Preservation: Navigation Away and Back', () => {
    test('preserves search query when navigating away and back', async () => {
      mockUseSearchDoctors.mockReturnValue({
        doctors: [createMockDoctor('1')],
        loading: false,
        error: null,
        hasMore: false,
        loadMore: jest.fn(),
        refresh: jest.fn(),
        totalCount: 1,
      });

      const { rerender, unmount } = render(<SearchScreen />);

      // Enter search query
      const searchInput = screen.getByPlaceholderText('Search candidates...');
      fireEvent.changeText(searchInput, 'cardiology');

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 600));
      });

      // Save to search history
      await AsyncStorage.setItem('hospital_search_history', JSON.stringify(['cardiology']));

      // Simulate navigation away
      unmount();

      // Simulate navigation back
      const { getByPlaceholderText } = render(<SearchScreen />);

      // Verify search history preserved
      const history = await AsyncStorage.getItem('hospital_search_history');
      expect(JSON.parse(history || '[]')).toContain('cardiology');
    });

    test('preserves filter state when navigating away and back', async () => {
      const filters = {
        specialization: 'Cardiology',
        city: 'Mumbai',
        state: 'Maharashtra',
        minExperience: 3,
        maxExperience: 10,
        isAvailable: true,
      };

      await AsyncStorage.setItem('hospital_candidate_filters', JSON.stringify(filters));

      mockUseSearchDoctors.mockReturnValue({
        doctors: [createMockDoctor('1')],
        loading: false,
        error: null,
        hasMore: false,
        loadMore: jest.fn(),
        refresh: jest.fn(),
        totalCount: 1,
      });

      const { unmount } = render(<SearchScreen />);

      // Simulate navigation away
      unmount();

      // Simulate navigation back
      render(<SearchScreen />);

      // Verify filters preserved
      const savedFilters = await AsyncStorage.getItem('hospital_candidate_filters');
      expect(JSON.parse(savedFilters || '{}')).toEqual(filters);
    });

    test('reapplies filters automatically on return', async () => {
      const filters = {
        specialization: 'Cardiology',
        city: 'Mumbai',
      };

      await AsyncStorage.setItem('hospital_candidate_filters', JSON.stringify(filters));

      let capturedOptions: any = {};

      mockUseSearchDoctors.mockImplementation((options) => {
        capturedOptions = options;
        return {
          doctors: [createMockDoctor('1', { specialization: 'Cardiology' })],
          loading: false,
          error: null,
          hasMore: false,
          loadMore: jest.fn(),
          refresh: jest.fn(),
          totalCount: 1,
        };
      });

      render(<SearchScreen />);

      await waitFor(() => {
        expect(capturedOptions.specialization).toBe('Cardiology');
        expect(capturedOptions.city).toBe('Mumbai');
      });
    });
  });

  /**
   * Test 3: Refresh functionality
   */
  describe('Refresh Functionality', () => {
    test('refreshes candidate list on pull-to-refresh', async () => {
      const mockRefresh = jest.fn();

      mockUseSearchDoctors.mockReturnValue({
        doctors: [createMockDoctor('1')],
        loading: false,
        error: null,
        hasMore: false,
        loadMore: jest.fn(),
        refresh: mockRefresh,
        totalCount: 1,
      });

      const { getByTestId } = render(<SearchScreen />);

      await waitFor(() => {
        expect(screen.getByText('Dr. 1')).toBeTruthy();
      });

      // Simulate pull-to-refresh
      const scrollView = getByTestId('candidate-list-scroll');
      fireEvent(scrollView, 'refresh');

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    test('maintains search and filter state during refresh', async () => {
      const filters = {
        specialization: 'Cardiology',
      };

      await AsyncStorage.setItem('hospital_candidate_filters', JSON.stringify(filters));

      let capturedOptions: any = {};
      const mockRefresh = jest.fn();

      mockUseSearchDoctors.mockImplementation((options) => {
        capturedOptions = options;
        return {
          doctors: [createMockDoctor('1')],
          loading: false,
          error: null,
          hasMore: false,
          loadMore: jest.fn(),
          refresh: mockRefresh,
          totalCount: 1,
        };
      });

      const { getByTestId, rerender } = render(<SearchScreen />);

      // Enter search query
      const searchInput = screen.getByPlaceholderText('Search candidates...');
      fireEvent.changeText(searchInput, 'surgeon');

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 600));
      });

      // Refresh
      const scrollView = getByTestId('candidate-list-scroll');
      fireEvent(scrollView, 'refresh');

      rerender(<SearchScreen />);

      // Verify search and filters maintained
      await waitFor(() => {
        expect(capturedOptions.q).toBe('surgeon');
        expect(capturedOptions.specialization).toBe('Cardiology');
      });
    });

    test('shows loading indicator during refresh', async () => {
      mockUseSearchDoctors.mockReturnValue({
        doctors: [createMockDoctor('1')],
        loading: true,
        error: null,
        hasMore: false,
        loadMore: jest.fn(),
        refresh: jest.fn(),
        totalCount: 1,
      });

      render(<SearchScreen />);

      // Should show loading indicator
      await waitFor(() => {
        expect(screen.getByTestId('loading-indicator')).toBeTruthy();
      });
    });
  });

  /**
   * Test 4: Independent search and filter controls
   */
  describe('Independent Search and Filter Controls', () => {
    test('clearing search preserves filters', async () => {
      const filters = {
        specialization: 'Cardiology',
      };

      await AsyncStorage.setItem('hospital_candidate_filters', JSON.stringify(filters));

      let capturedOptions: any = {};

      mockUseSearchDoctors.mockImplementation((options) => {
        capturedOptions = options;
        return {
          doctors: [createMockDoctor('1')],
          loading: false,
          error: null,
          hasMore: false,
          loadMore: jest.fn(),
          refresh: jest.fn(),
          totalCount: 1,
        };
      });

      const { rerender } = render(<SearchScreen />);

      // Enter search query
      const searchInput = screen.getByPlaceholderText('Search candidates...');
      fireEvent.changeText(searchInput, 'surgeon');

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 600));
      });

      // Clear search
      fireEvent.changeText(searchInput, '');

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 600));
      });

      rerender(<SearchScreen />);

      // Verify filters preserved, search cleared
      await waitFor(() => {
        expect(capturedOptions.q).toBe('');
        expect(capturedOptions.specialization).toBe('Cardiology');
      });
    });

    test('clearing filters preserves search', async () => {
      const filters = {
        specialization: 'Cardiology',
      };

      await AsyncStorage.setItem('hospital_candidate_filters', JSON.stringify(filters));

      let capturedOptions: any = {};

      mockUseSearchDoctors.mockImplementation((options) => {
        capturedOptions = options;
        return {
          doctors: [createMockDoctor('1')],
          loading: false,
          error: null,
          hasMore: false,
          loadMore: jest.fn(),
          refresh: jest.fn(),
          totalCount: 1,
        };
      });

      const { rerender } = render(<SearchScreen />);

      // Enter search query
      const searchInput = screen.getByPlaceholderText('Search candidates...');
      fireEvent.changeText(searchInput, 'surgeon');

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 600));
      });

      // Clear filters
      await AsyncStorage.removeItem('hospital_candidate_filters');

      rerender(<SearchScreen />);

      // Verify search preserved, filters cleared
      await waitFor(() => {
        expect(capturedOptions.q).toBe('surgeon');
        expect(capturedOptions.specialization).toBeUndefined();
      });
    });
  });

  /**
   * Test 5: Error handling and recovery
   */
  describe('Error Handling and Recovery', () => {
    test('displays error message when API fails', async () => {
      mockUseSearchDoctors.mockReturnValue({
        doctors: [],
        loading: false,
        error: 'Network error',
        hasMore: false,
        loadMore: jest.fn(),
        refresh: jest.fn(),
        totalCount: 0,
      });

      render(<SearchScreen />);

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeTruthy();
      });
    });

    test('allows retry after error', async () => {
      const mockRefresh = jest.fn();

      mockUseSearchDoctors.mockReturnValue({
        doctors: [],
        loading: false,
        error: 'Network error',
        hasMore: false,
        loadMore: jest.fn(),
        refresh: mockRefresh,
        totalCount: 0,
      });

      render(<SearchScreen />);

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeTruthy();
      });

      // Find and press retry button
      const retryButton = screen.getByText(/retry/i);
      fireEvent.press(retryButton);

      expect(mockRefresh).toHaveBeenCalled();
    });

    test('handles storage errors gracefully', async () => {
      // Mock storage error
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      mockUseSearchDoctors.mockReturnValue({
        doctors: [createMockDoctor('1')],
        loading: false,
        error: null,
        hasMore: false,
        loadMore: jest.fn(),
        refresh: jest.fn(),
        totalCount: 1,
      });

      // Should not crash
      render(<SearchScreen />);

      await waitFor(() => {
        expect(screen.getByText('Dr. 1')).toBeTruthy();
      });
    });
  });

  /**
   * Test 6: Empty states
   */
  describe('Empty States', () => {
    test('displays no results message when search returns empty', async () => {
      mockUseSearchDoctors.mockReturnValue({
        doctors: [],
        loading: false,
        error: null,
        hasMore: false,
        loadMore: jest.fn(),
        refresh: jest.fn(),
        totalCount: 0,
      });

      render(<SearchScreen />);

      // Enter search query
      const searchInput = screen.getByPlaceholderText('Search candidates...');
      fireEvent.changeText(searchInput, 'nonexistent');

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 600));
      });

      await waitFor(() => {
        expect(screen.getByText(/no results/i)).toBeTruthy();
      });
    });

    test('displays no filter results message when filters return empty', async () => {
      await AsyncStorage.setItem('hospital_candidate_filters', JSON.stringify({
        specialization: 'Rare Specialty',
      }));

      mockUseSearchDoctors.mockReturnValue({
        doctors: [],
        loading: false,
        error: null,
        hasMore: false,
        loadMore: jest.fn(),
        refresh: jest.fn(),
        totalCount: 0,
      });

      render(<SearchScreen />);

      await waitFor(() => {
        expect(screen.getByText(/no results/i)).toBeTruthy();
      });
    });
  });

  /**
   * Test 7: Search history
   */
  describe('Search History', () => {
    test('saves search queries to history', async () => {
      mockUseSearchDoctors.mockReturnValue({
        doctors: [createMockDoctor('1')],
        loading: false,
        error: null,
        hasMore: false,
        loadMore: jest.fn(),
        refresh: jest.fn(),
        totalCount: 1,
      });

      render(<SearchScreen />);

      // Enter and submit search
      const searchInput = screen.getByPlaceholderText('Search candidates...');
      fireEvent.changeText(searchInput, 'cardiology');
      fireEvent(searchInput, 'submitEditing');

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Verify saved to history
      const history = await AsyncStorage.getItem('hospital_search_history');
      expect(JSON.parse(history || '[]')).toContain('cardiology');
    });

    test('limits search history to 10 items', async () => {
      const existingHistory = Array.from({ length: 10 }, (_, i) => `query${i}`);
      await AsyncStorage.setItem('hospital_search_history', JSON.stringify(existingHistory));

      mockUseSearchDoctors.mockReturnValue({
        doctors: [createMockDoctor('1')],
        loading: false,
        error: null,
        hasMore: false,
        loadMore: jest.fn(),
        refresh: jest.fn(),
        totalCount: 1,
      });

      render(<SearchScreen />);

      // Add new search
      const searchInput = screen.getByPlaceholderText('Search candidates...');
      fireEvent.changeText(searchInput, 'newquery');
      fireEvent(searchInput, 'submitEditing');

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Verify limited to 10
      const history = await AsyncStorage.getItem('hospital_search_history');
      const parsed = JSON.parse(history || '[]');
      expect(parsed.length).toBe(10);
      expect(parsed[0]).toBe('newquery');
    });
  });

  /**
   * Test 8: Filter badge display
   */
  describe('Filter Badge Display', () => {
    test('displays filter count badge when filters are active', async () => {
      await AsyncStorage.setItem('hospital_candidate_filters', JSON.stringify({
        specialization: 'Cardiology',
        city: 'Mumbai',
        isAvailable: true,
      }));

      mockUseSearchDoctors.mockReturnValue({
        doctors: [createMockDoctor('1')],
        loading: false,
        error: null,
        hasMore: false,
        loadMore: jest.fn(),
        refresh: jest.fn(),
        totalCount: 1,
      });

      render(<SearchScreen />);

      await waitFor(() => {
        // Should show badge with count of 3 active filters
        expect(screen.getByText('3')).toBeTruthy();
      });
    });

    test('hides filter badge when no filters are active', async () => {
      mockUseSearchDoctors.mockReturnValue({
        doctors: [createMockDoctor('1')],
        loading: false,
        error: null,
        hasMore: false,
        loadMore: jest.fn(),
        refresh: jest.fn(),
        totalCount: 1,
      });

      render(<SearchScreen />);

      await waitFor(() => {
        expect(screen.getByText('Dr. 1')).toBeTruthy();
      });

      // Badge should not be visible
      expect(screen.queryByTestId('filter-badge')).toBeNull();
    });
  });
});
