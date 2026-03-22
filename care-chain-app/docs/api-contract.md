# CareChain App — API Endpoints + Schemas (Frontend-Derived)

Date: 2026-01-09

## 0) Important note (current repo state)
This workspace (the Expo/React Native app) currently **does not call any backend APIs**:

- No `fetch(...)`, `axios`, GraphQL, Firebase/Supabase, or server code was found.
- Most screens render from **local mock data** in:
  - `data/jobs.ts`
  - `data/candidates.ts`
  - `data/activeJobs.ts`

So there are **no “given/implemented HTTP endpoints”** to document in this repo.

What this document provides instead:

1) **Implemented data schemas** (TypeScript shapes) used by the app today.
2) **A proposed backend API contract** that matches the app’s features/screens, so you can build a backend or replace mocks safely.

If you have a backend repo (Node/Nest/Django/etc), share it and I can generate the *real* endpoint docs from that code.

---

## 1) App routes (Expo Router “endpoints”)
These are the screen routes in `app/` (Expo Router).

### Entry
- `/` → `app/index.tsx`

### Auth
- `/(auth)/onboarding`
- `/(auth)/login`
- `/(auth)/signup`
- `/(auth)/forgotpassword`
- `/(auth)/emailotp` (**file exists but currently empty**)
- `/(auth)/role` (role chooser → doctor vs hospital)

### Doctor
- `/(doctor)/profile`
- `/(doctor)/editProfile`
- `/(doctor)/careerPreferences`
- `/(doctor)/settings`

#### Doctor tabs
- `/(doctor)/(tabs)/home`
- `/(doctor)/(tabs)/search`
- `/(doctor)/(tabs)/messages`
- `/(doctor)/(tabs)/allJobs`
- `/(doctor)/(tabs)/jobDetails?id=:jobId`
- `/(doctor)/(tabs)/applications`
- `/(doctor)/(tabs)/activeJobs`
- `/(doctor)/(tabs)/activeJobManager`
- `/(doctor)/(tabs)/markAttendance`
- `/(doctor)/(tabs)/mySchedule`
- `/(doctor)/(tabs)/requestLeave`
- `/(doctor)/(tabs)/fillter` (typo in filename: `fillter.tsx`)

### Hospital
#### Hospital tabs
- `/(hospital)/(tabs)/home`
- `/(hospital)/(tabs)/search`
- `/(hospital)/(tabs)/messages` (**file exists but currently empty**)
- `/(hospital)/(tabs)/jobs`
- `/(hospital)/(tabs)/employees`
- `/(hospital)/(tabs)/allCandidates`
- `/(hospital)/(tabs)/jobPostedDetails/:id`

#### Hospital job posting wizard
- `/(hospital)/postJob/jobDetails`
- `/(hospital)/postJob/candidateSupport`
- `/(hospital)/postJob/requirements`
- `/(hospital)/postJob/review`
- `/(hospital)/postJob/success`

#### Hospital candidate details
- `/(hospital)/candidateDetails/:id`

---

## 2) Implemented schemas (used in the app today)
These are directly taken from `data/*.ts` and screens.

### 2.1 Jobs
Source: `data/jobs.ts`

```ts
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
```

### 2.2 Candidates (Hospital side)
Source: `data/candidates.ts`

```ts
export type Candidate = {
  id: string;
  name: string;
  role: string;
  location: string;
  experienceYears: number;
  avatarUri?: string;
  avatarSource?: ImageSourcePropType;
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
  role: string;              // stored as uppercase in profile detail
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
```

### 2.3 Active jobs + attendance + schedule (Doctor side)
Source: `data/activeJobs.ts`

```ts
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
  today: TodayTimingData;
  upcoming: UpcomingScheduleItem[];
};
```

### 2.4 Messages (Doctor)
Source: `app/(doctor)/(tabs)/messages.tsx`

```ts
type ThreadTag = 'Application' | 'Interview' | 'General';

type Thread = {
  id: string;
  name: string;
  subtitle: string;
  lastMessage: string;
  timeLabel: string;
  tag: ThreadTag;
  unread?: number;
};

type ChatMessage = {
  id: string;
  from: 'them' | 'me';
  text: string;
  timeLabel: string;
};
```

