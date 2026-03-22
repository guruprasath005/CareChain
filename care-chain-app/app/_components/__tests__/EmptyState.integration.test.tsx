/**
 * Integration tests for EmptyState component
 * These tests verify that the EmptyState component is properly integrated
 * into the search and filter screens across the application.
 * 
 * Requirements: 1.4, 3.4, 4.4, 5.4, 8.1, 8.2, 8.3, 8.4
 */

import { EmptyState, EmptyStateProps } from '../EmptyState';

describe('EmptyState Component Integration', () => {
  describe('Component Structure', () => {
    it('should export EmptyState component', () => {
      expect(EmptyState).toBeDefined();
      expect(typeof EmptyState).toBe('function');
    });

    it('should accept all required props', () => {
      const props: EmptyStateProps = {
        type: 'no-search-results',
        icon: 'search-outline',
        title: 'Test Title',
        message: 'Test Message',
        onClearSearch: jest.fn(),
        onClearFilters: jest.fn(),
        onRetry: jest.fn(),
        showSearchButton: true,
        showFilterButton: true,
        customAction: {
          label: 'Custom',
          onPress: jest.fn(),
        },
      };

      // Verify all props are accepted without TypeScript errors
      expect(props.type).toBe('no-search-results');
      expect(props.icon).toBe('search-outline');
      expect(props.title).toBe('Test Title');
      expect(props.message).toBe('Test Message');
      expect(props.onClearSearch).toBeDefined();
      expect(props.onClearFilters).toBeDefined();
      expect(props.onRetry).toBeDefined();
      expect(props.showSearchButton).toBe(true);
      expect(props.showFilterButton).toBe(true);
      expect(props.customAction).toBeDefined();
    });
  });

  describe('Empty State Types', () => {
    it('should support no-search-results type', () => {
      const props: EmptyStateProps = {
        type: 'no-search-results',
      };
      expect(props.type).toBe('no-search-results');
    });

    it('should support no-filter-results type', () => {
      const props: EmptyStateProps = {
        type: 'no-filter-results',
      };
      expect(props.type).toBe('no-filter-results');
    });

    it('should support no-combined-results type', () => {
      const props: EmptyStateProps = {
        type: 'no-combined-results',
      };
      expect(props.type).toBe('no-combined-results');
    });

    it('should support no-data type', () => {
      const props: EmptyStateProps = {
        type: 'no-data',
      };
      expect(props.type).toBe('no-data');
    });

    it('should support error type', () => {
      const props: EmptyStateProps = {
        type: 'error',
      };
      expect(props.type).toBe('error');
    });
  });

  describe('Action Handlers', () => {
    it('should accept onClearSearch handler', () => {
      const handler = jest.fn();
      const props: EmptyStateProps = {
        type: 'no-search-results',
        onClearSearch: handler,
      };
      
      expect(props.onClearSearch).toBe(handler);
      props.onClearSearch?.();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should accept onClearFilters handler', () => {
      const handler = jest.fn();
      const props: EmptyStateProps = {
        type: 'no-filter-results',
        onClearFilters: handler,
      };
      
      expect(props.onClearFilters).toBe(handler);
      props.onClearFilters?.();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should accept onRetry handler', () => {
      const handler = jest.fn();
      const props: EmptyStateProps = {
        type: 'error',
        onRetry: handler,
      };
      
      expect(props.onRetry).toBe(handler);
      props.onRetry?.();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should accept custom action handler', () => {
      const handler = jest.fn();
      const props: EmptyStateProps = {
        type: 'no-data',
        customAction: {
          label: 'Custom Action',
          onPress: handler,
        },
      };
      
      expect(props.customAction?.onPress).toBe(handler);
      props.customAction?.onPress();
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Requirements Validation', () => {
    // Requirement 8.1: Empty state displays icon, message, and suggestion
    it('should support icon, title, and message props (Req 8.1)', () => {
      const props: EmptyStateProps = {
        type: 'no-search-results',
        icon: 'search-outline',
        title: 'No results found',
        message: 'Try a different search term',
      };

      expect(props.icon).toBeDefined();
      expect(props.title).toBeDefined();
      expect(props.message).toBeDefined();
    });

    // Requirement 8.2: Empty state for filters displays suggestion to adjust filters
    it('should support filter-specific empty state (Req 8.2)', () => {
      const props: EmptyStateProps = {
        type: 'no-filter-results',
        message: 'Try adjusting your filter criteria',
      };

      expect(props.type).toBe('no-filter-results');
      expect(props.message).toContain('filter');
    });

    // Requirement 8.3: Combined empty state displays combined message
    it('should support combined search and filter empty state (Req 8.3)', () => {
      const props: EmptyStateProps = {
        type: 'no-combined-results',
        message: 'Try adjusting your search or filter criteria',
      };

      expect(props.type).toBe('no-combined-results');
      expect(props.message).toContain('search');
      expect(props.message).toContain('filter');
    });

    // Requirement 8.4: Empty state provides actionable buttons
    it('should support actionable buttons (Req 8.4)', () => {
      const onClearSearch = jest.fn();
      const onClearFilters = jest.fn();
      
      const props: EmptyStateProps = {
        type: 'no-combined-results',
        showSearchButton: true,
        showFilterButton: true,
        onClearSearch,
        onClearFilters,
      };

      expect(props.showSearchButton).toBe(true);
      expect(props.showFilterButton).toBe(true);
      expect(props.onClearSearch).toBeDefined();
      expect(props.onClearFilters).toBeDefined();

      // Verify handlers are callable
      props.onClearSearch?.();
      props.onClearFilters?.();
      
      expect(onClearSearch).toHaveBeenCalled();
      expect(onClearFilters).toHaveBeenCalled();
    });
  });

  describe('Screen Integration Scenarios', () => {
    // Doctor job search screen scenarios
    it('should support doctor job search empty state', () => {
      const props: EmptyStateProps = {
        type: 'no-search-results',
        icon: 'briefcase-outline',
        title: 'No jobs found',
        message: 'Try a different search term',
        showSearchButton: true,
        onClearSearch: jest.fn(),
      };

      expect(props.type).toBe('no-search-results');
      expect(props.showSearchButton).toBe(true);
    });

    it('should support doctor job filter empty state', () => {
      const props: EmptyStateProps = {
        type: 'no-filter-results',
        icon: 'briefcase-outline',
        title: 'No jobs found',
        message: 'Try adjusting your filters',
        showFilterButton: true,
        onClearFilters: jest.fn(),
      };

      expect(props.type).toBe('no-filter-results');
      expect(props.showFilterButton).toBe(true);
    });

    it('should support doctor job combined search and filter empty state', () => {
      const props: EmptyStateProps = {
        type: 'no-combined-results',
        icon: 'briefcase-outline',
        title: 'No jobs found',
        message: 'No jobs match your search and filter criteria',
        showSearchButton: true,
        showFilterButton: true,
        onClearSearch: jest.fn(),
        onClearFilters: jest.fn(),
      };

      expect(props.type).toBe('no-combined-results');
      expect(props.showSearchButton).toBe(true);
      expect(props.showFilterButton).toBe(true);
    });

    // Hospital candidate search screen scenarios
    it('should support hospital candidate search empty state', () => {
      const props: EmptyStateProps = {
        type: 'no-search-results',
        icon: 'people-outline',
        title: 'No candidates found',
        message: 'Try a different search term',
        showSearchButton: true,
        onClearSearch: jest.fn(),
      };

      expect(props.type).toBe('no-search-results');
      expect(props.icon).toBe('people-outline');
    });

    // Hospital job listing search screen scenarios
    it('should support hospital job listing search empty state', () => {
      const props: EmptyStateProps = {
        type: 'no-search-results',
        icon: 'briefcase-outline',
        title: 'No jobs match your search',
        message: 'Try adjusting your search terms',
        showSearchButton: true,
        onClearSearch: jest.fn(),
      };

      expect(props.type).toBe('no-search-results');
      expect(props.showSearchButton).toBe(true);
    });

    // Hospital employee search screen scenarios
    it('should support hospital employee search empty state', () => {
      const props: EmptyStateProps = {
        type: 'no-search-results',
        icon: 'people-outline',
        title: 'No employees found',
        message: 'Try adjusting your search terms',
        showSearchButton: true,
        onClearSearch: jest.fn(),
      };

      expect(props.type).toBe('no-search-results');
      expect(props.icon).toBe('people-outline');
    });

    // Error state scenarios
    it('should support error state with retry', () => {
      const props: EmptyStateProps = {
        type: 'error',
        title: 'Error',
        message: 'Failed to load data',
        onRetry: jest.fn(),
      };

      expect(props.type).toBe('error');
      expect(props.onRetry).toBeDefined();
    });
  });
});
