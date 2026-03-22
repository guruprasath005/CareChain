export type ActiveJobStatus = 'Active' | 'On Leave' | 'Paused';

export type ActiveJob = {
  id: string;
  title: string;
  hospital: string;
  jobType: string;
  timeRange: string;
  status: ActiveJobStatus;
};

export type ActiveJobManagerData = {
  id: string;
  doctorName: string;
  doctorRole: string;
  status: ActiveJobStatus;
  jobCode: string;
  title: string;
  clinicName: string;
  location: string;
  todayShift: string;
  shiftType: string;
  onCall: string;
  admin: string;
  daysPresent: number;
  daysAbsent: number;
};

export type MarkAttendanceActivityItem = {
  id: string;
  day: string;
  date: string;
  title: string;
  duration: string;
  inTime: string;
  outTime: string;
};

export type MarkAttendanceData = {
  id: string;
  doctorName: string;
  doctorRole: string;
  clinicName: string;
  shiftRange: string;
  assignmentStatus: 'Active' | 'Paused' | 'On Leave';
  attendanceState: 'Checked In' | 'Checked Out';
  checkedInLabel: string;
  recentActivity: MarkAttendanceActivityItem[];
};

export type LeaveRequestStatus = 'Pending' | 'Approved' | 'Rejected';

export type LeaveRequestItem = {
  id: string;
  dateRange: string;
  typeLabel: string;
  durationLabel: string;
  status: LeaveRequestStatus;
};

export type RequestLeaveData = {
  id: string;
  doctorName: string;
  doctorRole: string;
  availableDays: number;
  usedYtdDays: number;
  usedYtdSinceLabel: string;
  recentRequests: LeaveRequestItem[];
};

export type UpcomingScheduleItem = {
  id: string;
  dayShort: string;
  dayNumber: string;
  title: string;
  subtitle: string;
  startLabel?: string;
  endLabel?: string;
  isOff?: boolean;
};

export type TodayTimingData = {
  title: string;
  clinicName: string;
  location: string;
  imageUri?: string;
  startTime: string;
  startMeridiem: string;
  endTime: string;
  endMeridiem: string;
  statusLabel: string;
  shiftDurationLabel: string;
};

export type MyScheduleData = {
  id: string;
  doctorName: string;
  doctorRole: string;
  todayDateLabel: string;
  today: TodayTimingData | null;
  upcoming: UpcomingScheduleItem[];
};

export const activeJobs: ActiveJob[] = [
  {
    id: 'aj-1',
    title: 'Registered Nurse (ICU)',
    hospital: 'Apollo Hospital',
    jobType: 'Full-Time',
    timeRange: '09:00 AM - 05:00 PM',
    status: 'Active',
  },
  {
    id: 'aj-2',
    title: 'Emergency Physician',
    hospital: 'City General',
    jobType: 'Full-Time',
    timeRange: '09:00 AM - 05:00 PM',
    status: 'Active',
  },
  {
    id: 'aj-3',
    title: 'Emergency Physician',
    hospital: 'Cardiologist',
    jobType: 'Full-Time',
    timeRange: '09:00 AM - 05:00 PM',
    status: 'On Leave',
  },
  {
    id: 'aj-4',
    title: 'Emergency Physician',
    hospital: 'Cardiologist',
    jobType: 'Full-Time',
    timeRange: '09:00 AM - 05:00 PM',
    status: 'Paused',
  },
];

