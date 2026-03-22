// src/tests/doctor.service.test.ts
// Tests for DoctorService.updatePersonalInfo

import { doctorService } from '../services/doctor.service';
import { Doctor } from '../models/Doctor.model';
import { User } from '../models/User.model';

// Mock the models
jest.mock('../models/Doctor.model');
jest.mock('../models/User.model');

describe('DoctorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updatePersonalInfo', () => {
    const mockUserId = 'test-user-id';
    const mockDoctor = {
      id: 'test-doctor-id',
      userId: mockUserId,
      firstName: 'John',
      lastName: 'Doe',
      gender: 'male',
      address: { city: 'Mumbai', state: 'Maharashtra' },
      profileSections: { personal: false },
      save: jest.fn().mockResolvedValue(true),
      calculateProfileCompletion: jest.fn().mockReturnValue(50),
    };

    it('should update firstName and lastName', async () => {
      (Doctor.findOne as jest.Mock).mockResolvedValue(mockDoctor);
      (User.findByPk as jest.Mock).mockResolvedValue({
        fullName: 'John Doe',
        save: jest.fn().mockResolvedValue(true),
      });

      await doctorService.updatePersonalInfo(mockUserId, {
        firstName: 'Jane',
        lastName: 'Smith',
      });

      expect(mockDoctor.firstName).toBe('Jane');
      expect(mockDoctor.lastName).toBe('Smith');
      expect(mockDoctor.save).toHaveBeenCalled();
    });

    it('should normalize gender to lowercase', async () => {
      const doctor = { ...mockDoctor, gender: null, save: jest.fn(), calculateProfileCompletion: jest.fn().mockReturnValue(50) };
      (Doctor.findOne as jest.Mock).mockResolvedValue(doctor);

      await doctorService.updatePersonalInfo(mockUserId, {
        gender: 'MALE',
      });

      expect(doctor.gender).toBe('male');
    });

    it('should handle prefer_not_to_say gender with spaces', async () => {
      const doctor = { ...mockDoctor, gender: null, save: jest.fn(), calculateProfileCompletion: jest.fn().mockReturnValue(50) };
      (Doctor.findOne as jest.Mock).mockResolvedValue(doctor);

      await doctorService.updatePersonalInfo(mockUserId, {
        gender: 'prefer not to say',
      });

      expect(doctor.gender).toBe('prefer_not_to_say');
    });

    it('should skip invalid gender values', async () => {
      const doctor = { ...mockDoctor, gender: 'male', save: jest.fn(), calculateProfileCompletion: jest.fn().mockReturnValue(50) };
      (Doctor.findOne as jest.Mock).mockResolvedValue(doctor);

      await doctorService.updatePersonalInfo(mockUserId, {
        gender: 'invalid_gender',
      });

      // Gender should remain unchanged
      expect(doctor.gender).toBe('male');
    });

    it('should update address with merge', async () => {
      const doctor = {
        ...mockDoctor,
        address: { city: 'Mumbai', state: 'Maharashtra' } as any,
        save: jest.fn(),
        calculateProfileCompletion: jest.fn().mockReturnValue(50),
      };
      (Doctor.findOne as jest.Mock).mockResolvedValue(doctor);

      await doctorService.updatePersonalInfo(mockUserId, {
        address: { city: 'Delhi', pincode: '110001' },
      });

      expect(doctor.address.city).toBe('Delhi');
      expect(doctor.address.state).toBe('Maharashtra'); // Preserved
      expect(doctor.address.pincode).toBe('110001'); // Added
    });

    it('should throw error if doctor not found', async () => {
      (Doctor.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        doctorService.updatePersonalInfo(mockUserId, { firstName: 'Test' })
      ).rejects.toThrow('Doctor profile not found');
    });
  });
});
