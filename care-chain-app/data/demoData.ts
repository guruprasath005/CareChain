// Demo data for testing purposes - works alongside real data
export const demoHospitals = [
    { id: 'demo-h1', name: 'Apollo Hospital', location: 'Chennai', type: 'Multi-Specialty', rating: 4.8, avatar: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400' },
    { id: 'demo-h2', name: 'Fortis Healthcare', location: 'Mumbai', type: 'Multi-Specialty', rating: 4.7, avatar: 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=400' },
    { id: 'demo-h3', name: 'Max Hospital', location: 'Delhi', type: 'Super Specialty', rating: 4.9, avatar: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=400' },
    { id: 'demo-h4', name: 'Manipal Hospital', location: 'Bangalore', type: 'Multi-Specialty', rating: 4.6, avatar: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=400' },
    { id: 'demo-h5', name: 'Narayana Health', location: 'Kolkata', type: 'Cardiac Care', rating: 4.8, avatar: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400' },
    { id: 'demo-h6', name: 'AIIMS Hospital', location: 'New Delhi', type: 'Government', rating: 4.9, avatar: 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=400' },
    { id: 'demo-h7', name: 'Medanta Hospital', location: 'Gurgaon', type: 'Multi-Specialty', rating: 4.7, avatar: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=400' },
    { id: 'demo-h8', name: 'Kokilaben Hospital', location: 'Mumbai', type: 'Super Specialty', rating: 4.8, avatar: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=400' },
    { id: 'demo-h9', name: 'Lilavati Hospital', location: 'Mumbai', type: 'Multi-Specialty', rating: 4.6, avatar: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400' },
    { id: 'demo-h10', name: 'Sankara Nethralaya', location: 'Chennai', type: 'Eye Care', rating: 4.9, avatar: 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=400' },
];

export const demoDoctors = [
    { id: 'demo-d1', fullName: 'Dr. Rajesh Kumar', specialization: 'Cardiologist', experience: 15, rating: 4.8, avatar: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400' },
    { id: 'demo-d2', fullName: 'Dr. Priya Sharma', specialization: 'Pediatrician', experience: 10, rating: 4.9, avatar: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400' },
    { id: 'demo-d3', fullName: 'Dr. Amit Patel', specialization: 'Orthopedic Surgeon', experience: 12, rating: 4.7, avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400' },
    { id: 'demo-d4', fullName: 'Dr. Sneha Reddy', specialization: 'Dermatologist', experience: 8, rating: 4.8, avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400' },
    { id: 'demo-d5', fullName: 'Dr. Vikram Singh', specialization: 'Neurologist', experience: 18, rating: 4.9, avatar: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400' },
    { id: 'demo-d6', fullName: 'Dr. Anjali Verma', specialization: 'Gynecologist', experience: 14, rating: 4.7, avatar: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400' },
    { id: 'demo-d7', fullName: 'Dr. Karthik Menon', specialization: 'General Physician', experience: 9, rating: 4.6, avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400' },
    { id: 'demo-d8', fullName: 'Dr. Meera Iyer', specialization: 'Ophthalmologist', experience: 11, rating: 4.8, avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400' },
    { id: 'demo-d9', fullName: 'Dr. Arjun Nair', specialization: 'ENT Specialist', experience: 13, rating: 4.7, avatar: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400' },
    { id: 'demo-d10', fullName: 'Dr. Kavya Krishnan', specialization: 'Psychiatrist', experience: 10, rating: 4.9, avatar: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400' },
];

export const demoJobs = [
    { id: 'demo-j1', title: 'Senior Cardiologist', hospital: 'Apollo Hospital', hospitalId: 'demo-h1', location: 'Chennai', type: 'Full-Time', salary: '₹15-20 LPA', experience: '10+ years', postedDate: '2026-01-20' },
    { id: 'demo-j2', title: 'Pediatric Specialist', hospital: 'Fortis Healthcare', hospitalId: 'demo-h2', location: 'Mumbai', type: 'Full-Time', salary: '₹12-18 LPA', experience: '8+ years', postedDate: '2026-01-22' },
    { id: 'demo-j3', title: 'Orthopedic Surgeon', hospital: 'Max Hospital', hospitalId: 'demo-h3', location: 'Delhi', type: 'Contract', salary: '₹18-25 LPA', experience: '12+ years', postedDate: '2026-01-23' },
    { id: 'demo-j4', title: 'Dermatology Consultant', hospital: 'Manipal Hospital', hospitalId: 'demo-h4', location: 'Bangalore', type: 'Part-Time', salary: '₹10-15 LPA', experience: '5+ years', postedDate: '2026-01-24' },
    { id: 'demo-j5', title: 'Neurologist', hospital: 'Narayana Health', hospitalId: 'demo-h5', location: 'Kolkata', type: 'Full-Time', salary: '₹20-30 LPA', experience: '15+ years', postedDate: '2026-01-25' },
    { id: 'demo-j6', title: 'Gynecologist', hospital: 'AIIMS Hospital', hospitalId: 'demo-h6', location: 'New Delhi', type: 'Full-Time', salary: '₹14-20 LPA', experience: '10+ years', postedDate: '2026-01-26' },
    { id: 'demo-j7', title: 'General Physician', hospital: 'Medanta Hospital', hospitalId: 'demo-h7', location: 'Gurgaon', type: 'Full-Time', salary: '₹8-12 LPA', experience: '5+ years', postedDate: '2026-01-26' },
    { id: 'demo-j8', title: 'Eye Specialist', hospital: 'Kokilaben Hospital', hospitalId: 'demo-h8', location: 'Mumbai', type: 'Contract', salary: '₹12-18 LPA', experience: '8+ years', postedDate: '2026-01-27' },
    { id: 'demo-j9', title: 'ENT Surgeon', hospital: 'Lilavati Hospital', hospitalId: 'demo-h9', location: 'Mumbai', type: 'Full-Time', salary: '₹15-22 LPA', experience: '10+ years', postedDate: '2026-01-27' },
    { id: 'demo-j10', title: 'Psychiatrist', hospital: 'Sankara Nethralaya', hospitalId: 'demo-h10', location: 'Chennai', type: 'Part-Time', salary: '₹10-16 LPA', experience: '7+ years', postedDate: '2026-01-28' },
];

export const demoEmployees = [
    {
        id: 'demo-e1',
        assignmentId: 'demo-a1',
        doctor: demoDoctors[0],
        job: demoJobs[0],
        hospital: demoHospitals[0],
        status: 'active',
        joinedDate: '2025-12-01',
        assignmentCode: '#EMP-001'
    },
    {
        id: 'demo-e2',
        assignmentId: 'demo-a2',
        doctor: demoDoctors[1],
        job: demoJobs[1],
        hospital: demoHospitals[1],
        status: 'active',
        joinedDate: '2025-12-05',
        assignmentCode: '#EMP-002'
    },
    {
        id: 'demo-e3',
        assignmentId: 'demo-a3',
        doctor: demoDoctors[2],
        job: demoJobs[2],
        hospital: demoHospitals[2],
        status: 'active',
        joinedDate: '2025-12-10',
        assignmentCode: '#EMP-003'
    },
    {
        id: 'demo-e4',
        assignmentId: 'demo-a4',
        doctor: demoDoctors[3],
        job: demoJobs[3],
        hospital: demoHospitals[3],
        status: 'on_leave',
        joinedDate: '2025-12-12',
        assignmentCode: '#EMP-004'
    },
    {
        id: 'demo-e5',
        assignmentId: 'demo-a5',
        doctor: demoDoctors[4],
        job: demoJobs[4],
        hospital: demoHospitals[4],
        status: 'active',
        joinedDate: '2025-12-15',
        assignmentCode: '#EMP-005'
    },
    {
        id: 'demo-e6',
        assignmentId: 'demo-a6',
        doctor: demoDoctors[5],
        job: demoJobs[5],
        hospital: demoHospitals[5],
        status: 'active',
        joinedDate: '2025-12-18',
        assignmentCode: '#EMP-006'
    },
    {
        id: 'demo-e7',
        assignmentId: 'demo-a7',
        doctor: demoDoctors[6],
        job: demoJobs[6],
        hospital: demoHospitals[6],
        status: 'paused',
        joinedDate: '2025-12-20',
        assignmentCode: '#EMP-007'
    },
    {
        id: 'demo-e8',
        assignmentId: 'demo-a8',
        doctor: demoDoctors[7],
        job: demoJobs[7],
        hospital: demoHospitals[7],
        status: 'active',
        joinedDate: '2025-12-22',
        assignmentCode: '#EMP-008'
    },
    {
        id: 'demo-e9',
        assignmentId: 'demo-a9',
        doctor: demoDoctors[8],
        job: demoJobs[8],
        hospital: demoHospitals[8],
        status: 'active',
        joinedDate: '2025-12-25',
        assignmentCode: '#EMP-009'
    },
    {
        id: 'demo-e10',
        assignmentId: 'demo-a10',
        doctor: demoDoctors[9],
        job: demoJobs[9],
        hospital: demoHospitals[9],
        status: 'active',
        joinedDate: '2026-01-02',
        assignmentCode: '#EMP-010'
    },
];

// Helper to check if demo mode is enabled
export const isDemoMode = () => {
    // You can control this via environment variable or a setting
    return true; // Set to true for demo purposes
};