export const activeJobManagerById: Record<string, ActiveJobManagerData> = {
  'aj-1': {
    id: 'aj-1',
    doctorName: 'Dr.Aakash Kannan',
    doctorRole: 'Pediatric Specialist',
    status: 'Active',
    jobCode: '#HC-8821',
    title: 'Pediatric Specialist',
    clinicName: 'Global Health Clinic',
    location: 'Building A, Room 320',
    todayShift: '09:00 AM - 05:00 PM',
    shiftType: 'Day Shift',
    onCall: 'Available',
    admin: 'Mr.Arul',
    daysPresent: 26,
    daysAbsent: 4,
  },
  'aj-2': {
    id: 'aj-2',
    doctorName: 'Dr.Aakash Kannan',
    doctorRole: 'Emergency Physician',
    status: 'Active',
    jobCode: '#HC-8822',
    title: 'Emergency Physician',
    clinicName: 'City General',
    location: 'Emergency Ward',
    todayShift: '09:00 AM - 05:00 PM',
    shiftType: 'Day Shift',
    onCall: 'Available',
    admin: 'Mr.Arul',
    daysPresent: 18,
    daysAbsent: 2,
  },
  'aj-3': {
    id: 'aj-3',
    doctorName: 'Dr.Aakash Kannan',
    doctorRole: 'Emergency Physician',
    status: 'On Leave',
    jobCode: '#HC-8823',
    title: 'Emergency Physician',
    clinicName: 'Cardiologist',
    location: 'Main Branch',
    todayShift: '09:00 AM - 05:00 PM',
    shiftType: 'Day Shift',
    onCall: 'Unavailable',
    admin: 'Mr.Arul',
    daysPresent: 12,
    daysAbsent: 6,
  },
  'aj-4': {
    id: 'aj-4',
    doctorName: 'Dr.Aakash Kannan',
    doctorRole: 'Emergency Physician',
    status: 'Paused',
    jobCode: '#HC-8824',
    title: 'Emergency Physician',
    clinicName: 'Cardiologist',
    location: 'Main Branch',
    todayShift: '09:00 AM - 05:00 PM',
    shiftType: 'Day Shift',
    onCall: 'Available',
    admin: 'Mr.Arul',
    daysPresent: 9,
    daysAbsent: 1,
  },
};

export const markAttendanceById: Record<string, MarkAttendanceData> = {
  'aj-1': {
    id: 'aj-1',
    doctorName: 'Dr.Aakash Kannan',
    doctorRole: 'Pediatric Specialist',
    clinicName: 'Global Health Clinic',
    shiftRange: '9:00 AM – 5:00 PM',
    assignmentStatus: 'Active',
    attendanceState: 'Checked In',
    checkedInLabel: '09:32 AM today',
    recentActivity: [
      { id: 'aj-1-a1', day: 'AUG', date: '9', title: 'Yesterday', duration: '8h 15m duration', inTime: '09.00 AM', outTime: '05:15 PM' },
      { id: 'aj-1-a2', day: 'AUG', date: '10', title: 'Yesterday', duration: '8h 15m duration', inTime: '09.00 AM', outTime: '05:15 PM' },
      { id: 'aj-1-a3', day: 'AUG', date: '11', title: 'Yesterday', duration: '8h 15m duration', inTime: '09.00 AM', outTime: '05:15 PM' },
    ],
  },
  'aj-2': {
    id: 'aj-2',
    doctorName: 'Dr.Aakash Kannan',
    doctorRole: 'Emergency Physician',
    clinicName: 'City General',
    shiftRange: '9:00 AM – 5:00 PM',
    assignmentStatus: 'Active',
    attendanceState: 'Checked In',
    checkedInLabel: '09:10 AM today',
    recentActivity: [
      { id: 'aj-2-a1', day: 'AUG', date: '9', title: 'Yesterday', duration: '8h 15m duration', inTime: '09.00 AM', outTime: '05:15 PM' },
      { id: 'aj-2-a2', day: 'AUG', date: '10', title: 'Yesterday', duration: '8h 15m duration', inTime: '09.00 AM', outTime: '05:15 PM' },
      { id: 'aj-2-a3', day: 'AUG', date: '11', title: 'Yesterday', duration: '8h 15m duration', inTime: '09.00 AM', outTime: '05:15 PM' },
    ],
  },
  'aj-3': {
    id: 'aj-3',
    doctorName: 'Dr.Aakash Kannan',
    doctorRole: 'Emergency Physician',
    clinicName: 'Cardiologist',
    shiftRange: '9:00 AM – 5:00 PM',
    assignmentStatus: 'On Leave',
    attendanceState: 'Checked Out',
    checkedInLabel: '—',
    recentActivity: [
      { id: 'aj-3-a1', day: 'AUG', date: '9', title: 'Yesterday', duration: '0h 0m duration', inTime: '—', outTime: '—' },
      { id: 'aj-3-a2', day: 'AUG', date: '10', title: 'Yesterday', duration: '0h 0m duration', inTime: '—', outTime: '—' },
      { id: 'aj-3-a3', day: 'AUG', date: '11', title: 'Yesterday', duration: '0h 0m duration', inTime: '—', outTime: '—' },
    ],
  },
  'aj-4': {
    id: 'aj-4',
    doctorName: 'Dr.Aakash Kannan',
    doctorRole: 'Emergency Physician',
    clinicName: 'Cardiologist',
    shiftRange: '9:00 AM – 5:00 PM',
    assignmentStatus: 'Paused',
    attendanceState: 'Checked In',
    checkedInLabel: '09:00 AM today',
    recentActivity: [
      { id: 'aj-4-a1', day: 'AUG', date: '9', title: 'Yesterday', duration: '8h 15m duration', inTime: '09.00 AM', outTime: '05:15 PM' },
      { id: 'aj-4-a2', day: 'AUG', date: '10', title: 'Yesterday', duration: '8h 15m duration', inTime: '09.00 AM', outTime: '05:15 PM' },
      { id: 'aj-4-a3', day: 'AUG', date: '11', title: 'Yesterday', duration: '8h 15m duration', inTime: '09.00 AM', outTime: '05:15 PM' },
    ],
  },
};

