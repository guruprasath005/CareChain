/**
 * Search and Filter Type Definitions
 * 
 * This file contains TypeScript interfaces for search and filter functionality
 * across the care-chain application.
 */

/**
 * Search query state for managing search input
 */
export interface SearchState {
  query: string;              // Current search input
  debouncedQuery: string;     // Debounced query for API calls
  isSearching: boolean;       // Loading state
}

/**
 * Filter state for doctor job search
 */
export interface DoctorFilterState {
  specialization?: string;     // Selected specialization
  location?: string;           // Selected location
  jobType?: string;            // 'full_time' | 'part_time' | ''
  salaryMin?: number;          // Minimum salary
  salaryMax?: number;          // Maximum salary
}

/**
 * Filter state for hospital job listings (client-side)
 */
export interface HospitalJobFilterState {
  searchQuery: string;         // Search text
  activeTab: 'Opened' | 'Expired' | 'Trash';
}

/**
 * Filter state for hospital employee listings (client-side)
 */
export interface HospitalEmployeeFilterState {
  searchQuery: string;         // Search text
  activeTab: 'Employees' | 'Schedule' | 'Leave';
}

/**
 * Search result metadata
 */
export interface SearchMetadata {
  totalCount: number;          // Total results matching query
  hasMore: boolean;            // Whether more results available
  isLoading: boolean;          // Loading state
  error: string | null;        // Error message if any
}

/**
 * Generic filter state (reusable)
 */
export interface FilterState {
  // Doctor job filters
  specialization?: string;
  location?: string;
  jobType?: string;
  salaryMin?: number;
  salaryMax?: number;

  // Hospital candidate filters
  city?: string;
  state?: string;
  minExperience?: number;
  maxExperience?: number;
  skills?: string[];
  isAvailable?: boolean;

  // Hospital job filters
  status?: string;
  datePosted?: string;
  minApplicants?: number;
  maxApplicants?: number;
}

/**
 * Search job parameters for API calls
 */
export interface SearchJobsParams {
  search?: string;
  specialization?: string;
  location?: string;
  jobType?: string;
  salaryMin?: number;
  salaryMax?: number;
  limit?: number;
  page?: number;
}

/**
 * Filtered jobs parameters for client-side filtering
 */
export interface FilteredJobsParams {
  searchQuery: string;
  activeTab: 'Opened' | 'Expired' | 'Trash';
}

/**
 * Filtered employees parameters for client-side filtering
 */
export interface FilteredEmployeesParams {
  searchQuery: string;
  activeTab: 'Employees' | 'Schedule' | 'Leave';
}
