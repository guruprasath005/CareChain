// src/routes/doctor.routes.ts
import { Router } from 'express';
import { doctorController } from '../controllers/doctor.controller';
import { leaveController } from '../controllers/leave.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { uploadLimiter, otpLimiter } from '../middleware/rateLimit';
import { upload } from '../middleware/upload.middleware';
import {
  updatePersonalInfoSchema,
  updateBioSchema,
  updatePreferencesSchema,
  aadhaarOtpSchema,
  verifyAadhaarSchema,
  sendPhoneOtpSchema,
  verifyPhoneOtpSchema,
  addEducationSchema,
  updateEducationSchema,
  addExperienceSchema,
  updateExperienceSchema,
  addSkillSchema,
  updateSkillSchema,
  addLicenseSchema,
  updateLicenseSchema,
  createLeaveRequestSchema,
} from '../validators/doctor.validator';
import { applyToJobSchema } from '../validators/doctor.validator';

const router = Router();

router.use(authenticate);
router.use(authorize('doctor'));

// ─── Profile ───────────────────────────────────────────────────────────────────

router.get('/profile', doctorController.getProfile);
router.get('/profile/edit', doctorController.getEditProfile);

router.put('/profile/personal', validate(updatePersonalInfoSchema), doctorController.updatePersonalInfo);
router.put('/profile/bio', validate(updateBioSchema), doctorController.updateBio);
router.post('/profile/avatar', uploadLimiter, upload.single('avatar'), doctorController.uploadAvatar);

// ─── Aadhaar verification ──────────────────────────────────────────────────────

router.post('/aadhaar/generate-otp', otpLimiter, validate(aadhaarOtpSchema), doctorController.generateAadhaarOtp);
router.post('/aadhaar/verify', otpLimiter, validate(verifyAadhaarSchema), doctorController.verifyAadhaar);
router.put('/profile/aadhaar', validate(aadhaarOtpSchema), doctorController.updateAadhaarInfo);
router.post('/profile/aadhaar/document', uploadLimiter, upload.single('document'), doctorController.uploadAadhaarDocument);

// ─── Phone verification ────────────────────────────────────────────────────────

router.post('/phone/send-otp', otpLimiter, validate(sendPhoneOtpSchema), doctorController.sendPhoneOtp);
router.post('/phone/verify-otp', otpLimiter, validate(verifyPhoneOtpSchema), doctorController.verifyPhoneOtp);

// ─── Education ─────────────────────────────────────────────────────────────────

router.post('/education', validate(addEducationSchema), doctorController.addEducation);
router.put('/education/:id', validate(updateEducationSchema), doctorController.updateEducation);
router.delete('/education/:id', doctorController.deleteEducation);
router.post('/education/:id/document', uploadLimiter, upload.single('document'), doctorController.uploadEducationDocument);

// ─── Experience ────────────────────────────────────────────────────────────────

router.post('/experience', validate(addExperienceSchema), doctorController.addExperience);
router.put('/experience/:id', validate(updateExperienceSchema), doctorController.updateExperience);
router.delete('/experience/:id', doctorController.deleteExperience);
router.post('/experience/:id/document', uploadLimiter, upload.single('document'), doctorController.uploadExperienceDocument);

// ─── Skills ────────────────────────────────────────────────────────────────────

router.post('/skills', validate(addSkillSchema), doctorController.addSkill);
router.put('/skills/:id', validate(updateSkillSchema), doctorController.updateSkill);
router.delete('/skills/:id', doctorController.deleteSkill);
router.post('/skills/:id/certificate', uploadLimiter, upload.single('document'), doctorController.uploadSkillCertificate);

// ─── Licenses ─────────────────────────────────────────────────────────────────

router.post('/licensure/licenses', validate(addLicenseSchema), doctorController.addLicense);
router.put('/licensure/licenses/:id', validate(updateLicenseSchema), doctorController.updateLicense);
router.delete('/licensure/licenses/:id', doctorController.deleteLicense);
router.post('/licensure/licenses/:id/document', uploadLimiter, upload.single('document'), doctorController.uploadLicenseDocument);

// ─── Preferences ──────────────────────────────────────────────────────────────

router.put('/preferences', validate(updatePreferencesSchema), doctorController.updatePreferences);

// ─── Jobs & applications ───────────────────────────────────────────────────────

router.get('/jobs', doctorController.getJobs);
router.get('/jobs/:id', doctorController.getJobDetails);
router.get('/applications', doctorController.getApplications);
router.get('/applications/:id/offer', doctorController.getOfferDetails);
router.post('/applications/:id/offer/accept', doctorController.acceptOffer);
router.post('/applications/:id/offer/decline', doctorController.declineOffer);

// ─── Active assignments ────────────────────────────────────────────────────────

router.get('/active-jobs', doctorController.getActiveJobs);
router.get('/active-jobs/:id/schedule', doctorController.getSchedule);
router.post('/active-jobs/:id/check-in', doctorController.checkIn);
router.post('/active-jobs/:id/check-out', doctorController.checkOut);

// ─── Leave requests ────────────────────────────────────────────────────────────

router.post('/leave-requests', validate(createLeaveRequestSchema), leaveController.createLeaveRequest);
router.get('/leave-requests', leaveController.getMyRequests);
router.delete('/leave-requests/:id', leaveController.cancelLeaveRequest);

export default router;
