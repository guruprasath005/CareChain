// src/routes/feedback.routes.ts
import { Router } from 'express';
import { authenticate } from '../middleware';
import feedbackController from '../controllers/feedback.controller';

const router = Router();

// All feedback routes require authentication
router.use(authenticate);

// Submit feedback for an assignment
router.post('/submit', feedbackController.submitFeedback);

// Get feedback for a specific assignment
router.get('/assignment/:assignmentId', feedbackController.getAssignmentFeedback);

// Get feedbacks received by a specific user
router.get('/user/:userId?', feedbackController.getUserFeedbacks);

export default router;
