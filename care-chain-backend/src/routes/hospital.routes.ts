// src/routes/hospital.routes.ts
import { Router } from 'express';
import { hospitalController } from '../controllers/hospital.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { uploadLimiter, otpLimiter } from '../middleware/rateLimit';
import { upload } from '../middleware/upload.middleware';
import {
  updateGeneralInfoSchema,
  updateLocationSchema,
  updateInfrastructureSchema,
  updateFacilitiesSchema,
  updateRepresentativeSchema,
  updateRepresentativeAadhaarSchema,
  sendPhoneOtpSchema,
  verifyPhoneOtpSchema,
  sendEmailOtpSchema,
  verifyEmailOtpSchema,
  addDepartmentSchema,
  updateDepartmentSchema,
  addContactSchema,
  updateContactSchema,
  updateApplicationStatusSchema,
  scheduleInterviewSchema,
  sendOfferSchema,
  hireApplicantSchema,
  updateEmployeeStatusSchema,
  terminateEmployeeSchema,
  markAttendanceSchema,
  reviewLeaveSchema,
  updateStaffingSchema,
} from '../validators/hospital.validator';
import { createJobSchema, updateJobSchema, bulkCreateJobsSchema } from '../validators/job.validator';

const router = Router();

router.use(authenticate);
router.use(authorize('hospital'));

// ─── Profile ───────────────────────────────────────────────────────────────────

router.get('/profile', hospitalController.getProfile);
router.get('/profile/edit', hospitalController.getEditProfile);
router.get('/dashboard', hospitalController.getDashboard);

router.put('/profile/basic', validate(updateGeneralInfoSchema), hospitalController.updateBasicInfo);
router.put('/profile/general-info', validate(updateGeneralInfoSchema), hospitalController.updateGeneralInfo);
router.put('/profile/location', validate(updateLocationSchema), hospitalController.updateLocation);
router.put('/profile/infrastructure', validate(updateInfrastructureSchema), hospitalController.updateInfrastructure);
router.put('/profile/infrastructure-details', validate(updateInfrastructureSchema), hospitalController.updateInfrastructureDetails);
router.post('/profile/infrastructure/photo', uploadLimiter, upload.single('photo'), hospitalController.uploadInfrastructurePhoto);
router.delete('/profile/infrastructure/photo/:id', hospitalController.deleteInfrastructurePhoto);
router.put('/profile/facilities', validate(updateFacilitiesSchema), hospitalController.updateFacilities);
router.put('/profile/staffing', validate(updateStaffingSchema), hospitalController.updateStaffing);
router.put('/profile/representative', validate(updateRepresentativeSchema), hospitalController.updateRepresentative);
router.put('/profile/representative/aadhaar', validate(updateRepresentativeAadhaarSchema), hospitalController.updateRepresentativeAadhaar);
router.post(
  '/profile/representative/aadhaar/document',
  uploadLimiter, upload.single('document'),
  hospitalController.uploadRepresentativeAadhaarDocument,
);
router.put('/profile/credentials', hospitalController.updateCredentials);
router.post(
  '/profile/credentials/:docType/document',
  uploadLimiter, upload.single('document'),
  hospitalController.uploadCredentialDocument,
);
router.post('/profile/logo', uploadLimiter, upload.single('logo'), hospitalController.uploadLogo);
router.post('/profile/banner', uploadLimiter, upload.single('banner'), hospitalController.uploadBanner);

// ─── Phone / email OTP ────────────────────────────────────────────────────────

router.post('/profile/phone/send-otp', otpLimiter, validate(sendPhoneOtpSchema), hospitalController.sendPhoneOtp);
router.post('/profile/phone/verify-otp', otpLimiter, validate(verifyPhoneOtpSchema), hospitalController.verifyPhoneOtp);
router.post('/profile/representative/email/send-otp', otpLimiter, validate(sendEmailOtpSchema), hospitalController.sendRepresentativeEmailOtp);
router.post('/profile/representative/email/verify-otp', otpLimiter, validate(verifyEmailOtpSchema), hospitalController.verifyRepresentativeEmailOtp);

// ─── Departments ──────────────────────────────────────────────────────────────

router.post('/departments', validate(addDepartmentSchema), hospitalController.addDepartment);
router.put('/departments/:id', validate(updateDepartmentSchema), hospitalController.updateDepartment);
router.delete('/departments/:id', hospitalController.deleteDepartment);

