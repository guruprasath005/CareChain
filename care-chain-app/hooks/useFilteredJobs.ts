import { useMemo } from 'react';
import type { PostedJob } from './useHospital';

/**
 * Parameters for filtering hospital job listings
 */
export interface FilteredJobsParams {
  jobs: PostedJob[];
  searchQuery: string;
  activeTab: 'Opened' | 'Expired' | 'Trash';
}

/**
 * Result interface for the useFilteredJobs hook
 */
export interface FilteredJobsResult {
  filteredJobs: PostedJob[];
  isEmpty: boolean;
}

/**
 * Normalizes a search query by trimming whitespace and converting to lowercase
 * 
 * @param query - The raw search query
 * @returns Normalized query string
 */
function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

/**
 * Checks if a job matches the active tab filter
 * 
 * @param job - The job to check
 * @param activeTab - The active tab filter
 * @returns True if the job matches the tab filter
 */
function matchesTab(job: PostedJob, activeTab: 'Opened' | 'Expired' | 'Trash'): boolean {
  switch (activeTab) {
    case 'Opened':
      return job.status === 'open' || job.status === 'draft' || job.status === 'paused';
    case 'Expired':
      return job.status === 'expired' || job.status === 'closed' || job.status === 'filled';
    case 'Trash':
      return job.status === 'trash' || job.status === 'cancelled';
    default:
      return true;
  }
}

/**
 * Checks if a job matches the search query
 * 
 * @param job - The job to check
 * @param normalizedQuery - The normalized search query
 * @returns True if the job matches the search query
 */
function matchesSearchQuery(job: PostedJob, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  
  const titleMatch = job.title.toLowerCase().includes(normalizedQuery);
  
  return titleMatch;
}

/**
 * Hook for client-side filtering of hospital job listings
 * 
 * Provides efficient client-side filtering for hospital job listings with memoization
 * to prevent unnecessary recalculations. Filters by tab status and search query.
 * 
 * @param params - Filter parameters including jobs array, search query, and active tab
 * @returns Filtered jobs and empty state indicator
 * 
 * @example
 * const { filteredJobs, isEmpty } = useFilteredJobs({
 *   jobs: allJobs,
 *   searchQuery: 'surgeon',
 *   activeTab: 'Opened'
 * });
 */
export function useFilteredJobs(params: FilteredJobsParams): FilteredJobsResult {
  const { jobs, searchQuery, activeTab } = params;
  
  return useMemo(() => {
    // Filter by tab status first
    const tabFiltered = jobs.filter(job => matchesTab(job, activeTab));
    
    // Normalize search query
    const normalizedQuery = normalizeQuery(searchQuery);
    
    // Filter by search query
    const searchFiltered = normalizedQuery
      ? tabFiltered.filter(job => matchesSearchQuery(job, normalizedQuery))
      : tabFiltered;
    
    return {
      filteredJobs: searchFiltered,
      isEmpty: searchFiltered.length === 0
    };
  }, [jobs, searchQuery, activeTab]);
}
