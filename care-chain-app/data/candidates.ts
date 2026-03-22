import type { ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type Candidate = {
  id: string;
  name: string;
  role: string;
  location: string;
  experienceYears: number;
  avatarUri?: string;
  avatarSource?: ImageSourcePropType;
  invitationStatus?: 'pending' | 'accepted' | 'declined';
  conversationId?: string;
};

export type CandidateEducation = {
  institution: string;
  program: string;
  years: string;
};

export type CandidateDocument = {
  id: string;
  title: string;
  meta: string;
};

export type CandidateRecentActivity = {
  id: string;
  title: string;
  subtitle: string;
  when: string;
};

export type CandidateProfileDetails = {
  id: string;
  name: string;
  role: string;
  overview: string;
  education: CandidateEducation[];
  licenses: string[];
  skills: string[];
  offPlatform: {
    role: string;
    department: string;
    institution: string;
    duration: string;
    documents: CandidateDocument[];
  };
  onPlatform: {
    jobsCompleted: number;
    jobsCompletedDeltaLabel: string;
    attendanceRate: number;
    attendanceLabel: string;
    recentActivity: CandidateRecentActivity[];
  };
};

export const candidates: Candidate[] = [
  {
    id: 'cand-1',
    name: 'Dr. Aakash',
    role: 'Neurologist',
    location: 'Chennai',
    experienceYears: 8,
  },
  {
    id: 'cand-2',
    name: 'Dr. Paul Raj',
    role: 'ICU Nurse',
    location: 'Chennai',
    experienceYears: 5,
  },
  {
    id: 'cand-3',
    name: 'Dr. Dhanush',
    role: 'ICU Nurse',
    location: 'Chennai',
    experienceYears: 5,
  },
  {
    id: 'cand-4',
    name: 'Dr. Balasastha',
    role: 'Cardiologist',
    location: 'Chennai',
    experienceYears: 5,
  },
  {
    id: 'cand-5',
    name: 'Dr. Keerthana S',
    role: 'General Physician',
    location: 'Bengaluru',
    experienceYears: 7,
  },
  {
    id: 'cand-6',
    name: 'Dr. Nithin Kumar',
    role: 'Anesthetist',
    location: 'Hyderabad',
    experienceYears: 4,
  },
];

export const candidateProfiles: CandidateProfileDetails[] = [
  {
    id: 'cand-1',
    name: 'Dr. Aakash',
    role: 'NEUROLOGIST',
    overview:
      'Board-Certified Neurologist with over 8 years of experience in diagnosing and treating neurological disorders. Passionate about preventive care and patient education. Seeking opportunities in a forward-thinking hospital setting.',
    education: [
      {
        institution: 'Stanford University School of Medicine',
        program: 'Doctor of Medicine(MD)',
        years: '2010 – 2014',
      },
      {
        institution: 'UCSF Medical Center',
        program: 'Internal Medicine Residency',
        years: '2014 – 2017',
      },
    ],
    licenses: ['ACLS', 'BLS', 'CCRN'],
    skills: [
      'Echocardiography',
      'nuclear Cardiology',
      'Patient Care',
      'EPIC EMR',
      'Stroke Management',
      'Neuro ICU',
      'EEG',
      'Clinical Documentation',
      'Patient Counseling',
    ],
    offPlatform: {
      role: 'Consultant Physician',
      department: 'General Medicine',
      institution: 'Apollo Multi Speciality Hospital',
      duration: 'Nov 2017 – Nov 2021',
      documents: [
        {
          id: 'doc-1',
          title: 'Letter of Recommendation',
          meta: '867 KB • 14 Feb 2022 at 11:30 am',
        },
        {
          id: 'doc-2',
          title: 'Payslip',
          meta: '867 KB • 14 Feb 2022 at 11:30 am',
        },
        {
          id: 'doc-3',
          title: 'ID Card copy',
          meta: '867 KB • 14 Feb 2022 at 11:30 am',
        },
      ],
    },
    onPlatform: {
      jobsCompleted: 247,
      jobsCompletedDeltaLabel: '+12% from last month',
      attendanceRate: 98,
      attendanceLabel: 'Excellent reliability score',
      recentActivity: [
        {
          id: 'act-1',
          title: 'Consultant Physician',
          subtitle: 'Completed • 4.8 rating',
          when: '1 week ago',
        },
        {
          id: 'act-2',
          title: 'Consultant Physician',
          subtitle: 'Completed • 4.8 rating',
          when: '2 week ago',
        },
        {
          id: 'act-3',
          title: 'Consultant Physician',
          subtitle: 'Completed • 4.8 rating',
          when: '3 week ago',
        },
      ],
    },
  },
];

export function candidateProfileById(id: string): CandidateProfileDetails | undefined {
  return candidateProfiles.find((d) => d.id === id);
}

function seedFromId(id: string): number {
  let seed = 0;
  for (let i = 0; i < id.length; i += 1) seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
  return seed;
}

function pick<T>(items: T[], seed: number, offset: number): T {
  return items[(seed + offset) % items.length];
}

function pickMany(items: string[], seed: number, count: number): string[] {
  const result: string[] = [];
  const used = new Set<number>();
  for (let i = 0; i < items.length && result.length < count; i += 1) {
    const idx = (seed + i * 7) % items.length;
    if (used.has(idx)) continue;
    used.add(idx);
    result.push(items[idx]);
  }
  return result;
}

export function getCandidateProfile(id: string): CandidateProfileDetails {
  const existing = candidateProfileById(id);
  if (existing) return existing;

  const candidate = candidates.find((c) => c.id === id) ?? candidates[0];
  const seed = seedFromId(candidate.id);

  const overviewTemplates = [
    `Board-Certified ${candidate.role} with over ${candidate.experienceYears} years of experience. Passionate about patient outcomes and clinical excellence. Seeking opportunities in a forward-thinking hospital setting in ${candidate.location}.`,
    `${candidate.role} with ${candidate.experienceYears}+ years of hands-on experience. Strong communication, rapid decision-making, and patient-first care. Open to roles in ${candidate.location} and nearby locations.`,
    `Experienced ${candidate.role} (${candidate.experienceYears} years). Focused on evidence-based practice, teamwork, and reliable shift delivery. Looking for a hospital role in ${candidate.location}.`,
  ];

  const educationPool: CandidateEducation[] = [
    {
      institution: 'Stanford University School of Medicine',
      program: 'Doctor of Medicine(MD)',
      years: '2010 – 2014',
    },
    {
      institution: 'UCSF Medical Center',
      program: 'Internal Medicine Residency',
      years: '2014 – 2017',
    },
    {
      institution: 'Johns Hopkins Hospital',
      program: 'Clinical Training',
      years: '2017 – 2019',
    },
  ];

  const licensePool = ['ACLS', 'BLS', 'CCRN', 'PALS', 'ATLS'];
  const skillPool = [
    'Patient Care',
    'Clinical Documentation',
    'EPIC EMR',
    'Triage',
    'Team Collaboration',
    'Critical Care',
    'Emergency Response',
    'Infection Control',
    'IV Therapy',
    'Ventilator Support',
    'Neuro ICU',
    'Stroke Management',
  ];

  const documents: CandidateDocument[] = [
    {
      id: 'doc-1',
      title: 'Letter of Recommendation',
      meta: '867 KB • 14 Feb 2022 at 11:30 am',
    },
    {
      id: 'doc-2',
      title: 'Payslip',
      meta: '867 KB • 14 Feb 2022 at 11:30 am',
    },
    {
      id: 'doc-3',
      title: 'ID Card copy',
      meta: '867 KB • 14 Feb 2022 at 11:30 am',
    },
  ];

  const recentActivity: CandidateRecentActivity[] = [
    {
      id: 'act-1',
      title: candidate.role,
      subtitle: 'Completed • 4.8 rating',
      when: '1 week ago',
    },
    {
      id: 'act-2',
      title: candidate.role,
      subtitle: 'Completed • 4.8 rating',
      when: '2 week ago',
    },
    {
      id: 'act-3',
      title: candidate.role,
      subtitle: 'Completed • 4.8 rating',
      when: '3 week ago',
    },
  ];

  const jobsCompleted = 180 + (seed % 120);
  const attendance = 92 + (seed % 7);
  const delta = 8 + (seed % 8);

  return {
    id: candidate.id,
    name: candidate.name,
    role: candidate.role.toUpperCase(),
    overview: pick(overviewTemplates, seed, 0),
    education: [pick(educationPool, seed, 1), pick(educationPool, seed, 2)],
    licenses: pickMany(licensePool, seed, 3),
    skills: pickMany(skillPool, seed, 9),
    offPlatform: {
      role: pick(['Consultant Physician', 'Staff Nurse', 'Duty Doctor'], seed, 3),
      department: pick(['General Medicine', 'Emergency', 'ICU', 'Cardiology'], seed, 4),
      institution: pick(['Apollo Multi Speciality Hospital', 'Fortis Healthcare', 'Government Medical College Hospital'], seed, 5),
      duration: pick(['Nov 2017 – Nov 2021', 'Jan 2018 – Dec 2020', 'Mar 2019 – Aug 2022'], seed, 6),
      documents,
    },
    onPlatform: {
      jobsCompleted,
      jobsCompletedDeltaLabel: `+${delta}% from last month`,
      attendanceRate: attendance,
      attendanceLabel: 'Excellent reliability score',
      recentActivity,
    },
  };
}

// Back-compat alias (older screens may still import this name)
export const candidateDetailsById = candidateProfileById;
