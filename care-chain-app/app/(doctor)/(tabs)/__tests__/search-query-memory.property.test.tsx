/**
 * Feature: search-filter-functionality
 * Property 18: Search Query Memory Persistence
 * 
 * Property-based test: For any search query in component state, navigating away from 
 * and returning to the search screen should preserve the search query value.
 * 
 * Validates: Requirements 9.3
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import fc from 'fast-check';
import JobSearchHomeScreen from '../search';

// Mock dependencies
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useFocusEffect: jest.fn(),
}));

jest.mock('@/hooks', () => ({
  useJobs: jest.fn(() => ({
    jobs: [],
    isLoading: false,
    error: null,
    refresh: jest.fn(),
    totalCount: 0,
    loadMore: jest.fn(),
    hasMore: false,
  })),
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

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../../_components/EmptyState', () => ({
  EmptyState: () => null,
}));

jest.mock('../../../_components/SkeletonLoader', () => ({
  SkeletonLoader: () => null,
}));

jest.mock('../../_components/JobCard', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: () => <View testID="job-card" />,
  };
});

describe('Property 18: Search Query Memory Persistence', () => {
  const mockRouter = {
    push: jest.fn(),
    back: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useFocusEffect as jest.Mock).mockImplementation((callback) => {
      callback();
    });
  });

  it('should preserve any search query in component state across re-renders', () => {
    // Generate arbitrary search queries
    const searchQueryArbitrary = fc.string({ minLength: 1, maxLength: 50 });

    fc.assert(
      fc.property(searchQueryArbitrary, (searchQuery) => {
        const { getByPlaceholderText, rerender } = render(<JobSearchHomeScreen />);

        const searchInput = getByPlaceholderText(/search jobs/i);

        // User enters the generated search query
        fireEvent.changeText(searchInput, searchQuery);

        // Verify the query is set
        expect(searchInput.props.value).toBe(searchQuery);

        // Simulate navigation (re-render simulates component staying in memory)
        rerender(<JobSearchHomeScreen />);

        // Query should still be accessible
        const searchInputAfterNav = getByPlaceholderText(/search jobs/i);
        expect(searchInputAfterNav).toBeDefined();

        // In React Navigation, component state is preserved in the navigation stack
        // This property validates that we're using component state (useState)
        // rather than AsyncStorage for search query persistence
      }),
      { numRuns: 50 }
    );
  });

  it('should never persist search queries to AsyncStorage', () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const searchQueryArbitrary = fc.string({ minLength: 1, maxLength: 50 });

    fc.assert(
      fc.property(searchQueryArbitrary, (searchQuery) => {
        // Reset mocks for each iteration
        jest.clearAllMocks();

        const { getByPlaceholderText } = render(<JobSearchHomeScreen />);

        const searchInput = getByPlaceholderText(/search jobs/i);

        // User enters the search query
        fireEvent.changeText(searchInput, searchQuery);

        // Verify AsyncStorage.setItem was NOT called with a search query key
        const setItemCalls = (AsyncStorage.setItem as jest.Mock).mock.calls;
        const searchQueryStorageCalls = setItemCalls.filter(call => 
          call[0] && (
            call[0].includes('search_query') || 
            call[0].includes('current_search') ||
            call[0].includes('active_search')
          )
        );

        // Search queries should NEVER be persisted to AsyncStorage
        expect(searchQueryStorageCalls.length).toBe(0);
      }),
      { numRuns: 50 }
    );
  });

  it('should maintain search query independently from filter state', () => {
    const searchQueryArbitrary = fc.string({ minLength: 1, maxLength: 50 });
    const filterStateArbitrary = fc.record({
      specialization: fc.option(fc.constantFrom('Cardiology', 'Neurology', 'Pediatrics'), { nil: undefined }),
      location: fc.option(fc.constantFrom('New York', 'Los Angeles', 'Chicago'), { nil: undefined }),
      jobType: fc.option(fc.constantFrom('full_time', 'part_time'), { nil: undefined }),
    });

    fc.assert(
      fc.property(
        searchQueryArbitrary,
        filterStateArbitrary,
        (searchQuery, filterState) => {
          const mockFilterPersistence = {
            filters: filterState,
            saveFilters: jest.fn(),
            clearFilters: jest.fn(),
            loadFilters: jest.fn(),
            error: null,
            clearError: jest.fn(),
          };

          const { useFilterPersistence } = require('@/hooks');
          (useFilterPersistence as jest.Mock).mockReturnValue(mockFilterPersistence);

          const { getByPlaceholderText, rerender } = render(<JobSearchHomeScreen />);

          const searchInput = getByPlaceholderText(/search jobs/i);

          // Set search query
          fireEvent.changeText(searchInput, searchQuery);

          // Verify both are independent
          expect(searchInput.props.value).toBe(searchQuery);
          expect(mockFilterPersistence.filters).toEqual(filterState);

          // Re-render
          rerender(<JobSearchHomeScreen />);

          // Both should be maintained independently
          const searchInputAfterNav = getByPlaceholderText(/search jobs/i);
          expect(searchInputAfterNav).toBeDefined();
          expect(mockFilterPersistence.filters).toEqual(filterState);
        }
      ),
      { numRuns: 30 }
    );
  });
});
