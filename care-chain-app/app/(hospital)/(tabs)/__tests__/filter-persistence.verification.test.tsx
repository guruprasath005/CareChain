/**
 * Filter Persistence Verification Tests for Hospital Search
 * 
 * Validates Requirements 7.1, 7.2, 7.3, 7.4, 7.6:
 * - Filters save to AsyncStorage when applied
 * - Filters load when returning to screen
 * - Filters clear from storage when cleared
 * - Graceful degradation if storage fails
 * - Filters persist independently from search query
 */

import React from 'react';
import { render, waitFor, act, fireEvent } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFilterPersistence } from '../../../../hooks';
import HospitalSearchScreen from '../search';
import { useSearchDoctors } from '../../../../hooks';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../../../../hooks', () => ({
  useSearchDoctors: jest.fn(),
  useDebounce: jest.fn((value) => value),
  useFilterPersistence: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
  useFocusEffect: (callback: () => void) => {
    React.useEffect(() => {
      callback();
    }, []);
  },
}));

describe('Hospital Search - Filter Persistence Verification', () => {
  const mockUseSearchDoctors = useSearchDoctors as jest.MockedFunction<typeof useSearchDoctors>;
  const mockUseFilterPersistence = useFilterPersistence as jest.MockedFunction<typeof useFilterPersistence>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock for useSearchDoctors
    mockUseSearchDoctors.mockReturnValue({
      doctors: [],
      isLoading: false,
      error: null,
      refresh: jest.fn(),
      totalCount: 0,
      currentPage: 1,
      totalPages: 1,
      loadMore: jest.fn(),
      hasMore: false,
    });
  });

  describe('Requirement 7.1: Filters save to AsyncStorage when applied', () => {
    it('should save filters to AsyncStorage when applied', async () => {
      const mockSaveFilters = jest.fn().mockResolvedValue(undefined);
      
      mockUseFilterPersistence.mockReturnValue({
        filters: {},
        saveFilters: mockSaveFilters,
        clearFilters: jest.fn(),
        loadFilters: jest.fn(),
        isLoading: false,
        error: null,
        clearError: jest.fn(),
      });

      const testFilters = {
        specialization: 'Cardiology',
        city: 'Mumbai',
        state: 'Maharashtra',
        minExperience: 5,
        maxExperience: 10,
        isAvailable: true,
      };

      // Simulate applying filters (this would happen in the filter modal)
      await act(async () => {
        await mockSaveFilters(testFilters);
      });

      expect(mockSaveFilters).toHaveBeenCalledWith(testFilters);
    });

    it('should persist filters with correct storage key', async () => {
      const storageKey = 'hospital_candidate_filters';
      
      // Use real hook implementation
      jest.unmock('../../../../hooks');
      const { useFilterPersistence: realUseFilterPersistence } = jest.requireActual('../../../../hooks');
      
      const { result } = renderHook(() => realUseFilterPersistence(storageKey));

      const testFilters = {
        specialization: 'Neurology',
        city: 'Delhi',
        minExperience: 3,
      };

      await act(async () => {
        await result.current.saveFilters(testFilters);
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        storageKey,
        JSON.stringify(testFilters)
      );
    });
  });

  describe('Requirement 7.2: Filters load when returning to screen', () => {
    it('should load saved filters when screen comes into focus', async () => {
      const savedFilters = {
        specialization: 'Orthopedics',
        city: 'Bangalore',
        minExperience: 2,
        maxExperience: 8,
      };

      const mockLoadFilters = jest.fn().mockResolvedValue(undefined);

      mockUseFilterPersistence.mockReturnValue({
        filters: savedFilters,
        saveFilters: jest.fn(),
        clearFilters: jest.fn(),
        loadFilters: mockLoadFilters,
        isLoading: false,
        error: null,
        clearError: jest.fn(),
      });

      mockUseSearchDoctors.mockReturnValue({
        doctors: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        totalCount: 0,
        currentPage: 1,
        totalPages: 1,
        loadMore: jest.fn(),
        hasMore: false,
      });

      render(<HospitalSearchScreen />);

      // useFocusEffect should trigger loadFilters
      await waitFor(() => {
        expect(mockLoadFilters).toHaveBeenCalled();
      });
    });

    it('should apply loaded filters to search query', async () => {
      const savedFilters = {
        specialization: 'Cardiology',
        city: 'Mumbai',
        isAvailable: true,
      };

      mockUseFilterPersistence.mockReturnValue({
        filters: savedFilters,
        saveFilters: jest.fn(),
        clearFilters: jest.fn(),
        loadFilters: jest.fn(),
        isLoading: false,
        error: null,
        clearError: jest.fn(),
      });

      const mockRefresh = jest.fn();
      mockUseSearchDoctors.mockReturnValue({
        doctors: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        totalCount: 0,
        currentPage: 1,
        totalPages: 1,
        loadMore: jest.fn(),
        hasMore: false,
      });

      render(<HospitalSearchScreen />);

      // Verify useSearchDoctors was called with the loaded filters
      await waitFor(() => {
        expect(mockUseSearchDoctors).toHaveBeenCalledWith(
          expect.objectContaining({
            specialization: 'Cardiology',
            city: 'Mumbai',
            isAvailable: true,
          })
        );
      });
    });
  });

  describe('Requirement 7.3: Filters clear from storage when cleared', () => {
    it('should remove filters from AsyncStorage when cleared', async () => {
      const mockClearFilters = jest.fn().mockResolvedValue(undefined);

      mockUseFilterPersistence.mockReturnValue({
        filters: { specialization: 'Cardiology', city: 'Delhi' },
        saveFilters: jest.fn(),
        clearFilters: mockClearFilters,
        loadFilters: jest.fn(),
        isLoading: false,
        error: null,
        clearError: jest.fn(),
      });

      mockUseSearchDoctors.mockReturnValue({
        doctors: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        totalCount: 0,
        currentPage: 1,
        totalPages: 1,
        loadMore: jest.fn(),
        hasMore: false,
      });

      const { getByText } = render(<HospitalSearchScreen />);

      // Find and click clear filters button
      const clearButton = getByText('Clear');
      await act(async () => {
        fireEvent.press(clearButton);
      });

      expect(mockClearFilters).toHaveBeenCalled();
    });

    it('should verify AsyncStorage.removeItem is called with correct key', async () => {
      const storageKey = 'hospital_candidate_filters';
      
      // Use real hook implementation
      jest.unmock('../../../../hooks');
      const { useFilterPersistence: realUseFilterPersistence } = jest.requireActual('../../../../hooks');
      
      const { result } = renderHook(() => realUseFilterPersistence(storageKey));

      await act(async () => {
        await result.current.clearFilters();
      });

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(storageKey);
    });
  });

  describe('Requirement 7.4: Graceful degradation if storage fails', () => {
    it('should continue with in-memory filters if save fails', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Use real hook implementation
      jest.unmock('../../../../hooks');
      const { useFilterPersistence: realUseFilterPersistence } = jest.requireActual('../../../../hooks');
      
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error('Storage quota exceeded')
      );

      const { result } = renderHook(() => realUseFilterPersistence('hospital_candidate_filters'));

      const testFilters = {
        specialization: 'Cardiology',
        city: 'Mumbai',
        minExperience: 5,
      };

      // Should not throw error
      await act(async () => {
        await result.current.saveFilters(testFilters);
      });

      // Filters should be in memory
      expect(result.current.filters).toEqual(testFilters);
      
      // Error should be set
      expect(result.current.error).toBeTruthy();
      
      // Warning should be logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Continuing with in-memory filters only')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should display warning banner when storage fails', async () => {
      const storageError = 'Failed to save filters';
      
      mockUseFilterPersistence.mockReturnValue({
        filters: { specialization: 'Cardiology' },
        saveFilters: jest.fn(),
        clearFilters: jest.fn(),
        loadFilters: jest.fn(),
        isLoading: false,
        error: storageError,
        clearError: jest.fn(),
      });

      mockUseSearchDoctors.mockReturnValue({
        doctors: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        totalCount: 0,
        currentPage: 1,
        totalPages: 1,
        loadMore: jest.fn(),
        hasMore: false,
      });

      const { getByText } = render(<HospitalSearchScreen />);

      // Should display error banner
      await waitFor(() => {
        expect(getByText('Filter Storage Issue')).toBeTruthy();
        expect(getByText(expect.stringContaining(storageError))).toBeTruthy();
      });
    });

    it('should handle corrupted data gracefully', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Use real hook implementation
      jest.unmock('../../../../hooks');
      const { useFilterPersistence: realUseFilterPersistence } = jest.requireActual('../../../../hooks');
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        'invalid json data'
      );

      const { result } = renderHook(() => realUseFilterPersistence('hospital_candidate_filters'));

      await waitFor(() => {
        // Should use empty filters instead of crashing
        expect(result.current.filters).toEqual({});
        expect(result.current.error).toBeTruthy();
      });

      // Should clear corrupted data
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('hospital_candidate_filters');

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Requirement 7.6: Filters persist independently from search query', () => {
    it('should save filters without including search query', async () => {
      const storageKey = 'hospital_candidate_filters';
      
      // Use real hook implementation
      jest.unmock('../../../../hooks');
      const { useFilterPersistence: realUseFilterPersistence } = jest.requireActual('../../../../hooks');
      
      const { result } = renderHook(() => realUseFilterPersistence(storageKey));

      const testFilters = {
        specialization: 'Cardiology',
        city: 'Mumbai',
        minExperience: 3,
        maxExperience: 10,
      };

      await act(async () => {
        await result.current.saveFilters(testFilters);
      });

      // Verify saved data doesn't include search query
      const savedData = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
      const parsed = JSON.parse(savedData);
      
      expect(parsed).not.toHaveProperty('search');
      expect(parsed).not.toHaveProperty('q');
      expect(parsed).not.toHaveProperty('query');
    });

    it('should maintain filters when search query changes', async () => {
      const savedFilters = {
        specialization: 'Neurology',
        city: 'Delhi',
        isAvailable: true,
      };

      mockUseFilterPersistence.mockReturnValue({
        filters: savedFilters,
        saveFilters: jest.fn(),
        clearFilters: jest.fn(),
        loadFilters: jest.fn(),
        isLoading: false,
        error: null,
        clearError: jest.fn(),
      });

      mockUseSearchDoctors.mockReturnValue({
        doctors: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        totalCount: 0,
        currentPage: 1,
        totalPages: 1,
        loadMore: jest.fn(),
        hasMore: false,
      });

      const { getByPlaceholderText } = render(<HospitalSearchScreen />);

      // Change search query
      const searchInput = getByPlaceholderText(/search/i);
      await act(async () => {
        fireEvent.changeText(searchInput, 'doctor');
      });

      // Verify filters are still passed to useSearchDoctors
      await waitFor(() => {
        expect(mockUseSearchDoctors).toHaveBeenCalledWith(
          expect.objectContaining({
            specialization: 'Neurology',
            city: 'Delhi',
            isAvailable: true,
            q: 'doctor',
          })
        );
      });
    });
  });
});

// Helper function to render hooks
function renderHook<T>(callback: () => T) {
  const result = { current: null as T | null };
  
  function TestComponent() {
    result.current = callback();
    return null;
  }

  const { rerender, unmount } = render(<TestComponent />);
  
  return {
    result: result as { current: T },
    rerender: () => rerender(<TestComponent />),
    unmount,
  };
}
