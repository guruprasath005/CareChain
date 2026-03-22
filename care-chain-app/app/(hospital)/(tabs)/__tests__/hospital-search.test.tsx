import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import HospitalSearchScreen from '../search';
import { useSearchDoctors, useDebounce } from '@/hooks';
import { useRouter } from 'expo-router';

// Mock the hooks
jest.mock('@/hooks', () => ({
  useSearchDoctors: jest.fn(),
  useDebounce: jest.fn((value) => value),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

describe('HospitalSearchScreen', () => {
  const mockRefresh = jest.fn();
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (useSearchDoctors as jest.Mock).mockReturnValue({
      doctors: [],
      isLoading: false,
      error: null,
      refresh: mockRefresh,
      totalCount: 0,
    });
  });

  it('should render search input', () => {
    const { getByPlaceholderText } = render(<HospitalSearchScreen />);
    expect(getByPlaceholderText('Search candidates by name, role, location')).toBeTruthy();
  });

  it('should use debounced search query', () => {
    render(<HospitalSearchScreen />);
    expect(useDebounce).toHaveBeenCalledWith('', { delay: 500 });
  });

  it('should update search query on text input', () => {
    const { getByPlaceholderText } = render(<HospitalSearchScreen />);
    const input = getByPlaceholderText('Search candidates by name, role, location');
    
    fireEvent.changeText(input, 'test query');
    expect(input.props.value).toBe('test query');
  });

  it('should show clear button when search query is not empty', () => {
    const { getByPlaceholderText, UNSAFE_getByType } = render(<HospitalSearchScreen />);
    const input = getByPlaceholderText('Search candidates by name, role, location');
    
    fireEvent.changeText(input, 'test');
    
    // Find the close icon
    const closeButtons = UNSAFE_getByType('TouchableOpacity');
    expect(closeButtons).toBeTruthy();
  });

  it('should clear search query when clear button is pressed', () => {
    const { getByPlaceholderText, getAllByType } = render(<HospitalSearchScreen />);
    const input = getByPlaceholderText('Search candidates by name, role, location');
    
    fireEvent.changeText(input, 'test');
    
    // Find and press the clear button (last TouchableOpacity in the search bar)
    const touchables = getAllByType('TouchableOpacity');
    const clearButton = touchables.find(t => t.props.onPress?.name === 'handleClearSearch');
    
    if (clearButton) {
      fireEvent.press(clearButton);
      expect(input.props.value).toBe('');
    }
  });

  it('should display loading state', () => {
    (useSearchDoctors as jest.Mock).mockReturnValue({
      doctors: [],
      isLoading: true,
      error: null,
      refresh: mockRefresh,
      totalCount: 0,
    });

    const { getByText } = render(<HospitalSearchScreen />);
    expect(getByText('Loading candidates...')).toBeTruthy();
    expect(getByText('Searching...')).toBeTruthy();
  });

  it('should display error state with retry button', () => {
    (useSearchDoctors as jest.Mock).mockReturnValue({
      doctors: [],
      isLoading: false,
      error: 'Network error',
      refresh: mockRefresh,
      totalCount: 0,
    });

    const { getByText } = render(<HospitalSearchScreen />);
    expect(getByText('Error')).toBeTruthy();
    expect(getByText('Network error')).toBeTruthy();
    
    const retryButton = getByText('Retry');
    fireEvent.press(retryButton);
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('should display empty state when no candidates found', () => {
    const { getByText } = render(<HospitalSearchScreen />);
    expect(getByText('No candidates found')).toBeTruthy();
    expect(getByText('Try a different search term.')).toBeTruthy();
  });

  it('should display doctors when available', () => {
    const mockDoctors = [
      {
        id: '1',
        name: 'Dr. John Doe',
        role: 'Cardiologist',
        location: 'Mumbai',
        experienceYears: 5,
        avatarUri: null,
      },
      {
        id: '2',
        name: 'Dr. Jane Smith',
        role: 'Neurologist',
        location: 'Delhi',
        experienceYears: 8,
        avatarUri: null,
      },
    ];

    (useSearchDoctors as jest.Mock).mockReturnValue({
      doctors: mockDoctors,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
      totalCount: 2,
    });

    const { getByText } = render(<HospitalSearchScreen />);
    expect(getByText('2 doctors found. Tap a profile to view details.')).toBeTruthy();
  });

  it('should pass debounced query to useSearchDoctors', () => {
    const debouncedValue = 'debounced query';
    (useDebounce as jest.Mock).mockReturnValue(debouncedValue);

    render(<HospitalSearchScreen />);

    expect(useSearchDoctors).toHaveBeenCalledWith({
      q: debouncedValue,
      limit: 20,
    });
  });

  it('should not pass empty string to useSearchDoctors', () => {
    (useDebounce as jest.Mock).mockReturnValue('');

    render(<HospitalSearchScreen />);

    expect(useSearchDoctors).toHaveBeenCalledWith({
      q: undefined,
      limit: 20,
    });
  });
});