export const requestLeaveById: Record<string, RequestLeaveData> = {
  'aj-1': {
    id: 'aj-1',
    doctorName: 'Dr.Aakash Kannan',
    doctorRole: 'Pediatric Specialist',
    availableDays: 26,
    usedYtdDays: 4,
    usedYtdSinceLabel: 'Since Jan 1',
    recentRequests: [
      { id: 'lr-1', dateRange: 'Sep 12 – Sep 14', typeLabel: 'Sick Leave', durationLabel: 'Three days', status: 'Pending' },
      { id: 'lr-2', dateRange: 'Aug 05', typeLabel: 'Sick Leave', durationLabel: 'one days', status: 'Approved' },
      { id: 'lr-3', dateRange: 'Jul 12 – Jul 14', typeLabel: 'Sick Leave', durationLabel: 'Three days', status: 'Rejected' },
    ],
  },
  'aj-2': {
    id: 'aj-2',
    doctorName: 'Dr.Aakash Kannan',
    doctorRole: 'Emergency Physician',
    availableDays: 18,
    usedYtdDays: 2,
    usedYtdSinceLabel: 'Since Jan 1',
    recentRequests: [
      { id: 'lr-4', dateRange: 'Sep 12 – Sep 14', typeLabel: 'Sick Leave', durationLabel: 'Three days', status: 'Pending' },
      { id: 'lr-5', dateRange: 'Aug 05', typeLabel: 'Sick Leave', durationLabel: 'one days', status: 'Approved' },
      { id: 'lr-6', dateRange: 'Jul 12 – Jul 14', typeLabel: 'Sick Leave', durationLabel: 'Three days', status: 'Rejected' },
    ],
  },
  'aj-3': {
    id: 'aj-3',
    doctorName: 'Dr.Aakash Kannan',
    doctorRole: 'Emergency Physician',
    availableDays: 12,
    usedYtdDays: 6,
    usedYtdSinceLabel: 'Since Jan 1',
    recentRequests: [
      { id: 'lr-7', dateRange: 'Sep 12 – Sep 14', typeLabel: 'Sick Leave', durationLabel: 'Three days', status: 'Pending' },
      { id: 'lr-8', dateRange: 'Aug 05', typeLabel: 'Sick Leave', durationLabel: 'one days', status: 'Approved' },
      { id: 'lr-9', dateRange: 'Jul 12 – Jul 14', typeLabel: 'Sick Leave', durationLabel: 'Three days', status: 'Rejected' },
    ],
  },
  'aj-4': {
    id: 'aj-4',
    doctorName: 'Dr.Aakash Kannan',
    doctorRole: 'Emergency Physician',
    availableDays: 9,
    usedYtdDays: 1,
    usedYtdSinceLabel: 'Since Jan 1',
    recentRequests: [
      { id: 'lr-10', dateRange: 'Sep 12 – Sep 14', typeLabel: 'Sick Leave', durationLabel: 'Three days', status: 'Pending' },
      { id: 'lr-11', dateRange: 'Aug 05', typeLabel: 'Sick Leave', durationLabel: 'one days', status: 'Approved' },
      { id: 'lr-12', dateRange: 'Jul 12 – Jul 14', typeLabel: 'Sick Leave', durationLabel: 'Three days', status: 'Rejected' },
    ],
  },
};

