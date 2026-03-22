/**
 * Integration Test: Hospital Profile Screen
 * 
 * This test suite verifies the complete user flows and integration scenarios
 * for the hospital profile screen according to Task 17.
 * 
 * Test Coverage:
 * - Complete user flow from job listing to profile view
 * - Messaging flow end-to-end
 * - Refresh and navigation
 * - Various data scenarios (missing fields, empty sections, etc.)
 * - Visual consistency with hospital profile screen
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import HospitalProfileScreen from '../hospitalProfile';
import api, { messageApi } from '@/services/api';

// Mock dependencies
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: () => ({
    back: jest.fn(),
  }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'doctor-1', fullName: 'Dr. Test', avatar: null },
  }),
}));

jest.mock('@/hooks/useMessages', () => ({
  usePendingInvitations: () => ({
    acceptInvitation: jest.fn().mockResolvedValue({ success: true }),
    declineInvitation: jest.fn().mockResolvedValue({ success: true }),
  }),
}));

jest.mock('@/hooks/useProfile', () => ({
  useDoctorProfile: () => ({
    profile: { name: 'Dr. Test', specialization: 'Cardiology', avatar: null },
  }),
}));

jest.mock('@/services/api');
jest.mock('@/app/_components/ChatScreen', () => 'ChatScreen');

const { useLocalSearchParams } = require('expo-router');

// Mock data factory
const createMockProfile = (overrides = {}) => ({
  id: 'hospital-1',
  name: 'Test Hospital',
  type: 'MULTI_SPECIALTY',
  description: 'A leading healthcare provider',
  logo: 'https://example.com/logo.png',
  location: {
    city: 'Mumbai',
    state: 'Maharashtra',
    fullAddress: '123 Main St, Mumbai, Maharashtra',
  },
  facilities: {
    emergency24x7: true,
    icuFacilities: true,
    opFacility: true,
    ipFacility: true,
    radiologyDepartment: true,
  },
  infrastructure: {
    totalBeds: 100,
    icuBeds: 20,
    operationTheaters: 5,
    emergencyBeds: 15,
    photos: [
      { url: 'https://example.com/photo1.jpg', caption: 'Main Building' },
    ],
  },
  representative: {
    fullName: 'John Doe',
    email: 'john@hospital.com',
    phone: { countryCode: '+91', number: '9876543210' },
  },
  staffing: {
    totalDoctors: 50,
    totalNurses: 100,
  },
  stats: {
    rating: 4.5,
    totalEmployees: 150,
    activeJobs: 10,
    totalHires: 200,
  },
  registrationNumber: 'REG123456',
  nabhAccreditation: {
    certificateNumber: 'NABH123',
    validUntil: '2025-12-31',
  },
  credentials: {
    establishmentLicense: {
      url: 'https://example.com/license.pdf',
      isVerified: true,
    },
    fireSafetyNOC: {
      url: 'https://example.com/noc.pdf',
      isVerified: true,
    },
  },
  isVerified: true,
  establishedYear: 1990,
  ...overrides,
});

describe('HospitalProfileScreen - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Test 1: Complete user flow from job listing to profile view
   * Simulates a doctor viewing a job and then navigating to the hospital profile
   */
  describe('User Flow: Job Listing to Profile View', () => {
    test('loads and displays complete hospital profile from job context', async () => {
      const mockProfile = createMockProfile();
      useLocalSearchParams.mockReturnValue({ 
        id: 'hospital-1', 
        jobId: 'job-123' 
      });

      (api.search.getHospitalPublicProfile as jest.Mock).mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      (messageApi.getConversationWithHospital as jest.Mock).mockResolvedValue({
        success: true,
        data: { exists: false, canMessage: false },
      });

      render(<HospitalProfileScreen />);

      // Wait for profile to load
      await waitFor(() => {
        expect(screen.getByText('Test Hospital')).toBeTruthy();
      });

      // Verify all major sections are rendered
      expect(screen.getByText('Dr. Test')).toBeTruthy();
      expect(screen.getByText('Cardiology')).toBeTruthy();
      expect(screen.getByText('Representative Details')).toBeTruthy();
      expect(screen.getByText('Staffing Details')).toBeTruthy();
      expect(screen.getByText('Infrastructure Details')).toBeTruthy();
      expect(screen.getByText('Credentials & Verification')).toBeTruthy();
      expect(screen.getByText('Verified Documents')).toBeTruthy();
    });

    test('displays capability tags from facilities data', async () => {
      const mockProfile = createMockProfile();
      useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

      (api.search.getHospitalPublicProfile as jest.Mock).mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      (messageApi.getConversationWithHospital as jest.Mock).mockResolvedValue({
        success: true,
        data: { exists: false, canMessage: false },
      });

      render(<HospitalProfileScreen />);

      await waitFor(() => {
        expect(screen.getByText('Test Hospital')).toBeTruthy();
      });

      // Verify capability tags are displayed
      expect(screen.getByText('OP')).toBeTruthy();
      expect(screen.getByText('IP')).toBeTruthy();
      expect(screen.getByText('Emergency')).toBeTruthy();
      expect(screen.getByText('ICU')).toBeTruthy();
      expect(screen.getByText('Radiology')).toBeTruthy();
    });
  });

  /**
   * Test 2: Messaging flow end-to-end
   * Tests all messaging scenarios: no conversation, pending invitation, can message
   */
  describe('Messaging Flow End-to-End', () => {
    test('displays "Send Message & Connect" button when no conversation exists', async () => {
      const mockProfile = createMockProfile();
      useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

      (api.search.getHospitalPublicProfile as jest.Mock).mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      (messageApi.getConversationWithHospital as jest.Mock).mockResolvedValue({
        success: true,
        data: { exists: false, canMessage: false },
      });

      render(<HospitalProfileScreen />);

      await waitFor(() => {
        expect(screen.getByText('Send Message & Connect')).toBeTruthy();
      });

      expect(screen.getByText(/Interested in this hospital/)).toBeTruthy();
    });

    test('displays invitation card with accept/decline buttons for pending invitation', async () => {
      const mockProfile = createMockProfile();
      useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

      (api.search.getHospitalPublicProfile as jest.Mock).mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      (messageApi.getConversationWithHospital as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          exists: true,
          invitationStatus: 'pending',
          canMessage: false,
          conversation: {
            id: 'conv-1',
            messages: [{ content: 'We would like to connect with you', senderId: 'hospital-1' }],
          },
        },
      });

      render(<HospitalProfileScreen />);

      await waitFor(() => {
        expect(screen.getByText('Invitation Received')).toBeTruthy();
      });

      expect(screen.getByText('Test Hospital wants to connect with you')).toBeTruthy();
      expect(screen.getByText('Accept & Chat')).toBeTruthy();
      expect(screen.getByText('Decline')).toBeTruthy();
      expect(screen.getByText('"We would like to connect with you"')).toBeTruthy();
    });

    test('displays message button when conversation exists and can message', async () => {
      const mockProfile = createMockProfile();
      useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

      (api.search.getHospitalPublicProfile as jest.Mock).mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      (messageApi.getConversationWithHospital as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          exists: true,
          canMessage: true,
          conversation: { id: 'conv-1' },
        },
      });

      render(<HospitalProfileScreen />);

      await waitFor(() => {
        expect(screen.getByText('Message Hospital')).toBeTruthy();
      });
    });

    test('handles invitation acceptance flow', async () => {
      const mockProfile = createMockProfile();
      const mockAcceptInvitation = jest.fn().mockResolvedValue({ success: true });
      
      jest.spyOn(require('@/hooks/useMessages'), 'usePendingInvitations').mockReturnValue({
        acceptInvitation: mockAcceptInvitation,
        declineInvitation: jest.fn(),
      });

      useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

      (api.search.getHospitalPublicProfile as jest.Mock).mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      (messageApi.getConversationWithHospital as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          exists: true,
          invitationStatus: 'pending',
          canMessage: false,
          conversation: { id: 'conv-1' },
        },
      });

      render(<HospitalProfileScreen />);

      await waitFor(() => {
        expect(screen.getByText('Accept & Chat')).toBeTruthy();
      });

      const acceptButton = screen.getByText('Accept & Chat');
      fireEvent.press(acceptButton);

      await waitFor(() => {
        expect(mockAcceptInvitation).toHaveBeenCalledWith('conv-1');
      });
    });
  });

  /**
   * Test 3: Refresh and navigation
   * Tests pull-to-refresh and back navigation functionality
   */
  describe('Refresh and Navigation', () => {
    test('refreshes both profile and conversation status on pull-to-refresh', async () => {
      const mockProfile = createMockProfile();
      useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

      const mockGetProfile = jest.fn()
        .mockResolvedValueOnce({ success: true, data: mockProfile })
        .mockResolvedValueOnce({ 
          success: true, 
          data: { ...mockProfile, name: 'Updated Hospital' } 
        });

      const mockGetConversation = jest.fn()
        .mockResolvedValue({ success: true, data: { exists: false, canMessage: false } });

      (api.search.getHospitalPublicProfile as jest.Mock) = mockGetProfile;
      (messageApi.getConversationWithHospital as jest.Mock) = mockGetConversation;

      const { getByTestId } = render(<HospitalProfileScreen />);

      await waitFor(() => {
        expect(screen.getByText('Test Hospital')).toBeTruthy();
      });

      // Simulate pull-to-refresh
      const scrollView = getByTestId('hospital-profile-scroll');
      fireEvent(scrollView, 'refresh');

      await waitFor(() => {
        expect(mockGetProfile).toHaveBeenCalledTimes(2);
        expect(mockGetConversation).toHaveBeenCalledTimes(2);
      });
    });

    test('navigates back when back button is pressed', async () => {
      const mockProfile = createMockProfile();
      const mockBack = jest.fn();
      
      jest.spyOn(require('expo-router'), 'useRouter').mockReturnValue({
        back: mockBack,
      });

      useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

      (api.search.getHospitalPublicProfile as jest.Mock).mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      (messageApi.getConversationWithHospital as jest.Mock).mockResolvedValue({
        success: true,
        data: { exists: false, canMessage: false },
      });

      render(<HospitalProfileScreen />);

      await waitFor(() => {
        expect(screen.getByText('Test Hospital')).toBeTruthy();
      });

      // Find and press back button (it's an Ionicons component)
      const backButtons = screen.getAllByTestId('touchable-opacity');
      const backButton = backButtons[0]; // First touchable is the back button
      fireEvent.press(backButton);

      expect(mockBack).toHaveBeenCalled();
    });
  });

  /**
   * Test 4: Various data scenarios (missing fields, empty sections)
   * Tests graceful handling of missing or incomplete data
   */
  describe('Data Scenarios: Missing Fields and Empty Sections', () => {
    test('omits representative section when no representative data exists', async () => {
      const mockProfile = createMockProfile({
        representative: undefined,
      });

      useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

      (api.search.getHospitalPublicProfile as jest.Mock).mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      (messageApi.getConversationWithHospital as jest.Mock).mockResolvedValue({
        success: true,
        data: { exists: false, canMessage: false },
      });

      render(<HospitalProfileScreen />);

      await waitFor(() => {
        expect(screen.getByText('Test Hospital')).toBeTruthy();
      });

      // Representative section should not be rendered
      expect(screen.queryByText('Representative Details')).toBeNull();
    });

    test('omits staffing section when no staffing data exists', async () => {
      const mockProfile = createMockProfile({
        staffing: undefined,
        stats: { ...createMockProfile().stats, totalEmployees: 0 },
      });

      useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

      (api.search.getHospitalPublicProfile as jest.Mock).mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      (messageApi.getConversationWithHospital as jest.Mock).mockResolvedValue({
        success: true,
        data: { exists: false, canMessage: false },
      });

      render(<HospitalProfileScreen />);

      await waitFor(() => {
        expect(screen.getByText('Test Hospital')).toBeTruthy();
      });

      // Staffing section should not be rendered
      expect(screen.queryByText('Staffing Details')).toBeNull();
    });

    test('omits infrastructure section when no infrastructure data exists', async () => {
      const mockProfile = createMockProfile({
        infrastructure: undefined,
      });

      useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

      (api.search.getHospitalPublicProfile as jest.Mock).mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      (messageApi.getConversationWithHospital as jest.Mock).mockResolvedValue({
        success: true,
        data: { exists: false, canMessage: false },
      });

      render(<HospitalProfileScreen />);

      await waitFor(() => {
        expect(screen.getByText('Test Hospital')).toBeTruthy();
      });

      // Infrastructure section should not be rendered
      expect(screen.queryByText('Infrastructure Details')).toBeNull();
    });

    test('omits credentials section when no credentials data exists', async () => {
      const mockProfile = createMockProfile({
        registrationNumber: undefined,
        hospitalLicense: undefined,
        nabhAccreditation: undefined,
      });

      useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

      (api.search.getHospitalPublicProfile as jest.Mock).mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      (messageApi.getConversationWithHospital as jest.Mock).mockResolvedValue({
        success: true,
        data: { exists: false, canMessage: false },
      });

      render(<HospitalProfileScreen />);

      await waitFor(() => {
        expect(screen.getByText('Test Hospital')).toBeTruthy();
      });

      // Credentials section should not be rendered
      expect(screen.queryByText('Credentials & Verification')).toBeNull();
    });

    test('omits verified documents section when no verified documents exist', async () => {
      const mockProfile = createMockProfile({
        credentials: {
          establishmentLicense: { url: null, isVerified: false },
          fireSafetyNOC: { url: null, isVerified: false },
        },
      });

      useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

      (api.search.getHospitalPublicProfile as jest.Mock).mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      (messageApi.getConversationWithHospital as jest.Mock).mockResolvedValue({
        success: true,
        data: { exists: false, canMessage: false },
      });

      render(<HospitalProfileScreen />);

      await waitFor(() => {
        expect(screen.getByText('Test Hospital')).toBeTruthy();
      });

      // Verified Documents section should not be rendered
      expect(screen.queryByText('Verified Documents')).toBeNull();
    });

    test('displays "Not available" for missing representative fields', async () => {
      const mockProfile = createMockProfile({
        representative: {
          fullName: 'John Doe',
          email: null,
          phone: null,
        },
      });

      useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

      (api.search.getHospitalPublicProfile as jest.Mock).mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      (messageApi.getConversationWithHospital as jest.Mock).mockResolvedValue({
        success: true,
        data: { exists: false, canMessage: false },
      });

      render(<HospitalProfileScreen />);

      await waitFor(() => {
        expect(screen.getByText('Representative Details')).toBeTruthy();
      });

      // Should display "Not available" for missing fields
      const notAvailableTexts = screen.getAllByText('Not available');
      expect(notAvailableTexts.length).toBeGreaterThanOrEqual(2); // email and phone
    });

    test('handles profile with minimal data gracefully', async () => {
      const minimalProfile = {
        id: 'hospital-1',
        name: 'Minimal Hospital',
        type: null,
        description: null,
        logo: null,
        location: null,
        facilities: null,
        infrastructure: null,
        representative: null,
        staffing: null,
        stats: null,
        registrationNumber: null,
        nabhAccreditation: null,
        credentials: null,
      };

      useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

      (api.search.getHospitalPublicProfile as jest.Mock).mockResolvedValue({
        success: true,
        data: minimalProfile,
      });

      (messageApi.getConversationWithHospital as jest.Mock).mockResolvedValue({
        success: true,
        data: { exists: false, canMessage: false },
      });

      render(<HospitalProfileScreen />);

      await waitFor(() => {
        expect(screen.getByText('Minimal Hospital')).toBeTruthy();
      });

      // Should render without crashing
      expect(screen.getByText('Dr. Test')).toBeTruthy();
      expect(screen.getByText('Connection Status')).toBeTruthy();
    });
  });

  /**
   * Test 5: Visual consistency verification
   * Tests that all UI components render with consistent styling
   */
  describe('Visual Consistency', () => {
    test('renders all sections with consistent ProfileSectionStatic wrapper', async () => {
      const mockProfile = createMockProfile();
      useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

      (api.search.getHospitalPublicProfile as jest.Mock).mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      (messageApi.getConversationWithHospital as jest.Mock).mockResolvedValue({
        success: true,
        data: { exists: false, canMessage: false },
      });

      render(<HospitalProfileScreen />);

      await waitFor(() => {
        expect(screen.getByText('Test Hospital')).toBeTruthy();
      });

      // Verify all major sections use consistent structure
      const sectionTitles = [
        'Representative Details',
        'Staffing Details',
        'Infrastructure Details',
        'Credentials & Verification',
        'Verified Documents',
      ];

      sectionTitles.forEach(title => {
        expect(screen.getByText(title)).toBeTruthy();
      });
    });

    test('displays doctor header with consistent styling', async () => {
      const mockProfile = createMockProfile();
      useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

      (api.search.getHospitalPublicProfile as jest.Mock).mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      (messageApi.getConversationWithHospital as jest.Mock).mockResolvedValue({
        success: true,
        data: { exists: false, canMessage: false },
      });

      render(<HospitalProfileScreen />);

      await waitFor(() => {
        expect(screen.getByText('Dr. Test')).toBeTruthy();
      });

      // Verify doctor identity header components
      expect(screen.getByText('Dr. Test')).toBeTruthy();
      expect(screen.getByText('Cardiology')).toBeTruthy();
    });

    test('displays hospital general information with consistent layout', async () => {
      const mockProfile = createMockProfile();
      useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

      (api.search.getHospitalPublicProfile as jest.Mock).mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      (messageApi.getConversationWithHospital as jest.Mock).mockResolvedValue({
        success: true,
        data: { exists: false, canMessage: false },
      });

      render(<HospitalProfileScreen />);

      await waitFor(() => {
        expect(screen.getByText('Test Hospital')).toBeTruthy();
      });

      // Verify general information components
      expect(screen.getByText('Test Hospital')).toBeTruthy();
      expect(screen.getByText('MULTI SPECIALTY')).toBeTruthy();
      expect(screen.getByText('Est. 1990')).toBeTruthy();
      expect(screen.getByText('123 Main St, Mumbai, Maharashtra')).toBeTruthy();
    });
  });

  /**
   * Test 6: Edge cases and error scenarios
   */
  describe('Edge Cases', () => {
    test('handles phone number as string format', async () => {
      const mockProfile = createMockProfile({
        representative: {
          fullName: 'John Doe',
          email: 'john@hospital.com',
          phone: '+91 9876543210',
        },
      });

      useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

      (api.search.getHospitalPublicProfile as jest.Mock).mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      (messageApi.getConversationWithHospital as jest.Mock).mockResolvedValue({
        success: true,
        data: { exists: false, canMessage: false },
      });

      render(<HospitalProfileScreen />);

      await waitFor(() => {
        expect(screen.getByText('Representative Details')).toBeTruthy();
      });

      expect(screen.getByText('+91 9876543210')).toBeTruthy();
    });

    test('uses fallback for registration number from hospitalLicense', async () => {
      const mockProfile = createMockProfile({
        registrationNumber: undefined,
        hospitalLicense: {
          licenseNumber: 'LICENSE123',
          issuingAuthority: 'State Health Dept',
        },
      });

      useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

      (api.search.getHospitalPublicProfile as jest.Mock).mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      (messageApi.getConversationWithHospital as jest.Mock).mockResolvedValue({
        success: true,
        data: { exists: false, canMessage: false },
      });

      render(<HospitalProfileScreen />);

      await waitFor(() => {
        expect(screen.getByText('Credentials & Verification')).toBeTruthy();
      });

      expect(screen.getByText('LICENSE123')).toBeTruthy();
    });

    test('uses stats.totalEmployees when staffing.totalDoctors is not available', async () => {
      const mockProfile = createMockProfile({
        staffing: {
          totalDoctors: undefined,
          totalNurses: 100,
        },
        stats: {
          totalEmployees: 75,
          rating: 4.5,
          activeJobs: 10,
          totalHires: 200,
        },
      });

      useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

      (api.search.getHospitalPublicProfile as jest.Mock).mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      (messageApi.getConversationWithHospital as jest.Mock).mockResolvedValue({
        success: true,
        data: { exists: false, canMessage: false },
      });

      render(<HospitalProfileScreen />);

      await waitFor(() => {
        expect(screen.getByText('Staffing Details')).toBeTruthy();
      });

      expect(screen.getByText('75')).toBeTruthy(); // Should use stats.totalEmployees
      expect(screen.getByText('100')).toBeTruthy(); // Nurses count
    });
  });
});
