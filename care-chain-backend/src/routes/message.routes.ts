// src/routes/message.routes.ts
// Message Routes - Chat and messaging endpoints

import { Router } from 'express';
import { messageController } from '../controllers/message.controller';
import { authenticate } from '../middleware/authenticate';
import { doctorOnly, hospitalOnly } from '../middleware/authorize';

const router = Router();

// All message routes require authentication
router.use(authenticate);

// =====================================
// CONVERSATION ROUTES
// =====================================

/**
 * @route   GET /api/v1/messages/conversations
 * @desc    Get user's conversations
 * @access  Private
 * @query   page, limit
 */
router.get('/conversations', messageController.getConversations);

/**
 * @route   GET /api/v1/messages/conversations/with-hospital
 * @desc    Get conversation status with a specific hospital (Doctor only)
 * @access  Private (Doctor)
 * @query   hospitalId, jobId?
 */
router.get('/conversations/with-hospital', messageController.getConversationWithHospital);

/**
 * @route   POST /api/v1/messages/conversations
 * @desc    Create or get conversation
 * @access  Private
 * @body    { participantId, jobId?, applicationId?, type?, initialMessage? }
 */
router.post('/conversations', messageController.createConversation);

/**
 * @route   GET /api/v1/messages/conversations/:id
 * @desc    Get conversation details
 * @access  Private
 * @params  id - Conversation ID
 */
router.get('/conversations/:id', messageController.getConversation);

/**
 * @route   GET /api/v1/messages/conversations/:id/messages
 * @desc    Get messages for a conversation
 * @access  Private
 * @params  id - Conversation ID
 * @query   page, limit
 */
router.get('/conversations/:id/messages', messageController.getMessages);

/**
 * @route   POST /api/v1/messages/conversations/:id/messages
 * @desc    Send a message
 * @access  Private
 * @params  id - Conversation ID
 * @body    { content, type?, attachments?, metadata? }
 */
router.post('/conversations/:id/messages', messageController.sendMessage);

/**
 * @route   POST /api/v1/messages/conversations/:id/read
 * @desc    Mark messages as read
 * @access  Private
 * @params  id - Conversation ID
 */
router.post('/conversations/:id/read', messageController.markAsRead);

/**
 * @route   POST /api/v1/messages/conversations/:id/archive
 * @desc    Archive a conversation
 * @access  Private
 * @params  id - Conversation ID
 */
router.post('/conversations/:id/archive', messageController.archiveConversation);

// =====================================
// MESSAGE ROUTES
// =====================================

/**
 * @route   GET /api/v1/messages/unread-count
 * @desc    Get unread message count
 * @access  Private
 */
router.get('/unread-count', messageController.getUnreadCount);

/**
 * @route   GET /api/v1/messages/search
 * @desc    Search messages
 * @access  Private
 * @query   q, limit
 */
router.get('/search', messageController.searchMessages);

/**
 * @route   DELETE /api/v1/messages/:id
 * @desc    Delete a message
 * @access  Private
 * @params  id - Message ID
 */
router.delete('/:id', messageController.deleteMessage);

// =====================================
// INVITATION ROUTES
// =====================================

/**
 * @route   GET /api/v1/messages/invitations
 * @desc    Get pending invitation requests (Doctor only)
 * @access  Private (Doctor)
 * @query   page, limit
 */
router.get('/invitations', doctorOnly, messageController.getPendingInvitations);

/**
 * @route   POST /api/v1/messages/invitations/:id/accept
 * @desc    Accept an invitation request (Doctor only)
 * @access  Private (Doctor)
 * @params  id - Conversation ID
 */
router.post('/invitations/:id/accept', doctorOnly, messageController.acceptInvitation);

/**
 * @route   POST /api/v1/messages/invitations/:id/decline
 * @desc    Decline an invitation request (Doctor only)
 * @access  Private (Doctor)
 * @params  id - Conversation ID
 */
router.post('/invitations/:id/decline', doctorOnly, messageController.declineInvitation);

/**
 * @route   POST /api/v1/messages/invite
 * @desc    Send job invitation to doctor (Hospital only)
 * @access  Private (Hospital)
 * @body    { doctorId, jobId, message? }
 */
router.post('/invite', hospitalOnly, messageController.sendInvitation);

export default router;
