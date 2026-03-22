/**
 * Loading and Error States Test
 * 
 * This test verifies that the hospital profile screen correctly displays
 * loading indicators and error messages according to Requirements 12.1-12.5.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
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
    acceptInvitation: jest.fn(),
    declineInvitation: jest.fn(),
  }),
}));

jest.mock('@/hooks/useProfile', () => ({
  useDoctorProfile: () => ({
    profile: { name: 'Dr. Test', specialization: 'Cardiology' },
  }),
}));

jest.mock('@/services/api');

const { useLocalSearchParams } = require('expo-router');

describe('HospitalProfileScreen - Loading and Error States', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Requirement 12.1: Loading State Display
   * WHEN the profile data is loading, THE System SHALL display a loading indicator 
   * with the text "Loading hospital profile..."
   */
  test('displays loading indicator during initial load', async () => {
    useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

    // Mock API to delay response
    (api.search.getHospitalPublicProfile as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, data: {} }), 1000))
    );
    (messageApi.getConversationWithHospital as jest.Mock).mockResolvedValue({ success: true });

    render(<HospitalProfileScreen />);

    // Verify loading indicator is displayed
    expect(screen.getByText('Loading hospital profile...')).toBeTruthy();
    expect(screen.getByTestId('activity-indicator')).toBeTruthy();
  });

  /**
   * Requirement 12.4: Missing Hospital ID Error
   * WHEN the hospital ID is missing, THE System SHALL display an error message 
   * "Hospital id missing"
   */
  test('displays specific error message for missing hospital ID', async () => {
    useLocalSearchParams.mockReturnValue({ id: undefined });

    render(<HospitalProfileScreen />);

    await waitFor(() => {
      expect(screen.getByText('Hospital id missing')).toBeTruthy();
    });
  });

  /**
   * Requirement 12.2: Error Message Display
   * WHEN the profile data fails to load, THE System SHALL display an error message 
   * with the failure reason
   */
  test('displays error message on load failure', async () => {
    useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

    const errorMessage = 'Network error occurred';
    (api.search.getHospitalPublicProfile as jest.Mock).mockResolvedValue({
      success: false,
      error: errorMessage,
    });
    (messageApi.getConversationWithHospital as jest.Mock).mockResolvedValue({ success: true });

    render(<HospitalProfileScreen />);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeTruthy();
    });
  });

  /**
   * Requirement 12.3: Go Back Button in Error State
   * WHEN the profile data fails to load, THE System SHALL display a "Go Back" button 
   * to return to the previous screen
   */
  test('displays Go Back button in error state', async () => {
    useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

    (api.search.getHospitalPublicProfile as jest.Mock).mockResolvedValue({
      success: false,
      error: 'Failed to load',
    });
    (messageApi.getConversationWithHospital as jest.Mock).mockResolvedValue({ success: true });

    render(<HospitalProfileScreen />);

    await waitFor(() => {
      expect(screen.getByText('Go Back')).toBeTruthy();
    });
  });

  /**
   * Requirement 12.5: Conversation Loading State
   * WHEN the conversation status is loading, THE System SHALL display a loading 
   * indicator in the connection status section
   */
  test('displays conversation loading indicator in connection section', async () => {
    useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

    const mockProfile = {
      id: 'hospital-1',
      name: 'Test Hospital',
      type: 'MULTI_SPECIALTY',
      location: { city: 'Mumbai', state: 'Maharashtra' },
    };

    (api.search.getHospitalPublicProfile as jest.Mock).mockResolvedValue({
      success: true,
      data: mockProfile,
    });

    // Mock conversation API to delay response
    (messageApi.getConversationWithHospital as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 1000))
    );

    render(<HospitalProfileScreen />);

    await waitFor(() => {
      expect(screen.getByText('Test Hospital')).toBeTruthy();
    });

    // Verify conversation loading indicator is displayed
    expect(screen.getByText('Checking messages...')).toBeTruthy();
  });

  /**
   * Edge Case: API throws exception
   */
  test('handles API exception gracefully', async () => {
    useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

    (api.search.getHospitalPublicProfile as jest.Mock).mockRejectedValue(
      new Error('Network timeout')
    );
    (messageApi.getConversationWithHospital as jest.Mock).mockResolvedValue({ success: true });

    render(<HospitalProfileScreen />);

    await waitFor(() => {
      expect(screen.getByText('Network timeout')).toBeTruthy();
      expect(screen.getByText('Go Back')).toBeTruthy();
    });
  });

  /**
   * Edge Case: Profile data is null
   */
  test('displays error when profile data is null', async () => {
    useLocalSearchParams.mockReturnValue({ id: 'hospital-1' });

    (api.search.getHospitalPublicProfile as jest.Mock).mockResolvedValue({
      success: true,
      data: null,
    });
    (messageApi.getConversationWithHospital as jest.Mock).mockResolvedValue({ success: true });

    render(<HospitalProfileScreen />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load hospital profile')).toBeTruthy();
      expect(screen.getByText('Go Back')).toBeTruthy();
    });
  });
});
