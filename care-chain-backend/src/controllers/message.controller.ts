// src/controllers/message.controller.ts
// Message Controller - Handles messaging API endpoints

import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { ApiResponse } from '../utils/response';
import { messageService } from '../services/message.service';
import { logger } from '../utils/logger';
import { User } from '../models/User.model';
import { UserRole } from '../models/types';

export const messageController = {
  /**
   * GET /messages/conversations
   * Get user's conversations
   */
  async getConversations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const role = req.user!.role as 'doctor' | 'hospital';
      const { page = '1', limit = '20' } = req.query;

      const { conversations, total } = await messageService.getUserConversations(
        userId,
        role,
        Number(page),
        Number(limit)
      );

      // Transform conversations for frontend
      const transformedConversations = conversations.map((conv) => {
        const otherParty = role === 'doctor' ? conv.hospital : conv.doctor;
        const hospitalProfile = (conv.hospital as any)?.hospitalProfile;
        const doctorProfile = (conv.doctor as any)?.doctorProfile;

        return {
          id: conv.id,
          type: conv.type,
          status: conv.status,
          invitationStatus: conv.invitationStatus,
          lastMessage: conv.lastMessageText,
          lastMessageAt: conv.lastMessageAt,
          unreadCount: role === 'doctor' ? conv.doctorUnreadCount : conv.hospitalUnreadCount,
          job: conv.job ? { id: conv.job.id, title: conv.job.title } : null,
          participant: {
            id: otherParty?.id,
            name: role === 'doctor'
              ? hospitalProfile?.hospitalName || otherParty?.fullName
              : otherParty?.fullName,
            avatar: role === 'doctor'
              ? hospitalProfile?.images?.logo || otherParty?.avatarUrl
              : otherParty?.avatarUrl,
            subtitle: role === 'doctor'
              ? 'Hospital'
              : doctorProfile?.specialization || 'Doctor',
          },
        };
      });

      ApiResponse.paginated(
        res,
        transformedConversations,
        Number(page),
        Number(limit),
        total,
        'Conversations retrieved'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /messages/conversations/:id
   * Get conversation details
   */
  async getConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const conversation = await messageService.getConversationById(id, userId);

      if (!conversation) {
        ApiResponse.notFound(res, 'Conversation not found');
        return;
      }

      ApiResponse.success(res, { conversation }, 'Conversation retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /messages/conversations
   * Create or get conversation
   */
  async createConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const role = req.user!.role as 'doctor' | 'hospital';
      const { participantId, jobId, applicationId, type, initialMessage } = req.body;

      if (!participantId) {
        ApiResponse.badRequest(res, 'Participant ID is required');
        return;
      }

      const conversationData = {
        doctorId: role === 'doctor' ? userId : participantId,
        hospitalId: role === 'hospital' ? userId : participantId,
        jobId,
        applicationId,
        type,
        initialMessage,
      };

      const conversation = await messageService.getOrCreateConversation(conversationData);

      ApiResponse.success(res, { conversation }, 'Conversation created');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /messages/conversations/:id/messages
   * Get messages for a conversation
   */
  async getMessages(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { page = '1', limit = '50' } = req.query;

      const result = await messageService.getMessages(id, userId, Number(page), Number(limit));

      // Transform messages for frontend
      const transformedMessages = result.messages.map((msg) => ({
        id: msg.id,
        conversationId: msg.conversationId,
        senderId: msg.senderId,
        senderRole: msg.senderRole,
        type: msg.type,
        content: msg.content,
        attachments: msg.attachments,
        metadata: msg.metadata,
        status: msg.status,
        createdAt: msg.createdAt,
        sender: msg.sender ? {
          id: msg.sender.id,
          name: msg.sender.fullName,
          avatar: msg.sender.avatarUrl,
        } : null,
      }));

      ApiResponse.paginated(
        res,
        transformedMessages,
        result.meta.page,
        result.meta.limit,
        result.meta.totalItems,
        'Messages retrieved'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /messages/conversations/:id/messages
   * Send a message
   */
  async sendMessage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const role = req.user!.role as 'doctor' | 'hospital';
      const { id } = req.params;
      const { content, type, attachments, metadata } = req.body;

      if (!content || content.trim().length === 0) {
        ApiResponse.badRequest(res, 'Message content is required');
        return;
      }

      const message = await messageService.sendMessage({
        conversationId: id,
        senderId: userId,
        senderRole: role,
        content: content.trim(),
        type,
        attachments,
        metadata,
      });

      ApiResponse.created(res, { message }, 'Message sent');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /messages/conversations/:id/read
   * Mark messages as read
   */
  async markAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const role = req.user!.role as 'doctor' | 'hospital';
      const { id } = req.params;

      await messageService.markMessagesAsRead(id, userId, role);

      ApiResponse.success(res, null, 'Messages marked as read');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /messages/unread-count
   * Get unread message count
   */
  async getUnreadCount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const role = req.user!.role as 'doctor' | 'hospital';

      const count = await messageService.getUnreadCount(userId, role);

      ApiResponse.success(res, { unreadCount: count }, 'Unread count retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /messages/:id
   * Delete a message
   */
  async deleteMessage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await messageService.deleteMessage(id, userId);

      ApiResponse.success(res, null, 'Message deleted');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /messages/invite
   * Send job invitation to doctor
   */
  async sendInvitation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = req.user!.id;
      const { doctorId, jobId, message } = req.body;

      if (!doctorId || !jobId) {
        ApiResponse.badRequest(res, 'Doctor ID and Job ID are required');
        return;
      }

      const result = await messageService.sendInvitation(hospitalId, doctorId, jobId, message);

      ApiResponse.created(res, result, 'Invitation sent');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /messages/conversations/:id/archive
   * Archive a conversation
   */
  async archiveConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await messageService.archiveConversation(id, userId);

      ApiResponse.success(res, null, 'Conversation archived');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /messages/search
   * Search messages
   */
  async searchMessages(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const role = req.user!.role as 'doctor' | 'hospital';
      const { q, limit = '20' } = req.query;

      if (!q) {
        ApiResponse.badRequest(res, 'Search query is required');
        return;
      }

      const messages = await messageService.searchMessages(userId, role, q as string, Number(limit));

      ApiResponse.success(res, { messages }, 'Search results');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /messages/invitations
   * Get pending invitation requests (Doctor only)
   */
  async getPendingInvitations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const role = req.user!.role;
      const { page = '1', limit = '20' } = req.query;

      if (role !== 'doctor') {
        ApiResponse.forbidden(res, 'Only doctors can view invitations');
        return;
      }

      const { invitations, total } = await messageService.getPendingInvitations(
        userId,
        Number(page),
        Number(limit)
      );

      // Transform invitations for frontend
      const transformedInvitations = invitations.map((conv) => {
        const hospitalProfile = (conv.hospital as any)?.hospitalProfile;
        const firstMessage = conv.messages?.[0];

        return {
          id: conv.id,
          type: conv.type,
          status: conv.status,
          invitationStatus: conv.invitationStatus,
          createdAt: conv.createdAt,
          job: conv.job ? { id: conv.job.id, title: conv.job.title } : null,
          hospital: {
            id: conv.hospital?.id,
            name: hospitalProfile?.hospitalName || conv.hospital?.fullName,
            avatar: hospitalProfile?.images?.logo || conv.hospital?.avatarUrl,
          },
          message: firstMessage ? {
            id: firstMessage.id,
            content: firstMessage.content,
            type: firstMessage.type,
            createdAt: firstMessage.createdAt,
            metadata: firstMessage.metadata,
          } : null,
        };
      });

      ApiResponse.paginated(
        res,
        transformedInvitations,
        Number(page),
        Number(limit),
        total,
        'Pending invitations retrieved'
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /messages/invitations/:id/accept
   * Accept an invitation request (Doctor only)
   */
  async acceptInvitation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const role = req.user!.role;
      const { id } = req.params;

      if (role !== 'doctor') {
        ApiResponse.forbidden(res, 'Only doctors can accept invitations');
        return;
      }

      const conversation = await messageService.acceptInvitation(id, userId);

      ApiResponse.success(res, { conversation }, 'Invitation accepted');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /messages/invitations/:id/decline
   * Decline an invitation request (Doctor only)
   */
  async declineInvitation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const role = req.user!.role;
      const { id } = req.params;

      if (role !== 'doctor') {
        ApiResponse.forbidden(res, 'Only doctors can decline invitations');
        return;
      }

      await messageService.declineInvitation(id, userId);

      ApiResponse.success(res, null, 'Invitation declined');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /messages/conversations/with-hospital
   * Get conversation status with a specific hospital (Doctor only)
   */
  async getConversationWithHospital(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const role = req.user!.role;
      const { hospitalId, jobId } = req.query;

      if (role !== 'doctor') {
        ApiResponse.forbidden(res, 'Only doctors can use this endpoint');
        return;
      }

      if (!hospitalId) {
        ApiResponse.badRequest(res, 'Hospital ID is required');
        return;
      }

      const conversation = await messageService.getConversationWithHospital(
        userId,
        hospitalId as string,
        jobId as string | undefined
      );

      ApiResponse.success(res, { conversation }, 'Conversation status retrieved');
    } catch (error) {
      next(error);
    }
  },
};

export default messageController;
