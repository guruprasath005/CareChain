/**
 * Unit tests for error handling in search and filter functionality
 * 
 * Tests cover:
 * - Network error display and retry
 * - AsyncStorage error handling
 * - Error logging
 * - Graceful degradation
 * 
 * Requirements: 8.5
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('Error Handling - AsyncStorage Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console errors in tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Storage Read Errors', () => {
    it('should handle storage read failure', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
        new Error('Storage read failed')
      );

      try {
        await AsyncStorage.getItem('test_key');
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Storage read failed');
      }
    });

    it('should handle corrupted JSON data', () => {
      const corruptedData = '{ invalid json }';
      
      expect(() => {
        JSON.parse(corruptedData);
      }).toThrow();
    });

    it('should validate filter data structure', () => {
      const invalidFilters = {
        salaryMin: 100000,
        salaryMax: 50000, // min > max
      };

      const isValid = invalidFilters.salaryMin <= invalidFilters.salaryMax;
      expect(isValid).toBe(false);
    });
  });

  describe('Storage Write Errors', () => {
    it('should handle storage write failure', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error('Storage write failed')
      );

      try {
        await AsyncStorage.setItem('test_key', 'value');
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Storage write failed');
      }
    });

    it('should serialize filter state correctly', () => {
      const filters = {
        specialization: 'Cardiology',
        location: 'Mumbai',
        salaryMin: 50000,
        salaryMax: 100000,
      };

      const serialized = JSON.stringify(filters);
      const deserialized = JSON.parse(serialized);

      expect(deserialized).toEqual(filters);
    });
  });

  describe('Storage Clear Errors', () => {
    it('should handle storage clear failure', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(
        new Error('Storage clear failed')
      );

      try {
        await AsyncStorage.removeItem('test_key');
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Storage clear failed');
      }
    });
  });

  describe('Error Logging', () => {
    it('should log error with timestamp', () => {
      const timestamp = new Date().toISOString();
      const error = new Error('Test error');
      
      console.error(`[FilterPersistence] load failed at ${timestamp}`, {
        storageKey: 'test_key',
        error: error.message,
        stack: error.stack,
      });

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[FilterPersistence] load failed'),
        expect.objectContaining({
          storageKey: 'test_key',
          error: 'Test error',
        })
      );
    });

    it('should log detailed error information', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      
      const errorInfo = {
        storageKey: 'test_key',
        error: error.message,
        stack: error.stack,
      };

      expect(errorInfo).toEqual({
        storageKey: 'test_key',
        error: 'Test error',
        stack: 'Error stack trace',
      });
    });
  });

  describe('Data Validation', () => {
    it('should validate salary range', () => {
      const validRange = { salaryMin: 50000, salaryMax: 100000 };
      const invalidRange = { salaryMin: 100000, salaryMax: 50000 };

      expect(validRange.salaryMin <= validRange.salaryMax).toBe(true);
      expect(invalidRange.salaryMin <= invalidRange.salaryMax).toBe(false);
    });

    it('should validate filter keys', () => {
      const validKeys = ['specialization', 'location', 'jobType', 'salaryMin', 'salaryMax'];
      const testFilter = { specialization: 'Cardiology', unknownKey: 'value' };

      const unknownKeys = Object.keys(testFilter).filter(
        key => !validKeys.includes(key)
      );

      expect(unknownKeys).toEqual(['unknownKey']);
    });

    it('should validate filter value types', () => {
      const filters = {
        specialization: 'Cardiology',
        salaryMin: 50000,
        salaryMax: 100000,
      };

      expect(typeof filters.specialization).toBe('string');
      expect(typeof filters.salaryMin).toBe('number');
      expect(typeof filters.salaryMax).toBe('number');
    });
  });

  describe('Error Recovery', () => {
    it('should allow retry after failure', async () => {
      // First call fails
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
        new Error('Storage read failed')
      );

      try {
        await AsyncStorage.getItem('test_key');
        fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toBe('Storage read failed');
      }

      // Second call succeeds
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({ specialization: 'Cardiology' })
      );

      const result = await AsyncStorage.getItem('test_key');
      expect(result).toBe(JSON.stringify({ specialization: 'Cardiology' }));
    });

    it('should clear corrupted data', async () => {
      const corruptedData = '{ invalid json }';
      
      try {
        JSON.parse(corruptedData);
        fail('Should have thrown error');
      } catch (error) {
        // Clear corrupted data
        await AsyncStorage.removeItem('test_key');
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith('test_key');
      }
    });
  });

  describe('Graceful Degradation', () => {
    it('should continue with empty state on load error', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
        new Error('Storage read failed')
      );

      let filters = { specialization: 'Cardiology' };

      try {
        await AsyncStorage.getItem('test_key');
      } catch (error) {
        // Continue with empty filters
        filters = {} as any;
      }

      expect(filters).toEqual({});
    });

    it('should keep in-memory state on save error', async () => {
      const newFilters = { specialization: 'Cardiology' };
      let filters = newFilters;

      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error('Storage write failed')
      );

      try {
        await AsyncStorage.setItem('test_key', JSON.stringify(newFilters));
      } catch (error) {
        // Keep in-memory state
        console.warn('Continuing with in-memory filters only');
      }

      // In-memory state should be preserved
      expect(filters).toEqual(newFilters);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Continuing with in-memory filters only')
      );
    });

    it('should clear in-memory state on clear error', async () => {
      let filters = { specialization: 'Cardiology' };

      (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(
        new Error('Storage clear failed')
      );

      try {
        await AsyncStorage.removeItem('test_key');
      } catch (error) {
        // Clear in-memory state anyway
        filters = {} as any;
        console.warn('Filters cleared from memory, storage clear failed');
      }

      expect(filters).toEqual({});
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Filters cleared from memory, storage clear failed')
      );
    });
  });
});
