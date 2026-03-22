import { useRef, useCallback } from 'react';

/**
 * Hook for optimizing API calls by preventing duplicate requests
 * and canceling pending requests when parameters change.
 * 
 * This hook provides three key optimizations:
 * 1. Duplicate Prevention: Skips API calls if parameters haven't changed
 * 2. Request Cancellation: Cancels pending requests when new parameters arrive
 * 3. In-Progress Tracking: Prevents multiple simultaneous requests
 * 
 * Requirements: 9.2, 9.3
 */
export function useApiOptimization<T extends Record<string, any>>() {
  // Cache last query parameters to detect changes (Requirement 9.2)
  // Stores JSON stringified version of parameters for comparison
  const lastQueryRef = useRef<string>('');
  
  // Track pending request controller for cancellation (Requirement 9.3)
  // AbortController allows us to cancel fetch requests mid-flight
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Track if a request is currently in progress
  // Prevents duplicate simultaneous requests for the same parameters
  const isRequestInProgressRef = useRef<boolean>(false);

  /**
   * Compare query parameters to detect actual changes
   * 
   * Converts parameters to JSON string for deep comparison.
   * Returns true if parameters have changed since last request.
   * 
   * @param params - Current query parameters
   * @returns true if parameters changed, false otherwise
   */
  const hasQueryChanged = useCallback((params: T): boolean => {
    const currentQuery = JSON.stringify(params);
    const changed = lastQueryRef.current !== currentQuery;
    return changed;
  }, []);

  /**
   * Check if parameters are unchanged from last request (Requirement 9.2)
   * 
   * This prevents duplicate API calls when the same search/filter parameters
   * are used multiple times. For example, if a user navigates away and back
   * to a search screen, we don't need to refetch the same data.
   * 
   * @param params - Current query parameters
   * @returns true if request should be skipped (parameters unchanged)
   */
  const shouldSkipRequest = useCallback((params: T): boolean => {
    const currentQuery = JSON.stringify(params);
    
    // Skip if parameters are unchanged (Requirement 9.2)
    if (lastQueryRef.current === currentQuery) {
      return true;
    }
    
    return false;
  }, []);

  /**
   * Cancel any pending request (Requirement 9.3)
   * 
   * When search/filter parameters change, we need to cancel any in-flight
   * requests to prevent race conditions where an old request completes
   * after a new one, overwriting the correct results with stale data.
   */
  const cancelPendingRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * Prepare for a new API request (Requirement 9.3)
   * 
   * This function:
   * 1. Cancels any pending requests if parameters changed
   * 2. Creates a new AbortController for the new request
   * 3. Updates the cached parameters
   * 4. Marks request as in progress
   * 
   * @param params - Query parameters for the new request
   * @returns AbortSignal to pass to fetch() for cancellation support
   */
  const prepareRequest = useCallback((params: T): AbortSignal => {
    const currentQuery = JSON.stringify(params);
    
    // Cancel pending request if parameters changed (Requirement 9.3)
    // This prevents race conditions where old requests complete after new ones
    if (lastQueryRef.current !== '' && lastQueryRef.current !== currentQuery) {
      cancelPendingRequest();
    }
    
    // Create new abort controller for this request
    // The AbortSignal can be passed to fetch() to enable cancellation
    abortControllerRef.current = new AbortController();
    
    // Update cached parameters for future comparisons
    lastQueryRef.current = currentQuery;
    
    // Mark request as in progress
    isRequestInProgressRef.current = true;
    
    return abortControllerRef.current.signal;
  }, [cancelPendingRequest]);

  /**
   * Mark request as completed
   */
  const completeRequest = useCallback(() => {
    isRequestInProgressRef.current = false;
  }, []);

  /**
   * Check if a request is currently in progress (Requirement 12.5)
   */
  const isRequestInProgress = useCallback((): boolean => {
    return isRequestInProgressRef.current;
  }, []);

  /**
   * Reset the optimization state (useful for manual refresh)
   */
  const reset = useCallback(() => {
    cancelPendingRequest();
    lastQueryRef.current = '';
    isRequestInProgressRef.current = false;
  }, [cancelPendingRequest]);

  return {
    hasQueryChanged,
    shouldSkipRequest,
    cancelPendingRequest,
    prepareRequest,
    completeRequest,
    isRequestInProgress,
    reset,
  };
}
