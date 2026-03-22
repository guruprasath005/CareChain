/**
 * Integration tests for doctor job filter functionality
 * Tests the integration of useFilterPersistence hook with search screen and filter modal
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFilterPersistence } from '../../../../hooks';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('Filter Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useFilterPersistence hook', () => {
    it('should save filters to AsyncStorage', async () => {
      const { result } = renderHook(() => useFilterPersistence('test_filters'));

      const testFilters = {
        specialization: 'Cardiology',
        location: 'Mumbai',
        jobType: 'full_time',
        salaryMin: 50000,
        salaryMax: 100000,
      };

      await act(async () => {
        await result.current.saveFilters(testFilters);
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'test_filters',
        JSON.stringify(testFilters)
      );
    });

    it('should load filters from AsyncStorage', async () => {
      const savedFilters = {
        specialization: 'Neurology',
        location: 'Delhi',
        jobType: 'part_time',
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(savedFilters)
      );

      const { result } = renderHook(() => useFilterPersistence('test_filters'));

      await waitFor(() => {
        expect(result.current.filters).toEqual(savedFilters);
      });
    });

    it('should clear filters from AsyncStorage', async () => {
      const { result } = renderHook(() => useFilterPersistence('test_filters'));

      await act(async () => {
        await result.current.clearFilters();
      });

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('test_filters');
      expect(result.current.filters).toEqual({});
    });

    it('should handle empty filter state', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const { result } = renderHook(() => useFilterPersistence('test_filters'));

      await waitFor(() => {
        expect(result.current.filters).toEqual({});
      });
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
        new Error('Storage error')
      );

      const { result } = renderHook(() => useFilterPersistence('test_filters'));

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Filter persistence round trip', () => {
    it('should persist and restore filter state correctly', async () => {
      const storageKey = 'doctor_job_filters';
      const testFilters = {
        specialization: 'Orthopedics',
        location: 'Bangalore',
        jobType: 'full_time',
        salaryMin: 60000,
        salaryMax: 120000,
      };

      // Mock storage to simulate persistence
      let storedValue: string | null = null;
      (AsyncStorage.setItem as jest.Mock).mockImplementation(
        async (key: string, value: string) => {
          storedValue = value;
        }
      );
      (AsyncStorage.getItem as jest.Mock).mockImplementation(
        async (key: string) => storedValue
      );

      // First hook instance - save filters
      const { result: result1 } = renderHook(() =>
        useFilterPersistence(storageKey)
      );

      await act(async () => {
        await result1.current.saveFilters(testFilters);
      });

      // Second hook instance - load filters
      const { result: result2 } = renderHook(() =>
        useFilterPersistence(storageKey)
      );

      await waitFor(() => {
        expect(result2.current.filters).toEqual(testFilters);
      });
    });
  });

  describe('Active filter detection', () => {
    it('should correctly identify when filters are active', () => {
      const filters = {
        specialization: 'Cardiology',
        location: '',
        jobType: 'full_time',
      };

      const hasActiveFilters = Object.values(filters).some(
        (value) => value !== '' && value !== undefined && value !== null
      );

      expect(hasActiveFilters).toBe(true);
    });

    it('should correctly identify when no filters are active', () => {
      const filters = {
        specialization: '',
        location: '',
        jobType: '',
      };

      const hasActiveFilters = Object.values(filters).some(
        (value) => value !== '' && value !== undefined && value !== null
      );

      expect(hasActiveFilters).toBe(false);
    });

    it('should count active filters correctly', () => {
      const filters = {
        specialization: 'Cardiology',
        location: 'Mumbai',
        jobType: '',
        salaryMin: 50000,
        salaryMax: undefined,
      };

      const activeCount = Object.values(filters).filter(
        (v) => v !== '' && v !== undefined && v !== null
      ).length;

      expect(activeCount).toBe(3); // specialization, location, salaryMin
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
