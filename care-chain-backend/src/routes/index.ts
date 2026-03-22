// src/routes/index.ts
// Central route aggregator
// Mounts all routes to the Express app

import { Router } from 'express';
import authRoutes from './auth.routes';
import doctorRoutes from './doctor.routes';
import hospitalRoutes from './hospital.routes';
import jobRoutes from './job.routes';
import attendanceRoutes from './attendance.routes';
import leaveRoutes from './leave.routes';
import searchRoutes from './search.routes';
import healthRoutes from './health.routes';
import recommendationRoutes from './recommendation.routes';
import messageRoutes from './message.routes';
import feedbackRoutes from './feedback.routes';
import paymentRoutes from './payment.routes';
import adminRoutes from './admin.routes';

const router = Router();

/**
 * API Routes Summary
 * 
 * Base URL: /api/v1
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ HEALTH CHECK                                                                │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ GET  /health              - Basic health check                              │
 * │ GET  /health/ready        - Readiness check (db, redis)                     │
 * │ GET  /health/live         - Liveness check                                  │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ AUTHENTICATION (Public)                                                      │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ POST /auth/signup         - Register new user                               │
 * │ POST /auth/verify-email   - Verify email with OTP                          │
 * │ POST /auth/select-role    - Select doctor/hospital role                     │
 * │ POST /auth/resend-otp     - Resend OTP                                      │
 * │ POST /auth/login          - User login                                      │
 * │ POST /auth/forgot-password- Request password reset                          │
 * │ POST /auth/reset-password - Reset password with OTP                         │
 * │ POST /auth/refresh-token  - Refresh access token                            │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ AUTHENTICATION (Protected)                                                   │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ GET  /auth/me             - Get current user                                │
 * │ POST /auth/change-password- Change password                                 │
 * │ POST /auth/logout         - Logout current session                          │
 * │ POST /auth/logout-all     - Logout all devices                              │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ DOCTOR ROUTES (Protected - Doctor Role)                                      │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ Profile:                                                                     │
 * │   GET  /doctor/profile           - Get profile                              │
 * │   GET  /doctor/profile/edit      - Get edit profile                         │
 * │   PUT  /doctor/profile/personal  - Update personal info                     │
 * │   PUT  /doctor/profile/bio       - Update bio                               │
 * │   POST /doctor/profile/avatar    - Upload avatar                            │
 * │                                                                              │
 * │ Aadhaar:                                                                     │
 * │   POST /doctor/aadhaar/generate-otp    - Generate Aadhaar OTP              │
 * │   POST /doctor/aadhaar/verify          - Verify Aadhaar                     │
 * │   PUT  /doctor/profile/aadhaar         - Update Aadhaar info               │
 * │   POST /doctor/profile/aadhaar/document- Upload Aadhaar doc                │
 * │                                                                              │
 * │ Education:                                                                   │
 * │   POST   /doctor/education           - Add education                        │
 * │   PUT    /doctor/education/:id       - Update education                     │
 * │   DELETE /doctor/education/:id       - Delete education                     │
 * │   POST   /doctor/education/:id/document - Upload document                   │
 * │                                                                              │
 * │ Experience:                                                                  │
 * │   POST   /doctor/experience          - Add experience                       │
 * │   PUT    /doctor/experience/:id      - Update experience                    │
 * │   DELETE /doctor/experience/:id      - Delete experience                    │
 * │   POST   /doctor/experience/:id/document - Upload document                  │
 * │                                                                              │
 * │ Skills:                                                                      │
 * │   POST   /doctor/skills              - Add skill                            │
 * │   PUT    /doctor/skills/:id          - Update skill                         │
 * │   DELETE /doctor/skills/:id          - Delete skill                         │
 * │   POST   /doctor/skills/:id/certificate - Upload certificate               │
 * │                                                                              │
 * │ Licenses:                                                                    │
 * │   POST   /doctor/licensure/licenses           - Add license                 │
 * │   PUT    /doctor/licensure/licenses/:id       - Update license              │
 * │   DELETE /doctor/licensure/licenses/:id       - Delete license              │
 * │   POST   /doctor/licensure/licenses/:id/document - Upload document          │
 * │                                                                              │
 * │ Preferences:                                                                 │
 * │   PUT  /doctor/preferences           - Update job preferences               │
 * │                                                                              │
 * │ Jobs:                                                                        │
 * │   GET  /doctor/jobs                  - Get available jobs                   │
 * │   GET  /doctor/jobs/:id              - Get job details                      │
 * │                                                                              │
 * │ Applications:                                                                │
 * │   GET  /doctor/applications          - Get my applications                  │
 * │                                                                              │
 * │ Active Jobs:                                                                 │
 * │   GET  /doctor/active-jobs           - Get active assignments               │
 * │   GET  /doctor/active-jobs/:id/schedule - Get schedule                      │
 * │   POST /doctor/active-jobs/:id/check-in - Check in                          │
 * │   POST /doctor/active-jobs/:id/check-out - Check out                        │
 * │                                                                              │
 * │ Leave:                                                                       │
 * │   POST   /doctor/leave-requests      - Request leave                        │
 * │   GET    /doctor/leave-requests      - Get my leave requests                │
 * │   DELETE /doctor/leave-requests/:id  - Cancel leave request                 │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ HOSPITAL ROUTES (Protected - Hospital Role)                                  │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ Profile:                                                                     │
 * │   GET  /hospital/profile                  - Get profile                     │
 * │   GET  /hospital/profile/edit             - Get edit profile                │
 * │   GET  /hospital/dashboard                - Get dashboard stats             │
 * │   PUT  /hospital/profile/basic            - Update basic info               │
 * │   PUT  /hospital/profile/general-info     - Update general info             │
 * │   PUT  /hospital/profile/location         - Update location                 │
 * │   PUT  /hospital/profile/infrastructure   - Update infrastructure           │
 * │   PUT  /hospital/profile/facilities       - Update facilities               │
 * │   PUT  /hospital/profile/staffing         - Update staffing                 │
 * │   PUT  /hospital/profile/representative   - Update representative           │
 * │   PUT  /hospital/profile/credentials      - Update credentials              │
 * │   POST /hospital/profile/logo             - Upload logo                     │
 * │                                                                              │
 * │ Departments:                                                                 │
 * │   POST   /hospital/departments            - Add department                  │
 * │   PUT    /hospital/departments/:id        - Update department               │
 * │   DELETE /hospital/departments/:id        - Delete department               │
 * │                                                                              │
 * │ Contacts:                                                                    │
 * │   POST   /hospital/contacts               - Add contact                     │
 * │   PUT    /hospital/contacts/:id           - Update contact                  │
 * │   DELETE /hospital/contacts/:id           - Delete contact                  │
 * │                                                                              │
 * │ Jobs:                                                                        │
 * │   POST   /hospital/jobs                   - Create job                      │
 * │   GET    /hospital/jobs                   - Get posted jobs                 │
 * │   GET    /hospital/jobs/:id               - Get job details                 │
 * │   PUT    /hospital/jobs/:id               - Update job                      │
 * │   POST   /hospital/jobs/:id/close         - Close job                       │
 * │   DELETE /hospital/jobs/:id               - Delete job                      │
 * │   GET    /hospital/jobs/:id/applications  - Get job applications            │
 * │                                                                              │
 * │ Applications:                                                                │
 * │   GET  /hospital/applications             - Get all applications            │
 * │   GET  /hospital/applications/:id         - Get application details         │
 * │   PUT  /hospital/applications/:id/status  - Update status                   │
 * │   POST /hospital/applications/:id/interview - Schedule interview            │
 * │   POST /hospital/applications/:id/offer   - Send offer                      │
 * │   POST /hospital/applications/:id/hire    - Hire applicant                  │
 * │                                                                              │
 * │ Candidates:                                                                  │
 * │   GET  /hospital/candidates               - Search candidates               │
 * │   GET  /hospital/candidates/:id           - Get candidate details           │
 * │                                                                              │
 * │ Employees:                                                                   │
 * │   GET  /hospital/employees                - Get employees                   │
 * │   PUT  /hospital/employees/:id            - Update employee                 │
 * │   PUT  /hospital/employees/:id/status     - Update status                   │
 * │   POST /hospital/employees/:id/terminate  - Terminate                       │
 * │   GET  /hospital/employees/:id/attendance - Get attendance                  │
 * │   POST /hospital/employees/:id/attendance - Mark attendance                 │
 * │   GET  /hospital/employees/:id/schedule   - Get schedule                    │
 * │                                                                              │
 * │ Leave:                                                                       │
 * │   GET  /hospital/leave-requests           - Get leave requests              │
 * │   PUT  /hospital/leave-requests/:id       - Approve/reject leave            │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ JOBS (Public + Doctor Actions)                                               │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ Public:                                                                      │
 * │   GET  /jobs                   - Search jobs                                │
 * │   GET  /jobs/filters           - Get filter options                         │
 * │   GET  /jobs/featured          - Get featured jobs                          │
 * │   GET  /jobs/recent            - Get recent jobs                            │
 * │   GET  /jobs/:id               - Get job details                            │
 * │   GET  /jobs/:id/similar       - Get similar jobs                           │
 * │                                                                              │
 * │ Doctor Actions (Protected):                                                  │
 * │   POST   /jobs/:id/apply       - Apply to job                               │
 * │   DELETE /jobs/:id/application - Withdraw application                       │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ ATTENDANCE (Protected - Doctor)                                              │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ POST /attendance/check-in              - Check in                           │
 * │ POST /attendance/check-out             - Check out                          │
 * │ GET  /attendance/status/:assignmentId  - Get today's status                 │
 * │ GET  /attendance/history/:assignmentId - Get attendance history             │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ LEAVE (Protected - Doctor)                                                   │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ GET  /leave/my-requests                - Get my leave requests              │
 * │ GET  /leave/balance/:assignmentId      - Get leave balance                  │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ SEARCH (Public)                                                              │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ GET  /search/hospitals         - Search hospitals                           │
 * │ GET  /search/hospitals/:id     - Get hospital public profile                │
 * │ GET  /search/doctors           - Search doctors                             │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */

// Mount routes
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/doctor', doctorRoutes);
router.use('/hospital', hospitalRoutes);
router.use('/jobs', jobRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/leave', leaveRoutes);
router.use('/search', searchRoutes);
router.use('/recommendations', recommendationRoutes);
router.use('/messages', messageRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/payment', paymentRoutes);
router.use('/admin', adminRoutes);

export default router;