---

## 3) Profile structures (what the UI expects)
These are not defined as exported TypeScript types in the repo, but are implied by the Doctor profile + edit profile + career preferences screens.

### 3.1 Doctor profile (implied)
From `app/(doctor)/profile.tsx` + `app/(doctor)/editProfile.tsx`

```ts
type DoctorProfile = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  locationText: string; // e.g. city/state or address string

  roleTitle: string;    // e.g. Cardiologist
  credentials?: string; // e.g. "MD, FACC"
  experienceYears?: number;

  overview?: string;

  aadhaarMasked?: string;
  aadhaarImage?: {
    fileName: string;
    url?: string;
  };

  education?: Array<{
    institution: string;
    program: string;
    years: string;
  }>;

  licenses?: string[];
  skills?: string[];

  offPlatformExperience?: Array<{
    role: string;
    department: string;
    institution: string;
    duration: string;
    documents?: Array<{ title: string; meta?: string; url?: string }>;
  }>;

  onPlatformStats?: {
    jobsCompleted: number;
    jobsCompletedDeltaLabel?: string;
    attendanceRate?: number;
    attendanceLabel?: string;
    recentActivity?: Array<{ title: string; subtitle: string; meta: string }>;
  };
};
```

### 3.2 Doctor career preferences (implied)
From `app/(doctor)/careerPreferences.tsx`

```ts
type DoctorCareerPreferences = {
  jobType: 'Short-term' | 'Long-term' | string;

  paymentMethods: {
    perPatient: boolean;
    perHour: boolean;
    perDay: boolean;
    meals: boolean;
  };

  preferredHourlyRate?: number; // input is numeric text

  availability: {
    // UI shows per-day enabled + time slots. Current code only fully models Monday slots.
    days: Array<{
      dayName: string; // Monday, Tuesday...
      enabled: boolean;
      dateLabel?: string; // UI shows "Monday (11.01.2025)" for some days
      slots: Array<{ startTime: string; endTime: string }>;
    }>;
  };

  locationPreference: {
    travelDistanceLabel: string; // e.g. "25 KM"
    // potential: coordinates, radiusKm
  };
};
```

### 3.3 Hospital profile
A dedicated Hospital profile screen/type is not present in this repo. If you have fields you want (facility name, address, HR contact, etc.), tell me and I’ll add a precise schema + endpoints.

---

## 4) Proposed backend API contract (matches current app features)
Because the app uses local mocks today, this section is a recommended REST contract you can implement.

### Conventions
- Base URL (example): `https://api.example.com`
- Auth: Bearer token via `Authorization: Bearer <token>`
- Dates/times:
  - Use ISO8601 timestamps for start/end dates (`2026-01-09T12:00:00Z`)
  - For shift start/end, prefer ISO timestamps or `HH:mm` with a timezone field

### 4.1 Auth
#### `POST /auth/login`
Request:
```json
{ "email": "user@example.com", "password": "string" }
```
Response:
```json
{ "accessToken": "jwt", "refreshToken": "jwt", "user": { "id": "...", "role": "doctor|hospital" } }
```

#### `POST /auth/signup`
Request:
```json
{ "fullName": "string", "email": "user@example.com", "password": "string" }
```
Response: same as login OR `{ "requiresOtp": true }`

#### `POST /auth/otp/request`
Request:
```json
{ "email": "user@example.com", "purpose": "signup|forgotPassword" }
```
Response:
```json
{ "otpId": "...", "expiresInSeconds": 300 }
```

#### `POST /auth/otp/verify`
Request:
```json
{ "otpId": "...", "code": "123456" }
```
Response:
```json
{ "verified": true }
```

#### `POST /auth/password/reset`
Request:
```json
{ "email": "user@example.com", "otpId": "...", "code": "123456", "newPassword": "string" }
```
Response:
```json
{ "ok": true }
```

### 4.2 Doctor profile
#### `GET /doctor/me`
Response: `DoctorProfile`

