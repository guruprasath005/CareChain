import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { EmptyState } from '../EmptyState';

describe('EmptyState Component', () => {
  describe('Empty State Types', () => {
    it('should render no-search-results state with default config', () => {
      const { getByText } = render(
        <EmptyState type="no-search-results" />
      );

      expect(getByText('No results found')).toBeTruthy();
      expect(getByText('Try a different search term or adjust your filters')).toBeTruthy();
    });

    it('should render no-filter-results state with default config', () => {
      const { getByText } = render(
        <EmptyState type="no-filter-results" />
      );

      expect(getByText('No matches found')).toBeTruthy();
      expect(getByText('Try adjusting your filter criteria')).toBeTruthy();
    });

    it('should render no-combined-results state with default config', () => {
      const { getByText } = render(
        <EmptyState type="no-combined-results" />
      );

      expect(getByText('No matches found')).toBeTruthy();
      expect(getByText('Try adjusting your search or filter criteria')).toBeTruthy();
    });

    it('should render no-data state with default config', () => {
      const { getByText } = render(
        <EmptyState type="no-data" />
      );

      expect(getByText('No data available')).toBeTruthy();
      expect(getByText('Check back later')).toBeTruthy();
    });

    it('should render error state with default config', () => {
      const { getByText } = render(
        <EmptyState type="error" />
      );

      expect(getByText('Something went wrong')).toBeTruthy();
      expect(getByText('Please try again')).toBeTruthy();
    });
  });

  describe('Custom Props', () => {
    it('should render custom title and message', () => {
      const { getByText } = render(
        <EmptyState
          type="no-search-results"
          title="Custom Title"
          message="Custom message here"
        />
      );

      expect(getByText('Custom Title')).toBeTruthy();
      expect(getByText('Custom message here')).toBeTruthy();
    });
  });

  describe('Action Buttons', () => {
    it('should render clear search button when showSearchButton is true', () => {
      const onClearSearch = jest.fn();
      const { getByText } = render(
        <EmptyState
          type="no-search-results"
          showSearchButton={true}
          onClearSearch={onClearSearch}
        />
      );

      const clearButton = getByText('Clear Search');
      expect(clearButton).toBeTruthy();
      
      fireEvent.press(clearButton);
      expect(onClearSearch).toHaveBeenCalledTimes(1);
    });

    it('should render clear filters button when showFilterButton is true', () => {
      const onClearFilters = jest.fn();
      const { getByText } = render(
        <EmptyState
          type="no-filter-results"
          showFilterButton={true}
          onClearFilters={onClearFilters}
        />
      );

      const clearButton = getByText('Clear Filters');
      expect(clearButton).toBeTruthy();
      
      fireEvent.press(clearButton);
      expect(onClearFilters).toHaveBeenCalledTimes(1);
    });

    it('should render both clear search and clear filters buttons', () => {
      const onClearSearch = jest.fn();
      const onClearFilters = jest.fn();
      const { getByText } = render(
        <EmptyState
          type="no-combined-results"
          showSearchButton={true}
          showFilterButton={true}
          onClearSearch={onClearSearch}
          onClearFilters={onClearFilters}
        />
      );

      expect(getByText('Clear Search')).toBeTruthy();
      expect(getByText('Clear Filters')).toBeTruthy();
    });

    it('should render retry button for error state', () => {
      const onRetry = jest.fn();
      const { getByText } = render(
        <EmptyState
          type="error"
          onRetry={onRetry}
        />
      );

      const retryButton = getByText('Retry');
      expect(retryButton).toBeTruthy();
      
      fireEvent.press(retryButton);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should render custom action button', () => {
      const customAction = jest.fn();
      const { getByText } = render(
        <EmptyState
          type="no-data"
          customAction={{
            label: 'Custom Action',
            onPress: customAction,
          }}
        />
      );

      const actionButton = getByText('Custom Action');
      expect(actionButton).toBeTruthy();
      
      fireEvent.press(actionButton);
      expect(customAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should not render clear search button when showSearchButton is false', () => {
      const onClearSearch = jest.fn();
      const { queryByText } = render(
        <EmptyState
          type="no-search-results"
          showSearchButton={false}
          onClearSearch={onClearSearch}
        />
      );

      expect(queryByText('Clear Search')).toBeNull();
    });

    it('should not render clear search button when onClearSearch is undefined', () => {
      const { queryByText } = render(
        <EmptyState
          type="no-search-results"
          showSearchButton={true}
        />
      );

      expect(queryByText('Clear Search')).toBeNull();
    });

    it('should not render retry button for non-error states', () => {
      const onRetry = jest.fn();
      const { queryByText } = render(
        <EmptyState
          type="no-search-results"
          onRetry={onRetry}
        />
      );

      expect(queryByText('Retry')).toBeNull();
    });
  });

  describe('Requirements Validation', () => {
    // Requirement 8.1: Empty state displays icon, message, and suggestion
    it('should display icon, message, and suggestion for search results (Req 8.1)', () => {
      const { getByText, UNSAFE_getByType } = render(
        <EmptyState type="no-search-results" />
      );

      // Icon is rendered (Ionicons component)
      expect(UNSAFE_getByType(require('@expo/vector-icons').Ionicons)).toBeTruthy();
      // Message is rendered
      expect(getByText('No results found')).toBeTruthy();
      // Suggestion is rendered
      expect(getByText('Try a different search term or adjust your filters')).toBeTruthy();
    });

    // Requirement 8.2: Empty state for filters displays suggestion to adjust filters
    it('should display suggestion to adjust filters (Req 8.2)', () => {
      const { getByText } = render(
        <EmptyState type="no-filter-results" />
      );

      expect(getByText('Try adjusting your filter criteria')).toBeTruthy();
    });

    // Requirement 8.3: Combined empty state displays combined message
    it('should display combined message for search and filters (Req 8.3)', () => {
      const { getByText } = render(
        <EmptyState type="no-combined-results" />
      );

      expect(getByText('Try adjusting your search or filter criteria')).toBeTruthy();
    });

    // Requirement 8.4: Empty state provides actionable buttons
    it('should provide actionable clear buttons (Req 8.4)', () => {
      const onClearSearch = jest.fn();
      const onClearFilters = jest.fn();
      const { getByText } = render(
        <EmptyState
          type="no-combined-results"
          showSearchButton={true}
          showFilterButton={true}
          onClearSearch={onClearSearch}
          onClearFilters={onClearFilters}
        />
      );

      // Both action buttons are present
      const clearSearchButton = getByText('Clear Search');
      const clearFiltersButton = getByText('Clear Filters');
      
      expect(clearSearchButton).toBeTruthy();
      expect(clearFiltersButton).toBeTruthy();

      // Buttons are actionable
      fireEvent.press(clearSearchButton);
      fireEvent.press(clearFiltersButton);
      
      expect(onClearSearch).toHaveBeenCalled();
      expect(onClearFilters).toHaveBeenCalled();
    });
  });
});
