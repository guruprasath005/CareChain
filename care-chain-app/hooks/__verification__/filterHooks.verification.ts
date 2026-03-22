/**
 * Verification script for client-side filtering hooks
 * This file demonstrates the usage and validates the basic functionality
 */

import { useFilteredJobs } from '../useFilteredJobs';
import { useFilteredEmployees } from '../useFilteredEmployees';
import type { PostedJob } from '../useHospital';
import type { Employee } from '../useHospital';

// Sample data for verification
const sampleJobs: PostedJob[] = [
  {
    id: '1',
    title: 'Cardiologist',
    specialization: 'Cardiology',
    location: 'Mumbai',
    status: 'open',
    views: 100,
    applicants: 5,
    rejections: 0,
    salary: '₹50,000/month',
    dates: 'Jan 1 - Mar 31',
    createdAt: '2024-01-01'
  },
  {
    id: '2',
    title: 'General Surgeon',
    specialization: 'Surgery',
    location: 'Delhi',
    status: 'expired',
    views: 50,
    applicants: 2,
    rejections: 1,
    salary: '₹60,000/month',
    dates: 'Dec 1 - Dec 31',
    createdAt: '2023-12-01'
  },
  {
    id: '3',
    title: 'Pediatrician',
    specialization: 'Pediatrics',
    location: 'Bangalore',
    status: 'trash',
    views: 10,
    applicants: 0,
    rejections: 0,
    salary: '₹45,000/month',
    dates: 'Feb 1 - Apr 30',
    createdAt: '2024-02-01'
  }
];

const sampleEmployees: Employee[] = [
  {
    id: '1',
    assignmentId: 'a1',
    doctor: {
      id: 'd1',
      fullName: 'Dr. John Smith',
      avatar: 'https://example.com/avatar1.jpg',
      specialization: 'Cardiology',
      email: 'john@example.com',
      phone: '+91 9876543210'
    },
    job: {
      id: 'j1',
      title: 'Cardiologist'
    },
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    salary: 50000,
    status: 'active'
  },
  {
    id: '2',
    assignmentId: 'a2',
    doctor: {
      id: 'd2',
      fullName: 'Dr. Sarah Johnson',
      avatar: 'https://example.com/avatar2.jpg',
      specialization: 'Pediatrics',
      email: 'sarah@example.com',
      phone: '+91 9876543211'
    },
    job: {
      id: 'j2',
      title: 'Pediatrician'
    },
    startDate: '2024-02-01',
    endDate: '2024-11-30',
    salary: 45000,
    status: 'active'
  }
];

/**
 * Verification tests for useFilteredJobs hook
 */
export function verifyFilteredJobs() {
  console.log('=== Verifying useFilteredJobs ===\n');
  
  // Test 1: Filter by tab - Opened
  console.log('Test 1: Filter by tab (Opened)');
  const openedResult = useFilteredJobs({
    jobs: sampleJobs,
    searchQuery: '',
    activeTab: 'Opened'
  });
  console.log(`Expected: 1 job, Got: ${openedResult.filteredJobs.length}`);
  console.log(`Jobs: ${openedResult.filteredJobs.map(j => j.title).join(', ')}\n`);
  
  // Test 2: Filter by tab - Expired
  console.log('Test 2: Filter by tab (Expired)');
  const expiredResult = useFilteredJobs({
    jobs: sampleJobs,
    searchQuery: '',
    activeTab: 'Expired'
  });
  console.log(`Expected: 1 job, Got: ${expiredResult.filteredJobs.length}`);
  console.log(`Jobs: ${expiredResult.filteredJobs.map(j => j.title).join(', ')}\n`);
  
  // Test 3: Search by title
  console.log('Test 3: Search by title (surgeon)');
  const searchResult = useFilteredJobs({
    jobs: sampleJobs,
    searchQuery: 'surgeon',
    activeTab: 'Expired'
  });
  console.log(`Expected: 1 job, Got: ${searchResult.filteredJobs.length}`);
  console.log(`Jobs: ${searchResult.filteredJobs.map(j => j.title).join(', ')}\n`);
  
  // Test 4: Case insensitive search
  console.log('Test 4: Case insensitive search (CARDIO)');
  const caseInsensitiveResult = useFilteredJobs({
    jobs: sampleJobs,
    searchQuery: 'CARDIO',
    activeTab: 'Opened'
  });
  console.log(`Expected: 1 job, Got: ${caseInsensitiveResult.filteredJobs.length}`);
  console.log(`Jobs: ${caseInsensitiveResult.filteredJobs.map(j => j.title).join(', ')}\n`);
  
  // Test 5: Empty state
  console.log('Test 5: Empty state (no matches)');
  const emptyResult = useFilteredJobs({
    jobs: sampleJobs,
    searchQuery: 'nonexistent',
    activeTab: 'Opened'
  });
  console.log(`Expected: isEmpty=true, Got: isEmpty=${emptyResult.isEmpty}\n`);
}

/**
 * Verification tests for useFilteredEmployees hook
 */
export function verifyFilteredEmployees() {
  console.log('=== Verifying useFilteredEmployees ===\n');
  
  // Test 1: No filter
  console.log('Test 1: No filter');
  const allResult = useFilteredEmployees({
    employees: sampleEmployees,
    searchQuery: '',
    activeTab: 'Employees'
  });
  console.log(`Expected: 2 employees, Got: ${allResult.filteredEmployees.length}`);
  console.log(`Employees: ${allResult.filteredEmployees.map(e => e.doctor.fullName).join(', ')}\n`);
  
  // Test 2: Search by name
  console.log('Test 2: Search by name (john)');
  const nameResult = useFilteredEmployees({
    employees: sampleEmployees,
    searchQuery: 'john',
    activeTab: 'Employees'
  });
  console.log(`Expected: 1 employee, Got: ${nameResult.filteredEmployees.length}`);
  console.log(`Employees: ${nameResult.filteredEmployees.map(e => e.doctor.fullName).join(', ')}\n`);
  
  // Test 3: Search by role/specialization
  console.log('Test 3: Search by role (Pediatrics)');
  const roleResult = useFilteredEmployees({
    employees: sampleEmployees,
    searchQuery: 'Pediatrics',
    activeTab: 'Employees'
  });
  console.log(`Expected: 1 employee, Got: ${roleResult.filteredEmployees.length}`);
  console.log(`Employees: ${roleResult.filteredEmployees.map(e => e.doctor.fullName).join(', ')}\n`);
  
  // Test 4: Case insensitive search
  console.log('Test 4: Case insensitive search (SARAH)');
  const caseInsensitiveResult = useFilteredEmployees({
    employees: sampleEmployees,
    searchQuery: 'SARAH',
    activeTab: 'Employees'
  });
  console.log(`Expected: 1 employee, Got: ${caseInsensitiveResult.filteredEmployees.length}`);
  console.log(`Employees: ${caseInsensitiveResult.filteredEmployees.map(e => e.doctor.fullName).join(', ')}\n`);
  
  // Test 5: Empty state
  console.log('Test 5: Empty state (no matches)');
  const emptyResult = useFilteredEmployees({
    employees: sampleEmployees,
    searchQuery: 'nonexistent',
    activeTab: 'Employees'
  });
  console.log(`Expected: isEmpty=true, Got: isEmpty=${emptyResult.isEmpty}\n`);
}

/**
 * Run all verifications
 */
export function runAllVerifications() {
  verifyFilteredJobs();
  verifyFilteredEmployees();
  console.log('=== All verifications complete ===');
}