// ─── Contacts ─────────────────────────────────────────────────────────────────

router.post('/contacts', validate(addContactSchema), hospitalController.addContact);
router.put('/contacts/:id', validate(updateContactSchema), hospitalController.updateContact);
router.delete('/contacts/:id', hospitalController.deleteContact);

// ─── Jobs ─────────────────────────────────────────────────────────────────────

router.post('/jobs', validate(createJobSchema), hospitalController.createJob);
router.post('/jobs/bulk', validate(bulkCreateJobsSchema), hospitalController.createBulkJobs);
router.get('/jobs/bulk/:batchId', hospitalController.getBulkJobStatus);
router.post('/jobs/queue', validate(createJobSchema), hospitalController.queueJobPosting);
router.get('/jobs/queue/:jobId', hospitalController.getQueuedJobStatus);
router.get('/jobs/queue-stats', hospitalController.getJobQueueStats);
router.get('/jobs', hospitalController.getJobs);
router.get('/jobs/:id', hospitalController.getJobDetails);
router.put('/jobs/:id', validate(updateJobSchema), hospitalController.updateJob);
router.post('/jobs/:id/close', hospitalController.closeJob);
router.delete('/jobs/:id', hospitalController.deleteJob);
router.post('/jobs/:id/restore', hospitalController.restoreJob);
router.delete('/jobs/:id/permanent', hospitalController.deleteJobPermanently);
router.get('/jobs/:id/applications', hospitalController.getJobApplications);

// ─── Applications ─────────────────────────────────────────────────────────────

router.get('/applications', hospitalController.getAllApplications);
router.get('/applications/:id', hospitalController.getApplicationDetails);
router.put('/applications/:id/status', validate(updateApplicationStatusSchema), hospitalController.updateApplicationStatus);
router.post('/applications/:id/interview', validate(scheduleInterviewSchema), hospitalController.scheduleInterview);
router.post('/applications/:id/offer', validate(sendOfferSchema), hospitalController.sendOffer);
router.post('/applications/:id/hire', validate(hireApplicantSchema), hospitalController.hireApplicant);

// ─── Candidates ───────────────────────────────────────────────────────────────

router.get('/candidates', hospitalController.searchCandidates);
router.get('/candidates/:id', hospitalController.getCandidateDetails);

// ─── Employees / assignments ──────────────────────────────────────────────────

router.get('/employees', hospitalController.getEmployees);
router.put('/employees/:id', hospitalController.updateEmployee);
router.put('/employees/:id/status', validate(updateEmployeeStatusSchema), hospitalController.updateEmployeeStatus);
router.post('/employees/:id/terminate', validate(terminateEmployeeSchema), hospitalController.terminateEmployee);
router.get('/employees/:id/attendance', hospitalController.getEmployeeAttendance);
router.get('/employees/:id/attendance/today', hospitalController.getEmployeeTodayStatus);
router.post('/employees/attendance/today/bulk', hospitalController.getEmployeesTodayStatusBulk);
router.post('/employees/:id/attendance', validate(markAttendanceSchema), hospitalController.markEmployeeAttendance);
router.post('/employees/:assignmentId/mark-absent', hospitalController.createAbsentRecord);
router.get('/employees/:id/schedule', hospitalController.getEmployeeSchedule);
router.post('/employees/:id/schedule', hospitalController.addEmployeeScheduleEntry);
router.post('/employees/:id/schedule/bulk', hospitalController.addEmployeeScheduleEntriesBulk);
router.put('/employees/:id/schedule/:scheduleId', hospitalController.updateEmployeeScheduleEntry);
router.delete('/employees/:id/schedule/:scheduleId', hospitalController.deleteEmployeeScheduleEntry);

// ─── Attendance approval workflow ─────────────────────────────────────────────

router.get('/attendance/pending', hospitalController.getPendingAttendance);
router.post('/attendance/:id/confirm-checkin', hospitalController.confirmCheckIn);
router.post('/attendance/:id/confirm-checkout', hospitalController.confirmCheckOut);
router.post('/attendance/:id/cancel', hospitalController.cancelAttendance);
router.post('/attendance/:id/mark-absent', hospitalController.markAbsent);

// ─── Leave requests ────────────────────────────────────────────────────────────

router.get('/leave-requests', hospitalController.getLeaveRequests);
router.put('/leave-requests/:id', validate(reviewLeaveSchema), hospitalController.handleLeaveRequest);

export default router;
