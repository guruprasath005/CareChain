import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FilterState } from './types/searchFilter.types';

/**
 * Result interface for the useFilterPersistence hook
 */
export interface UseFilterPersistenceResult<T = FilterState> {
  filters: T;
  saveFilters: (filters: T) => Promise<void>;
  clearFilters: () => Promise<void>;
  loadFilters: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * Logs error details for debugging purposes
 * 
 * @param operation - The operation that failed (e.g., 'load', 'save', 'clear')
 * @param storageKey - The AsyncStorage key involved
 * @param error - The error object
 */
function logStorageError(operation: string, storageKey: string, error: unknown): void {
  const timestamp = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(`[FilterPersistence] ${operation} failed at ${timestamp}`, {
    storageKey,
    error: errorMessage,
    stack: errorStack,
  });
}

/**
 * Validates filter state before saving to ensure data integrity
 * 
 * @param filters - The filter state to validate
 * @returns True if valid, false otherwise
 */
function validateFilterState(filters: any): boolean {
  if (!filters || typeof filters !== 'object') {
    return false;
  }

  // Basic validation that it's a non-null object
  // Custom validation can be added per use case if needed
  return true;
}

/**
 * Hook that manages filter state persistence to AsyncStorage
 * 
 * This hook provides automatic saving and loading of filter state to local storage,
 * allowing users to return to their previous filter selections when navigating
 * back to a search screen.
 * 
 * Key features:
 * - Automatic loading on mount
 * - Validation before saving to prevent corrupted data
 * - Graceful error handling - continues with in-memory state if storage fails
 * - Detailed error logging for debugging
 * 
 * @param storageKey - The key to use for AsyncStorage (e.g., 'doctor_job_filters')
 * @returns Filter state and methods to manage it
 * 
 * @example
 * const { filters, saveFilters, clearFilters, error } = 
 *   useFilterPersistence('doctor_job_filters');
 * 
 * // Apply filters
 * await saveFilters({ specialization: 'Cardiology', location: 'Mumbai' });
 * 
 * // Filters automatically load on next mount
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.6
 */
export function useFilterPersistence<T = FilterState>(storageKey: string): UseFilterPersistenceResult<T> {
  const [filters, setFilters] = useState<T>({} as T);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Load filters from AsyncStorage (Requirement 7.2)
   * 
   * This function:
   * 1. Retrieves the saved filter state from AsyncStorage
   * 2. Validates the data to ensure it's not corrupted
   * 3. Updates component state with loaded filters
   * 4. Handles errors gracefully by continuing with empty filters
   */
  const loadFilters = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const saved = await AsyncStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);

          // Validate parsed data to prevent corrupted state
          if (validateFilterState(parsed)) {
            setFilters(parsed);
          } else {
            console.warn('[FilterPersistence] Invalid filter data in storage, using empty state');
            setFilters({});
            // Clear invalid data from storage
            await AsyncStorage.removeItem(storageKey);
          }
        } catch (parseError) {
          logStorageError('parse', storageKey, parseError);
          setError('Failed to parse saved filters');
          setFilters({});
          // Clear corrupted data from storage
          await AsyncStorage.removeItem(storageKey);
        }
      }
    } catch (err) {
      logStorageError('load', storageKey, err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load filters';
      setError(errorMessage);
      // Continue with empty filters - don't block the user (Requirement 7.4)
      setFilters({});
    } finally {
      setIsLoading(false);
    }
  }, [storageKey]);

  /**
   * Save filters to AsyncStorage (Requirement 7.1)
   * 
   * This function:
   * 1. Validates filter data before saving
   * 2. Updates in-memory state immediately for responsive UI
   * 3. Attempts to persist to AsyncStorage
   * 4. Continues with in-memory state if persistence fails (Requirement 7.4)
   * 
   * @param newFilters - The filter state to save
   */
  const saveFilters = useCallback(async (newFilters: T) => {
    setIsLoading(true);
    setError(null);

    // Validate before saving to prevent corrupted data
    if (!validateFilterState(newFilters)) {
      const validationError = 'Invalid filter state';
      setError(validationError);
      setIsLoading(false);
      throw new Error(validationError);
    }

    try {
      // Update in-memory state immediately for responsive UI
      setFilters(newFilters);

      // Attempt to persist to storage
      await AsyncStorage.setItem(storageKey, JSON.stringify(newFilters));
    } catch (err) {
      logStorageError('save', storageKey, err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save filters';
      setError(errorMessage);

      // Keep in-memory state even if persistence fails (Requirement 7.4)
      // This ensures the app continues to work even if storage is full or unavailable
      console.warn('[FilterPersistence] Continuing with in-memory filters only');

      // Don't throw - allow the app to continue with in-memory state
    } finally {
      setIsLoading(false);
    }
  }, [storageKey]);

  /**
   * Clear filters from both memory and AsyncStorage (Requirement 7.3)
   * 
   * This function:
   * 1. Clears in-memory state immediately
   * 2. Attempts to remove from AsyncStorage
   * 3. Continues even if storage clear fails
   */
  const clearFilters = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Clear in-memory state immediately
      setFilters({} as T);

      // Attempt to clear from storage
      await AsyncStorage.removeItem(storageKey);
    } catch (err) {
      logStorageError('clear', storageKey, err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear filters';
      setError(errorMessage);

      // Keep in-memory state cleared even if storage clear fails
      console.warn('[FilterPersistence] Filters cleared from memory, storage clear failed');

      // Don't throw - the filters are cleared in memory which is what matters
    } finally {
      setIsLoading(false);
    }
  }, [storageKey]);

  // Load filters on mount (Requirement 7.2, 7.6)
  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  return { filters, saveFilters, clearFilters, loadFilters, isLoading, error, clearError };
}
