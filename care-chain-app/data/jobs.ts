export type Job = {
  id: string;
  title: string;
  hospital: string;
  location: string;
  experience: string;
  salary: string;
  avatar?: string | null;
  status: string;
  views: number;
  specialization: string;
  dates: string;
  applicants: number;
  description: string;
  qualifications: string[];
  skills: string[];
  shiftTime: string;
  shiftType: string;
};

export const jobs: Job[] = [
  {
    id: '1',
    title: 'Emergency Room Physician',
    hospital: 'Apollo Hospital',
    location: 'Chennai',
    experience: '5 Years',
    salary: '₹200/hr',
    avatar: null,
    status: 'Open',
    views: 245,
    specialization: 'Emergency Medicine',
    dates: 'Sept 10 - Dec 10',
    applicants: 12,
    description:
      'We are looking for a highly skilled and quick-thinking Emergency Room Physician to join our emergency department. This role demands sharp clinical judgment, emotional resilience, and the ability to act decisively...',
    qualifications: [
      'MBBS with specialization in Emergency Medicine',
      'Valid medical license/registration',
      'Proven experience in an Emergency Room'
    ],
    skills: ['ACLS', 'Triage', 'EHR'],
    shiftTime: '08:00 AM - 04:00 PM',
    shiftType: 'Day Shift'
  },
  {
    id: '2',
    title: 'ICU Intensivist',
    hospital: 'Fortis Healthcare',
    location: 'Bengaluru',
    experience: '4 Years',
    salary: '₹220/hr',
    avatar: null,
    status: 'Open',
    views: 180,
    specialization: 'Critical Care',
    dates: 'Oct 01 - Dec 31',
    applicants: 8,
    description:
      'Join our critical care team to provide round-the-clock management for ICU patients. We need a leader comfortable with ventilators, sepsis protocols, and multidisciplinary coordination.',
    qualifications: [
      'DM/DNB in Critical Care or equivalent',
      'Current medical registration',
      '3+ years handling ventilated patients'
    ],
    skills: ['Ventilator Management', 'Sepsis Protocols', 'Team Leadership'],
    shiftTime: '07:00 AM - 07:00 PM',
    shiftType: 'Day Shift'
  }
];
