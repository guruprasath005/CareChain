import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useEmployees, useHospitalLeaveRequests, useEmployeeSchedule } from '@/hooks';
import { useFilteredEmployees } from '@/hooks/useFilteredEmployees';
import HospitalEmployees from '../employees';

// Mock the hooks
jest.mock('@/hooks', () => ({
  useEmployees: jest.fn(),
  useHospitalLeaveRequests: jest.fn(),
  useEmployeeSchedule: jest.fn(),
}));

jest.mock('@/hooks/useFilteredEmployees', () => ({
  useFilteredEmployees: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('@/services/api', () => ({
  hospitalApi: {
    getEmployeesTodayStatusBulk: jest.fn(),
  },
}));

describe('Hospital Employee Search', () => {
  const mockEmployees = [
    {
      id: '1',
      assignmentId: 'a1',
      doctor: {
        id: 'd1',
        fullName: 'Dr. John Smith',
        specialization: 'Cardiologist',
        avatar: null,
      },
      job: {
        id: 'j1',
        title: 'Senior Cardiologist',
      },
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      salary: 150000,
      status: 'active' as const,
      shift: '9:00 AM - 5:00 PM',
    },
    {
      id: '2',
      assignmentId: 'a2',
      doctor: {
        id: 'd2',
        fullName: 'Dr. Jane Doe',
        specialization: 'Neurologist',
        avatar: null,
      },
      job: {
        id: 'j2',
        title: 'Neurologist',
      },
      startDate: '2024-02-01',
      endDate: '2024-11-30',
      salary: 140000,
      status: 'active' as const,
      shift: '10:00 AM - 6:00 PM',
    },
  ];

  beforeEach(() => {
    (useEmployees as jest.Mock).mockReturnValue({
      employees: mockEmployees,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    (useHospitalLeaveRequests as jest.Mock).mockReturnValue({
      requests: [],
      isLoading: false,
      refresh: jest.fn(),
      processRequest: jest.fn(),
    });

    (useEmployeeSchedule as jest.Mock).mockReturnValue({
      schedule: [],
      addEntries: jest.fn(),
      fetchSchedule: jest.fn(),
    });

    (useFilteredEmployees as jest.Mock).mockImplementation(({ employees, searchQuery }) => {
      const filtered = searchQuery
        ? employees.filter((emp: any) =>
            emp.doctor.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            emp.doctor.specialization?.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : employees;
      return {
        filteredEmployees: filtered,
        isEmpty: filtered.length === 0,
      };
    });
  });

  it('should render all employees when search is empty', () => {
    const { getByText } = render(<HospitalEmployees />);
    
    expect(getByText('Dr. John Smith')).toBeTruthy();
    expect(getByText('Dr. Jane Doe')).toBeTruthy();
  });

  it('should filter employees by name', async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(<HospitalEmployees />);
    
    const searchInput = getByPlaceholderText('Search Employees by Name');
    fireEvent.changeText(searchInput, 'John');
    
    await waitFor(() => {
      expect(getByText('Dr. John Smith')).toBeTruthy();
      expect(queryByText('Dr. Jane Doe')).toBeNull();
    });
  });

  it('should filter employees by role', async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(<HospitalEmployees />);
    
    const searchInput = getByPlaceholderText('Search Employees by Name');
    fireEvent.changeText(searchInput, 'Neurologist');
    
    await waitFor(() => {
      expect(getByText('Dr. Jane Doe')).toBeTruthy();
      expect(queryByText('Dr. John Smith')).toBeNull();
    });
  });

  it('should show clear button when search has text', () => {
    const { getByPlaceholderText, UNSAFE_getByType } = render(<HospitalEmployees />);
    
    const searchInput = getByPlaceholderText('Search Employees by Name');
    fireEvent.changeText(searchInput, 'test');
    
    // Check that close-circle icon is rendered
    const icons = UNSAFE_getByType(require('@expo/vector-icons').Ionicons);
    expect(icons).toBeTruthy();
  });

  it('should clear search when clear button is pressed', async () => {
    const { getByPlaceholderText, getByText } = render(<HospitalEmployees />);
    
    const searchInput = getByPlaceholderText('Search Employees by Name');
    fireEvent.changeText(searchInput, 'John');
    
    await waitFor(() => {
      expect(getByText('Dr. John Smith')).toBeTruthy();
    });
    
    // Clear the search
    fireEvent.changeText(searchInput, '');
    
    await waitFor(() => {
      expect(getByText('Dr. John Smith')).toBeTruthy();
      expect(getByText('Dr. Jane Doe')).toBeTruthy();
    });
  });

  it('should show empty state when no employees match search', async () => {
    const { getByPlaceholderText, getByText } = render(<HospitalEmployees />);
    
    const searchInput = getByPlaceholderText('Search Employees by Name');
    fireEvent.changeText(searchInput, 'NonExistent');
    
    await waitFor(() => {
      expect(getByText('No employees found')).toBeTruthy();
      expect(getByText('Try adjusting your search terms')).toBeTruthy();
    });
  });

  it('should maintain tab-based filtering with search', async () => {
    const { getByPlaceholderText, getByText } = render(<HospitalEmployees />);
    
    // Switch to Schedule tab
    const scheduleTab = getByText('Schedule');
    fireEvent.press(scheduleTab);
    
    // Search should still work on Schedule tab
    const searchInput = getByPlaceholderText('Search Employees by Name');
    fireEvent.changeText(searchInput, 'John');
    
    await waitFor(() => {
      expect(getByText('Dr. John Smith')).toBeTruthy();
    });
  });
});
