import { useState, useEffect } from 'react';

/**
 * Options for the useDebounce hook
 */
export interface UseDebounceOptions {
  delay?: number; // Default: 500ms
}

/**
 * Hook that debounces a value, delaying its update until after a specified delay
 * has elapsed since the last time the value changed.
 * 
 * This prevents excessive API calls during rapid user input (e.g., typing in a search field).
 * The debounced value only updates after the user stops typing for the specified delay.
 * 
 * @param value - The value to debounce
 * @param options - Configuration options including delay
 * @returns The debounced value
 * 
 * @example
 * const [searchQuery, setSearchQuery] = useState('');
 * const debouncedQuery = useDebounce(searchQuery, { delay: 500 });
 * 
 * // API call only triggers after user stops typing for 500ms
 * useEffect(() => {
 *   if (debouncedQuery) {
 *     fetchResults(debouncedQuery);
 *   }
 * }, [debouncedQuery]);
 * 
 * Requirements: 1.5, 2.5, 9.1
 */
export function useDebounce<T>(value: T, options?: UseDebounceOptions): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    // Set up a timer that will update the debounced value after the delay
    // If the value changes again before the timer fires, the cleanup function
    // will cancel the previous timer, preventing the update
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, options?.delay || 500);
    
    // Cleanup function: cancel the timer if value changes or component unmounts
    // This ensures only the last value update triggers after the delay period
    return () => clearTimeout(timer);
  }, [value, options?.delay]);
  
  return debouncedValue;
}
