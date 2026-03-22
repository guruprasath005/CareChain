// src/tests/doctor.search.integration.test.ts
// Integration tests for text search with existing filters

import { doctorService } from '../services/doctor.service';
import { Doctor } from '../models/Doctor.model';
import { Op } from 'sequelize';

// Mock the models
jest.mock('../models/Doctor.model');
jest.mock('../models/User.model');

describe('DoctorService - Text Search Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchDoctors with text query and other filters', () => {
    const mockDoctors = [
      {
        id: '1',
        firstName: 'John',
        lastName: 'Doe',
        specialization: 'Cardiology',
        yearsOfExperience: 10,
        address: { city: 'Mumbai', state: 'Maharashtra' },
        isSearchable: true,
        user: { fullName: 'Dr. John Doe', avatarUrl: 'avatar1.jpg' },
        toJSON: function() { return this; }
      },
      {
        id: '2',
        firstName: 'Jane',
        lastName: 'Smith',
        specialization: 'Neurology',
        yearsOfExperience: 8,
        address: { city: 'Delhi', state: 'Delhi' },
        isSearchable: true,
        user: { fullName: 'Dr. Jane Smith', avatarUrl: 'avatar2.jpg' },
        toJSON: function() { return this; }
      }
    ];

    it('should combine text search with specialization filter using AND logic', async () => {
      const mockFindAndCountAll = jest.fn().mockResolvedValue({
        count: 1,
        rows: [mockDoctors[0]]
      });
      Doctor.findAndCountAll = mockFindAndCountAll;

      const result = await doctorService.searchDoctors({
        q: 'John',
        specialization: 'Cardiology',
        page: 1,
        limit: 20
      });

      expect(mockFindAndCountAll).toHaveBeenCalled();
      const callArgs = mockFindAndCountAll.mock.calls[0][0];
      
      // Verify that where clause contains both conditions
      expect(callArgs.where).toHaveProperty('isSearchable', true);
      expect(callArgs.where).toHaveProperty('specialization', 'Cardiology');
      expect(callArgs.where[Op.and]).toBeDefined();
      
      // Verify the Op.and contains the text search OR conditions
      expect(callArgs.where[Op.and]).toBeInstanceOf(Array);
      expect(callArgs.where[Op.and][0][Op.or]).toBeDefined();
      
      expect(result.data).toHaveLength(1);
      expect(result.data[0].specialization).toBe('Cardiology');
    });

    it('should combine text search with experience filter using AND logic', async () => {
      const mockFindAndCountAll = jest.fn().mockResolvedValue({
        count: 1,
        rows: [mockDoctors[0]]
      });
      Doctor.findAndCountAll = mockFindAndCountAll;

      const result = await doctorService.searchDoctors({
        q: 'Doe',
        minExperience: 5,
        maxExperience: 15,
        page: 1,
        limit: 20
      });

      expect(mockFindAndCountAll).toHaveBeenCalled();
      const callArgs = mockFindAndCountAll.mock.calls[0][0];
      
      // Verify that where clause contains both conditions
      expect(callArgs.where).toHaveProperty('isSearchable', true);
      expect(callArgs.where).toHaveProperty('yearsOfExperience');
      expect(callArgs.where.yearsOfExperience).toHaveProperty('$gte', 5);
      expect(callArgs.where.yearsOfExperience).toHaveProperty('$lte', 15);
      expect(callArgs.where[Op.and]).toBeDefined();
      
      expect(result.data).toHaveLength(1);
    });

    it('should work with text search only (no other filters)', async () => {
      const mockFindAndCountAll = jest.fn().mockResolvedValue({
        count: 2,
        rows: mockDoctors
      });
      Doctor.findAndCountAll = mockFindAndCountAll;

      const result = await doctorService.searchDoctors({
        q: 'Dr',
        page: 1,
        limit: 20
      });

      expect(mockFindAndCountAll).toHaveBeenCalled();
      const callArgs = mockFindAndCountAll.mock.calls[0][0];
      
      // Verify that where clause contains text search
      expect(callArgs.where).toHaveProperty('isSearchable', true);
      expect(callArgs.where[Op.and]).toBeDefined();
      
      expect(result.data).toHaveLength(2);
    });

    it('should work with other filters only (no text search)', async () => {
      const mockFindAndCountAll = jest.fn().mockResolvedValue({
        count: 1,
        rows: [mockDoctors[0]]
      });
      Doctor.findAndCountAll = mockFindAndCountAll;

      const result = await doctorService.searchDoctors({
        specialization: 'Cardiology',
        page: 1,
        limit: 20
      });

      expect(mockFindAndCountAll).toHaveBeenCalled();
      const callArgs = mockFindAndCountAll.mock.calls[0][0];
      
      // Verify that where clause contains only specialization filter
      expect(callArgs.where).toHaveProperty('isSearchable', true);
      expect(callArgs.where).toHaveProperty('specialization', 'Cardiology');
      expect(callArgs.where[Op.and]).toBeUndefined();
      
      expect(result.data).toHaveLength(1);
    });

    it('should handle empty text query (whitespace only)', async () => {
      const mockFindAndCountAll = jest.fn().mockResolvedValue({
        count: 1,
        rows: [mockDoctors[0]]
      });
      Doctor.findAndCountAll = mockFindAndCountAll;

      const result = await doctorService.searchDoctors({
        q: '   ',
        specialization: 'Cardiology',
        page: 1,
        limit: 20
      });

      expect(mockFindAndCountAll).toHaveBeenCalled();
      const callArgs = mockFindAndCountAll.mock.calls[0][0];
      
      // Verify that text search is not applied (whitespace trimmed to empty)
      expect(callArgs.where).toHaveProperty('specialization', 'Cardiology');
      expect(callArgs.where[Op.and]).toBeUndefined();
      
      expect(result.data).toHaveLength(1);
    });

    it('should verify text search uses OR logic for multiple fields', async () => {
      const mockFindAndCountAll = jest.fn().mockResolvedValue({
        count: 1,
        rows: [mockDoctors[0]]
      });
      Doctor.findAndCountAll = mockFindAndCountAll;

      await doctorService.searchDoctors({
        q: 'Mumbai',
        page: 1,
        limit: 20
      });

      expect(mockFindAndCountAll).toHaveBeenCalled();
      const callArgs = mockFindAndCountAll.mock.calls[0][0];
      
      // Verify that Op.and contains Op.or with multiple conditions
      expect(callArgs.where[Op.and]).toBeInstanceOf(Array);
      expect(callArgs.where[Op.and][0][Op.or]).toBeDefined();
      expect(callArgs.where[Op.and][0][Op.or]).toBeInstanceOf(Array);
      
      // Should have 3 OR conditions: fullName, specialization, city
      expect(callArgs.where[Op.and][0][Op.or].length).toBe(3);
    });

    it('should maintain sort order by yearsOfExperience DESC', async () => {
      const mockFindAndCountAll = jest.fn().mockResolvedValue({
        count: 2,
        rows: mockDoctors
      });
      Doctor.findAndCountAll = mockFindAndCountAll;

      await doctorService.searchDoctors({
        q: 'Dr',
        page: 1,
        limit: 20
      });

      expect(mockFindAndCountAll).toHaveBeenCalled();
      const callArgs = mockFindAndCountAll.mock.calls[0][0];
      
      // Verify sort order
      expect(callArgs.order).toEqual([['yearsOfExperience', 'DESC']]);
    });
  });
});
