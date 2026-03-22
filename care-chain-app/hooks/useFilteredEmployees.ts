import { useMemo } from 'react';
import type { Employee } from './useHospital';

/**
 * Parameters for filtering hospital employee listings
 */
export interface FilteredEmployeesParams {
  employees: Employee[];
  searchQuery: string;
  activeTab: 'Employees' | 'Schedule' | 'Leave';
}

/**
 * Result interface for the useFilteredEmployees hook
 */
export interface FilteredEmployeesResult {
  filteredEmployees: Employee[];
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
 * Checks if an employee matches the search query
 * 
 * @param employee - The employee to check
 * @param normalizedQuery - The normalized search query
 * @returns True if the employee matches the search query
 */
function matchesSearchQuery(employee: Employee, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  
  const nameMatch = employee.doctor.fullName.toLowerCase().includes(normalizedQuery);
  const roleMatch = employee.doctor.specialization?.toLowerCase().includes(normalizedQuery) || false;
  
  return nameMatch || roleMatch;
}

/**
 * Hook for client-side filtering of hospital employee listings
 * 
 * Provides efficient client-side filtering for hospital employee listings with memoization
 * to prevent unnecessary recalculations. Filters by search query across employee name and role.
 * 
 * @param params - Filter parameters including employees array, search query, and active tab
 * @returns Filtered employees and empty state indicator
 * 
 * @example
 * const { filteredEmployees, isEmpty } = useFilteredEmployees({
 *   employees: allEmployees,
 *   searchQuery: 'john',
 *   activeTab: 'Employees'
 * });
 */
export function useFilteredEmployees(params: FilteredEmployeesParams): FilteredEmployeesResult {
  const { employees, searchQuery, activeTab } = params;
  
  return useMemo(() => {
    // Normalize search query
    const normalizedQuery = normalizeQuery(searchQuery);
    
    // Filter by search query
    const searchFiltered = normalizedQuery
      ? employees.filter(emp => matchesSearchQuery(emp, normalizedQuery))
      : employees;
    
    return {
      filteredEmployees: searchFiltered,
      isEmpty: searchFiltered.length === 0
    };
  }, [employees, searchQuery, activeTab]);
}