export const myScheduleById: Record<string, MyScheduleData> = {
  'aj-1': {
    id: 'aj-1',
    doctorName: 'Dr.Aakash Kannan',
    doctorRole: 'Pediatric Specialist',
    todayDateLabel: 'August 20, 2025',
    today: {
      title: 'Pediatric Specialist',
      clinicName: 'Global Health Clinic',
      location: 'Building A, Room 320',
      imageUri: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=400&q=80',
      startTime: '09:00',
      startMeridiem: 'AM',
      endTime: '07:00',
      endMeridiem: 'PM',
      statusLabel: 'Active',
      shiftDurationLabel: '8 Hours Shift',
    },
    upcoming: [
      { id: 'sch-1', dayShort: 'FRI', dayNumber: '21', title: 'Regular Shift', subtitle: 'Global Health Clinic', startLabel: '09:00 AM', endLabel: '05:00 PM' },
      { id: 'sch-2', dayShort: 'SAT', dayNumber: '22', title: 'Regular Shift', subtitle: 'Global Health Clinic', startLabel: '09:00 AM', endLabel: '05:00 PM' },
      { id: 'sch-3', dayShort: 'SUN', dayNumber: '23', title: 'No Shift Scheduled', subtitle: 'Enjoy your day off!!', isOff: true },
      { id: 'sch-4', dayShort: 'MON', dayNumber: '24', title: 'Regular Shift', subtitle: 'Global Health Clinic', startLabel: '09:00 AM', endLabel: '05:00 PM' },
      { id: 'sch-5', dayShort: 'TUE', dayNumber: '25', title: 'Regular Shift', subtitle: 'Global Health Clinic', startLabel: '09:00 AM', endLabel: '05:00 PM' },
    ],
  },
  'aj-2': {
    id: 'aj-2',
    doctorName: 'Dr.Aakash Kannan',
    doctorRole: 'Emergency Physician',
    todayDateLabel: 'August 20, 2025',
    today: {
      title: 'Emergency Physician',
      clinicName: 'City General',
      location: 'Building A, Room 320',
      imageUri: 'https://images.unsplash.com/photo-1579684288452-8e3f6ff0b22a?auto=format&fit=crop&w=400&q=80',
      startTime: '09:00',
      startMeridiem: 'AM',
      endTime: '07:00',
      endMeridiem: 'PM',
      statusLabel: 'Active',
      shiftDurationLabel: '8 Hours Shift',
    },
    upcoming: [
      { id: 'sch-6', dayShort: 'FRI', dayNumber: '21', title: 'Regular Shift', subtitle: 'City General', startLabel: '09:00 AM', endLabel: '05:00 PM' },
      { id: 'sch-7', dayShort: 'SAT', dayNumber: '22', title: 'Regular Shift', subtitle: 'City General', startLabel: '09:00 AM', endLabel: '05:00 PM' },
      { id: 'sch-8', dayShort: 'SUN', dayNumber: '23', title: 'No Shift Scheduled', subtitle: 'Enjoy your day off!!', isOff: true },
      { id: 'sch-9', dayShort: 'MON', dayNumber: '24', title: 'Regular Shift', subtitle: 'City General', startLabel: '09:00 AM', endLabel: '05:00 PM' },
      { id: 'sch-10', dayShort: 'TUE', dayNumber: '25', title: 'Regular Shift', subtitle: 'City General', startLabel: '09:00 AM', endLabel: '05:00 PM' },
    ],
  },
  'aj-3': {
    id: 'aj-3',
    doctorName: 'Dr.Aakash Kannan',
    doctorRole: 'Emergency Physician',
    todayDateLabel: 'August 20, 2025',
    today: {
      title: 'Emergency Physician',
      clinicName: 'Cardiologist',
      location: 'Building A, Room 320',
      imageUri: 'https://images.unsplash.com/photo-1580281658628-5a0c3a19f990?auto=format&fit=crop&w=400&q=80',
      startTime: '09:00',
      startMeridiem: 'AM',
      endTime: '07:00',
      endMeridiem: 'PM',
      statusLabel: 'On Leave',
      shiftDurationLabel: '8 Hours Shift',
    },
    upcoming: [
      { id: 'sch-11', dayShort: 'FRI', dayNumber: '21', title: 'Regular Shift', subtitle: 'Cardiologist', startLabel: '09:00 AM', endLabel: '05:00 PM' },
      { id: 'sch-12', dayShort: 'SAT', dayNumber: '22', title: 'Regular Shift', subtitle: 'Cardiologist', startLabel: '09:00 AM', endLabel: '05:00 PM' },
      { id: 'sch-13', dayShort: 'SUN', dayNumber: '23', title: 'No Shift Scheduled', subtitle: 'Enjoy your day off!!', isOff: true },
      { id: 'sch-14', dayShort: 'MON', dayNumber: '24', title: 'Regular Shift', subtitle: 'Cardiologist', startLabel: '09:00 AM', endLabel: '05:00 PM' },
      { id: 'sch-15', dayShort: 'TUE', dayNumber: '25', title: 'Regular Shift', subtitle: 'Cardiologist', startLabel: '09:00 AM', endLabel: '05:00 PM' },
    ],
  },
  'aj-4': {
    id: 'aj-4',
    doctorName: 'Dr.Aakash Kannan',
    doctorRole: 'Emergency Physician',
    todayDateLabel: 'August 20, 2025',
    today: {
      title: 'Emergency Physician',
      clinicName: 'Cardiologist',
      location: 'Building A, Room 320',
      imageUri: 'https://images.unsplash.com/photo-1580281658628-5a0c3a19f990?auto=format&fit=crop&w=400&q=80',
      startTime: '09:00',
      startMeridiem: 'AM',
      endTime: '07:00',
      endMeridiem: 'PM',
      statusLabel: 'Active',
      shiftDurationLabel: '8 Hours Shift',
    },
    upcoming: [
      { id: 'sch-16', dayShort: 'FRI', dayNumber: '21', title: 'Regular Shift', subtitle: 'Cardiologist', startLabel: '09:00 AM', endLabel: '05:00 PM' },
      { id: 'sch-17', dayShort: 'SAT', dayNumber: '22', title: 'Regular Shift', subtitle: 'Cardiologist', startLabel: '09:00 AM', endLabel: '05:00 PM' },
      { id: 'sch-18', dayShort: 'SUN', dayNumber: '23', title: 'No Shift Scheduled', subtitle: 'Enjoy your day off!!', isOff: true },
      { id: 'sch-19', dayShort: 'MON', dayNumber: '24', title: 'Regular Shift', subtitle: 'Cardiologist', startLabel: '09:00 AM', endLabel: '05:00 PM' },
      { id: 'sch-20', dayShort: 'TUE', dayNumber: '25', title: 'Regular Shift', subtitle: 'Cardiologist', startLabel: '09:00 AM', endLabel: '05:00 PM' },
    ],
  },
};
