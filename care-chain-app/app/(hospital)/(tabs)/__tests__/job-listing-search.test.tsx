import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import HospitalJobsPosted from '../jobs';
import { usePostedJobs, useFilteredJobs } from '@/hooks';
import { useRouter } from 'expo-router';

// Mock the hooks
jest.mock('@/hooks', () => ({
  usePostedJobs: jest.fn(),
  useFilteredJobs: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

describe('HospitalJobsPosted - Job Listing Search', () => {
  const mockRefetch = jest.fn();
  const mockDeleteJob = jest.fn();
  const mockRestoreJob = jest.fn();
  const mockDeleteJobPermanently = jest.fn();
  const mockPush = jest.fn();

  const mockJobs = [
    {
      id: '1',
      title: 'Cardiologist Position',
      specialization: 'Cardiology',
      location: 'Mumbai',
      status: 'open' as const,
      views: 10,
      applicants: 5,
      rejections: 0,
      salary: '₹50,000/month',
      dates: 'Jan 1 - Mar 31',
      shiftTime: '9:00 AM - 5:00 PM',
      createdAt: '2024-01-01',
    },
    {
      id: '2',
      title: 'Neurologist Required',
      specialization: 'Neurology',
      location: 'Delhi',
      status: 'open' as const,
      views: 8,
      applicants: 3,
      rejections: 1,
      salary: '₹60,000/month',
      dates: 'Feb 1 - Apr 30',
      shiftTime: '10:00 AM - 6:00 PM',
      createdAt: '2024-01-02',
    },
    {
      id: '3',
      title: 'General Physician',
      specialization: 'General Medicine',
      location: 'Bangalore',
      status: 'expired' as const,
      views: 15,
      applicants: 10,
      rejections: 2,
      salary: '₹40,000/month',
      dates: 'Dec 1 - Dec 31',
      shiftTime: '8:00 AM - 4:00 PM',
      createdAt: '2023-12-01',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (usePostedJobs as jest.Mock).mockReturnValue({
      jobs: mockJobs,
      loading: false,
      error: null,
      refetch: mockRefetch,
      deleteJob: mockDeleteJob,
      restoreJob: mockRestoreJob,
      deleteJobPermanently: mockDeleteJobPermanently,
    });
    (useFilteredJobs as jest.Mock).mockReturnValue({
      filteredJobs: mockJobs.filter(j => j.status === 'open'),
      isEmpty: false,
    });
  });

  describe('Search Input', () => {
    it('should render search input with correct placeholder', () => {
      const { getByPlaceholderText } = render(<HospitalJobsPosted />);
      expect(getByPlaceholderText('Search for Job Posts by Post Title')).toBeTruthy();
    });

    it('should update search query on text input', () => {
      const { getByPlaceholderText } = render(<HospitalJobsPosted />);
      const input = getByPlaceholderText('Search for Job Posts by Post Title');
      
      fireEvent.changeText(input, 'Cardiologist');
      expect(input.props.value).toBe('Cardiologist');
    });

    it('should show clear button when search query is not empty', () => {
      const { getByPlaceholderText, getByLabelText } = render(<HospitalJobsPosted />);
      const input = getByPlaceholderText('Search for Job Posts by Post Title');
      
      fireEvent.changeText(input, 'test');
      
      const clearButton = getByLabelText('Clear search');
      expect(clearButton).toBeTruthy();
    });

    it('should clear search query when clear button is pressed', () => {
      const { getByPlaceholderText, getByLabelText } = render(<HospitalJobsPosted />);
      const input = getByPlaceholderText('Search for Job Posts by Post Title');
      
      fireEvent.changeText(input, 'test');
      const clearButton = getByLabelText('Clear search');
      fireEvent.press(clearButton);
      
      expect(input.props.value).toBe('');
    });
  });

  describe('Tab-based Filtering', () => {
    it('should filter jobs by Opened tab', () => {
      render(<HospitalJobsPosted />);
      
      expect(useFilteredJobs).toHaveBeenCalledWith({
        jobs: mockJobs,
        searchQuery: '',
        activeTab: 'Opened',
      });
    });

    it('should filter jobs by Expired tab when tab is changed', () => {
      const { getByText } = render(<HospitalJobsPosted />);
      
      const expiredTab = getByText('Expired');
      fireEvent.press(expiredTab);
      
      expect(useFilteredJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          activeTab: 'Expired',
        })
      );
    });

    it('should filter jobs by Trash tab when tab is changed', () => {
      const { getByText } = render(<HospitalJobsPosted />);
      
      const trashTab = getByText('Trash');
      fireEvent.press(trashTab);
      
      expect(useFilteredJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          activeTab: 'Trash',
        })
      );
    });
  });

  describe('Search with Empty Query', () => {
    it('should pass empty string to useFilteredJobs when no search query', () => {
      render(<HospitalJobsPosted />);
      
      expect(useFilteredJobs).toHaveBeenCalledWith({
        jobs: mockJobs,
        searchQuery: '',
        activeTab: 'Opened',
      });
    });

    it('should display all jobs in active tab when search is empty', () => {
      (useFilteredJobs as jest.Mock).mockReturnValue({
        filteredJobs: mockJobs.filter(j => j.status === 'open'),
        isEmpty: false,
      });

      const { getByText } = render(<HospitalJobsPosted />);
      
      expect(getByText('Cardiologist Position')).toBeTruthy();
      expect(getByText('Neurologist Required')).toBeTruthy();
    });
  });

  describe('Search with No Matches', () => {
    it('should display empty state when no jobs match search', () => {
      (useFilteredJobs as jest.Mock).mockReturnValue({
        filteredJobs: [],
        isEmpty: true,
      });

      const { getByPlaceholderText, getByText } = render(<HospitalJobsPosted />);
      const input = getByPlaceholderText('Search for Job Posts by Post Title');
      
      fireEvent.changeText(input, 'Nonexistent Job');
      
      expect(getByText('No jobs match your search')).toBeTruthy();
      expect(getByText('Try adjusting your search terms')).toBeTruthy();
    });

    it('should show clear search button in empty state', () => {
      (useFilteredJobs as jest.Mock).mockReturnValue({
        filteredJobs: [],
        isEmpty: true,
      });

      const { getByPlaceholderText, getByText } = render(<HospitalJobsPosted />);
      const input = getByPlaceholderText('Search for Job Posts by Post Title');
      
      fireEvent.changeText(input, 'Nonexistent Job');
      
      const clearButton = getByText('Clear Search');
      expect(clearButton).toBeTruthy();
    });

    it('should clear search when clear button in empty state is pressed', () => {
      (useFilteredJobs as jest.Mock).mockReturnValue({
        filteredJobs: [],
        isEmpty: true,
      });

      const { getByPlaceholderText, getByText } = render(<HospitalJobsPosted />);
      const input = getByPlaceholderText('Search for Job Posts by Post Title');
      
      fireEvent.changeText(input, 'Nonexistent Job');
      
      const clearButton = getByText('Clear Search');
      fireEvent.press(clearButton);
      
      expect(input.props.value).toBe('');
    });
  });

  describe('Empty State without Search', () => {
    it('should display tab-specific empty state when no jobs in tab', () => {
      (useFilteredJobs as jest.Mock).mockReturnValue({
        filteredJobs: [],
        isEmpty: true,
      });

      const { getByText } = render(<HospitalJobsPosted />);
      
      expect(getByText('No opened jobs')).toBeTruthy();
    });

    it('should not show clear search button when no search query', () => {
      (useFilteredJobs as jest.Mock).mockReturnValue({
        filteredJobs: [],
        isEmpty: true,
      });

      const { queryByText } = render(<HospitalJobsPosted />);
      
      expect(queryByText('Clear Search')).toBeNull();
    });
  });

  describe('Real-time Client-side Filtering', () => {
    it('should call useFilteredJobs with updated search query', () => {
      const { getByPlaceholderText } = render(<HospitalJobsPosted />);
      const input = getByPlaceholderText('Search for Job Posts by Post Title');
      
      fireEvent.changeText(input, 'Cardio');
      
      expect(useFilteredJobs).toHaveBeenCalledWith({
        jobs: mockJobs,
        searchQuery: 'Cardio',
        activeTab: 'Opened',
      });
    });

    it('should maintain tab filter when searching', () => {
      const { getByPlaceholderText, getByText } = render(<HospitalJobsPosted />);
      
      // Switch to Expired tab
      const expiredTab = getByText('Expired');
      fireEvent.press(expiredTab);
      
      // Then search
      const input = getByPlaceholderText('Search for Job Posts by Post Title');
      fireEvent.changeText(input, 'General');
      
      expect(useFilteredJobs).toHaveBeenCalledWith({
        jobs: mockJobs,
        searchQuery: 'General',
        activeTab: 'Expired',
      });
    });
  });
});