#### `PATCH /doctor/me`
Request: partial `DoctorProfile` (editable fields)
Response: updated `DoctorProfile`

#### `GET /doctor/me/preferences`
Response: `DoctorCareerPreferences`

#### `PUT /doctor/me/preferences`
Request: `DoctorCareerPreferences`
Response: updated preferences

### 4.3 Jobs
#### `GET /jobs`
Query (suggested): `search`, `location`, `specialization`, `shiftType`, `jobType`
Response:
```json
{ "items": [/* Job[] */], "page": 1, "pageSize": 20, "total": 123 }
```

#### `GET /jobs/:id`
Response: `Job`

#### `POST /jobs/:id/apply`
Request:
```json
{ "notes": "string (optional)" }
```
Response:
```json
{ "applicationId": "...", "status": "Submitted" }
```

### 4.4 Hospital job posting wizard
This matches the post-job screens in `app/(hospital)/postJob/*`.

#### `POST /hospital/jobs`
Request (recommended):
```json
{
  "jobTitle": "string",
  "jobDescription": "string",
  "startDate": "2026-01-09T00:00:00Z",
  "endDate": "2026-02-09T00:00:00Z",
  "shiftStartTime": "09:00",
  "shiftEndTime": "17:00",
  "jobType": "Full Time|Part Time|Contract|Locum Tenens",
  "salary": "string or number",
  "candidateSupport": {
    "transportation": true,
    "accommodation": true,
    "meals": false
  },
  "requirements": {
    "qualifications": ["md", "mbbs"],
    "customQualification": "string (optional)",
    "skills": ["patient-care"],
    "customSkill": "string (optional)",
    "experience": "One Year|Two Years|3-5 Years|5+ Years"
  }
}
```
Response:
```json
{ "jobId": "...", "status": "Open" }
```

#### `GET /hospital/jobs`
Response: list of posted jobs (can reuse `Job` or a richer `HospitalJobPost` model)

### 4.5 Hospital candidates
#### `GET /hospital/candidates`
Response: `Candidate[]`

#### `GET /hospital/candidates/:id`
Response: `CandidateProfileDetails`

### 4.6 Active assignments / attendance / leave (Doctor)
These map to `data/activeJobs.ts` and Doctor tab screens.

#### `GET /doctor/assignments/active`
Response: `ActiveJob[]`

#### `GET /doctor/assignments/:id`
Response: `ActiveJobManagerData`

#### `GET /doctor/assignments/:id/attendance`
Response: `MarkAttendanceData`

#### `POST /doctor/assignments/:id/attendance/check-in`
Request:
```json
{ "timestamp": "2026-01-09T08:55:00Z" }
```

#### `POST /doctor/assignments/:id/attendance/check-out`
Request:
```json
{ "timestamp": "2026-01-09T17:05:00Z" }
```

#### `GET /doctor/leave`
Response: `RequestLeaveData`

#### `POST /doctor/leave`
Request:
```json
{ "startDate": "2026-01-12", "endDate": "2026-01-14", "type": "Sick Leave", "notes": "optional" }
```

### 4.7 Messaging
Only a Doctor messages UI exists in this repo.

#### `GET /messages/threads`
Response: `Thread[]`

#### `GET /messages/threads/:id/messages`
Response: `ChatMessage[]`

#### `POST /messages/threads/:id/messages`
Request:
```json
{ "text": "string" }
```

---

## 5) Third-party URLs currently used
These are not your backend APIs, but the app loads remote resources from them:

- Mapbox Static Images (used in doctor career preferences): `https://api.mapbox.com/styles/v1/.../static/...`
- DiceBear avatars (used in doctor search demo): `https://api.dicebear.com/7.x/avataaars/png?seed=...`
- Unsplash images (used in schedule cards): `https://images.unsplash.com/...`

---

## 6) What I need from you (optional) to make this 100% accurate
If you already have a backend or a desired base URL + auth method, send:
- Base URL
- Auth type (JWT / session / Firebase / etc.)
- Any existing endpoint list

…and I’ll rewrite Section 4 to match exactly, plus generate an OpenAPI/Swagger spec if you want.
