// src/services/message.service.ts
// Message Service - Handles all messaging operations

import { Op } from 'sequelize';
import { Conversation, ConversationType, ConversationStatus, InvitationStatus } from '../models/Conversation.model';
import { Message, MessageType, MessageStatus } from '../models/Message.model';
import { User } from '../models/User.model';
import { Job } from '../models/Job.model';
import { Application } from '../models/Application.model';
import { UserRole } from '../models/types';
import { emitToUser, emitToConversation, isUserOnline } from '../config/socket';
import { logger } from '../utils/logger';
// import { redis } from '../config/redis'; // Unused

export interface CreateConversationData {
  doctorId: string;
  hospitalId: string;
  jobId?: string;
  applicationId?: string;
  type?: ConversationType;
  initialMessage?: string;
  initiatorId?: string;
}

export interface SendMessageData {
  conversationId: string;
  senderId: string;
  senderRole: 'doctor' | 'hospital';
  content: string;
  type?: MessageType;
  attachments?: any[];
  metadata?: any;
}

export interface PaginatedMessages {
  messages: Message[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

class MessageService {
  /**
   * Create or get existing conversation
   */
  async getOrCreateConversation(data: CreateConversationData): Promise<Conversation> {
    // Validate that participants and optional relations exist before touching DB constraints
    const { jobId, applicationId } = await this.validateConversationReferences(data);

    // Check for existing conversation with strict criteria (including null jobId)
    const whereClause: any = {
      doctorId: data.doctorId,
      hospitalId: data.hospitalId,
      jobId,
    };

    let conversation = await Conversation.findOne({ where: whereClause });

    if (!conversation) {
      try {
        conversation = await Conversation.create({
          doctorId: data.doctorId,
          hospitalId: data.hospitalId,
          jobId,
          applicationId,
          type: data.type || 'general',
          status: 'active',
          invitationStatus: 'pending',
          initiatorId: data.initiatorId || data.hospitalId,
        });

        logger.info(`Conversation created: ${conversation.id}`);

        // Send initial message if provided
        if (data.initialMessage) {
          await this.sendMessage({
            conversationId: conversation.id,
            senderId: data.hospitalId, // Usually hospital initiates
            senderRole: 'hospital',
            content: data.initialMessage,
            type: 'system',
          });
        }
      } catch (error: any) {
        if (error.name === 'SequelizeForeignKeyConstraintError') {
          logger.error('FK Violation Details:', {
            table: error.table,
            fields: error.fields,
            index: error.index,
            value: error.value,
            constraint: error.constraint,
            parent: error.parent
          });

          // Identify which field caused the violation
          const fields = error.fields || [];
          const constraint = error.constraint || '';

          if (fields.includes('job_id') || constraint.includes('job_id')) {
            throw new Error('Invalid Job ID provided');
          }
          if (fields.includes('doctor_id') || constraint.includes('doctor_id')) {
            throw new Error('Invalid Doctor ID provided');
          }
          if (fields.includes('hospital_id') || constraint.includes('hospital_id')) {
            throw new Error('Invalid Hospital ID provided');
          }
          if (fields.includes('application_id') || constraint.includes('application_id')) {
            throw new Error('Invalid Application ID provided');
          }

          throw new Error(`Invalid reference provided: ${fields.join(', ') || 'Unknown entity'}`);
        }
        // Handle race condition: check one more time if it was created concurrently
        logger.warn('Error creating conversation, retrying lookup:', error);
        conversation = await Conversation.findOne({ where: whereClause });

        if (!conversation) {
          throw error; // Genuine error if still not found
        }
      }
    }

    return conversation;
  }

  /**
   * Ensure doctor, hospital, job, and application references are valid and consistent
   */
  private async validateConversationReferences(
    data: CreateConversationData
  ): Promise<{ jobId: string | null; applicationId: string | null }> {
    // Verify doctor and hospital exist with correct roles
    const [doctorUser, hospitalUser] = await Promise.all([
      User.findByPk(data.doctorId),
      User.findByPk(data.hospitalId),
    ]);

    if (!doctorUser) {
      throw new Error('Invalid Doctor ID provided');
    }
    if (!hospitalUser) {
      throw new Error('Invalid Hospital ID provided');
    }

    // Allow doctors that are in onboarding (pending) or fully verified
    if (![UserRole.DOCTOR, UserRole.PENDING].includes(doctorUser.role as UserRole)) {
      throw new Error('Provided doctor user is not a doctor account');
    }
    if (hospitalUser.role !== UserRole.HOSPITAL) {
      throw new Error('Provided hospital user is not a hospital account');
    }

    let validatedJobId: string | null = data.jobId || null;
    let validatedApplicationId: string | null = data.applicationId || null;

    // If application is provided, ensure it matches participants and derive jobId from it
    if (validatedApplicationId) {
      const application = await Application.findByPk(validatedApplicationId, {
        attributes: ['id', 'doctorId', 'hospitalId', 'jobId'],
      });

      if (!application) {
        throw new Error('Invalid Application ID provided');
      }

      if (
        application.doctorId !== data.doctorId ||
        application.hospitalId !== data.hospitalId
      ) {
        throw new Error('Application does not belong to the provided doctor/hospital');
      }

      validatedJobId = application.jobId;
    }

    // If job is provided (or inferred), ensure it belongs to the hospital
    if (validatedJobId) {
      const job = await Job.findByPk(validatedJobId, {
        attributes: ['id', 'hospitalId'],
      });

      if (!job) {
        throw new Error('Invalid Job ID provided');
      }

      if (job.hospitalId !== data.hospitalId) {
        throw new Error('Job does not belong to the hospital participant');
      }
    }

    return { jobId: validatedJobId, applicationId: validatedApplicationId };
  }

  /**
   * Get conversation by ID with participants
   */
  async getConversationById(conversationId: string, userId: string): Promise<Conversation | null> {
    const conversation = await Conversation.findOne({
      where: {
        id: conversationId,
        [Op.or]: [{ doctorId: userId }, { hospitalId: userId }],
      },
      include: [
        {
          association: 'doctor',
          attributes: ['id', 'fullName', 'avatarUrl'],
          include: [{ association: 'doctorProfile', attributes: ['specialization'] }],
        },
        {
          association: 'hospital',
          attributes: ['id', 'fullName', 'avatarUrl'],
          include: [{ association: 'hospitalProfile', attributes: ['hospitalName', 'images'] }],
        },
        {
          association: 'job',
          attributes: ['id', 'title', 'specialization'],
        },
      ],
    });

    return conversation;
  }

  /**
   * Get user's conversations (only accepted ones for doctors, all for hospitals)
   */
  async getUserConversations(
    userId: string,
    role: 'doctor' | 'hospital',
    page: number = 1,
    limit: number = 20
  ): Promise<{ conversations: Conversation[]; total: number }> {
    const whereClause: any = role === 'doctor' 
      ? { doctorId: userId, invitationStatus: 'accepted' } 
      : { hospitalId: userId };

    // Use findAll for counting to avoid Sequelize aggregate error
    const allIds = await Conversation.findAll({
      where: {
        ...whereClause,
        status: 'active',
      },
      attributes: ['id'],
    });
    const count = allIds.length;

    const rows = await Conversation.findAll({
      where: {
        ...whereClause,
        status: 'active',
      },
      include: [
        {
          association: 'doctor',
          attributes: ['id', 'fullName', 'avatarUrl'],
          include: [{ association: 'doctorProfile', attributes: ['specialization'] }],
        },
        {
          association: 'hospital',
          attributes: ['id', 'fullName', 'avatarUrl'],
          include: [{ association: 'hospitalProfile', attributes: ['hospitalName', 'images'] }],
        },
        {
          association: 'job',
          attributes: ['id', 'title'],
        },
      ],
      order: [['lastMessageAt', 'DESC'], ['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });

    return { conversations: rows, total: count };
  }

  /**
   * Send a message
   */
  async sendMessage(data: SendMessageData): Promise<Message> {
    const conversation = await Conversation.findByPk(data.conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Create message
    const message = await Message.create({
      conversationId: data.conversationId,
      senderId: data.senderId,
      senderRole: data.senderRole,
      content: data.content,
      type: data.type || 'text',
      attachments: data.attachments || null,
      metadata: data.metadata || null,
      status: 'sent',
    });

    // Update conversation's last message
    const recipientId = data.senderRole === 'doctor' ? conversation.hospitalId : conversation.doctorId;

    await conversation.update({
      lastMessageId: message.id,
      lastMessageText: data.content.substring(0, 100),
      lastMessageAt: message.createdAt,
      lastMessageSenderId: data.senderId,
      // Increment unread count for recipient
      ...(data.senderRole === 'doctor'
        ? { hospitalUnreadCount: conversation.hospitalUnreadCount + 1 }
        : { doctorUnreadCount: conversation.doctorUnreadCount + 1 }),
    });

    // Emit real-time events
    const messageWithSender = await Message.findByPk(message.id, {
      include: [{ association: 'sender', attributes: ['id', 'fullName', 'avatarUrl'] }],
    });

    // Emit to conversation room
    emitToConversation(data.conversationId, 'message:new', {
      message: messageWithSender,
      conversationId: data.conversationId,
    });

    // Emit notification to recipient if they're not in the conversation room
    emitToUser(recipientId, 'notification:message', {
      conversationId: data.conversationId,
      message: messageWithSender,
      senderName: (messageWithSender?.sender as any)?.fullName || 'Someone',
    });

    // Update delivery status if recipient is online
    if (isUserOnline(recipientId)) {
      await message.update({ status: 'delivered', deliveredAt: new Date() });
    }

    logger.debug(`Message sent: ${message.id} in conversation ${data.conversationId}`);
    return message;
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(
    conversationId: string,
    userId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedMessages> {
    // Verify user is part of conversation
    const conversation = await Conversation.findOne({
      where: {
        id: conversationId,
        [Op.or]: [{ doctorId: userId }, { hospitalId: userId }],
      },
    });

    if (!conversation) {
      throw new Error('Conversation not found or access denied');
    }

    const { rows, count } = await Message.findAndCountAll({
      where: {
        conversationId,
        isDeleted: false,
      },
      include: [{ association: 'sender', attributes: ['id', 'fullName', 'avatarUrl'] }],
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });

    const totalPages = Math.ceil(count / limit);

    return {
      messages: rows.reverse(), // Return in chronological order
      meta: {
        page,
        limit,
        totalItems: count,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(
    conversationId: string,
    userId: string,
    role: 'doctor' | 'hospital'
  ): Promise<void> {
    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation) return;

    // Update unread messages
    await Message.update(
      { status: 'read', readAt: new Date() },
      {
        where: {
          conversationId,
          senderId: { [Op.ne]: userId },
          status: { [Op.ne]: 'read' },
        },
      }
    );

    // Reset unread count
    if (role === 'doctor') {
      await conversation.update({ doctorUnreadCount: 0 });
    } else {
      await conversation.update({ hospitalUnreadCount: 0 });
    }

    // Emit read receipts
    emitToConversation(conversationId, 'messages:read', {
      conversationId,
      readBy: userId,
      readAt: new Date().toISOString(),
    });
  }

  /**
   * Get unread message count
   */
  async getUnreadCount(userId: string, role: 'doctor' | 'hospital'): Promise<number> {
    const whereClause = role === 'doctor' ? { doctorId: userId } : { hospitalId: userId };
    const countField = role === 'doctor' ? 'doctorUnreadCount' : 'hospitalUnreadCount';

    const conversations = await Conversation.findAll({
      where: { ...whereClause, status: 'active' },
      attributes: [countField],
    });

    return conversations.reduce((sum, conv) => sum + ((conv as any)[countField] || 0), 0);
  }

  /**
   * Delete message (soft delete)
   */
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await Message.findOne({
      where: { id: messageId, senderId: userId },
    });

    if (!message) {
      throw new Error('Message not found or not authorized');
    }

    await message.update({ isDeleted: true, deletedAt: new Date() });

    emitToConversation(message.conversationId, 'message:deleted', {
      messageId,
      conversationId: message.conversationId,
    });
  }

  /**
   * Send invitation message
   */
  async sendInvitation(
    hospitalId: string,
    doctorId: string,
    jobId: string,
    message: string
  ): Promise<{ conversation: Conversation; message: Message }> {
    const job = await Job.findByPk(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    // Check if doctor exists
    // conversation uses User model for doctorId reference.
    const doctorUser = await User.findByPk(doctorId);
    if (!doctorUser) {
      throw new Error('Doctor not found');
    }

    const conversation = await this.getOrCreateConversation({
      doctorId,
      hospitalId,
      jobId,
      type: 'application',
    });

    const invitationMessage = await this.sendMessage({
      conversationId: conversation.id,
      senderId: hospitalId,
      senderRole: 'hospital',
      content: message || `You have been invited to apply for: ${job.title}`,
      type: 'invitation',
      metadata: {
        invitationType: 'job',
        jobId,
        jobTitle: job.title,
      },
    });

    return { conversation, message: invitationMessage };
  }

  /**
   * Archive conversation
   */
  async archiveConversation(conversationId: string, userId: string): Promise<void> {
    await Conversation.update(
      { status: 'archived' },
      {
        where: {
          id: conversationId,
          [Op.or]: [{ doctorId: userId }, { hospitalId: userId }],
        },
      }
    );
  }

  /**
   * Search messages
   */
  async searchMessages(
    userId: string,
    role: 'doctor' | 'hospital',
    query: string,
    limit: number = 20
  ): Promise<Message[]> {
    const userField = role === 'doctor' ? 'doctorId' : 'hospitalId';

    const messages = await Message.findAll({
      where: {
        content: { [Op.iLike]: `%${query}%` },
        isDeleted: false,
      },
      include: [
        {
          association: 'conversation',
          where: { [userField]: userId },
          attributes: ['id'],
        },
        {
          association: 'sender',
          attributes: ['id', 'fullName', 'avatarUrl'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
    });

    return messages;
  }

  /**
   * Get pending invitation requests for doctor
   */
  async getPendingInvitations(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ invitations: Conversation[]; total: number }> {
    const whereClause = {
      doctorId: userId,
      invitationStatus: 'pending',
      status: 'active',
    };

    const allIds = await Conversation.findAll({
      where: whereClause,
      attributes: ['id'],
    });
    const count = allIds.length;

    const rows = await Conversation.findAll({
      where: whereClause,
      include: [
        {
          association: 'hospital',
          attributes: ['id', 'fullName', 'avatarUrl'],
          include: [{ association: 'hospitalProfile', attributes: ['hospitalName', 'images'] }],
        },
        {
          association: 'job',
          attributes: ['id', 'title', 'specialization'],
        },
        {
          association: 'messages',
          limit: 1,
          order: [['createdAt', 'ASC']],
          attributes: ['id', 'content', 'type', 'createdAt', 'metadata'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });

    return { invitations: rows, total: count };
  }

  /**
   * Accept invitation request
   */
  async acceptInvitation(conversationId: string, doctorId: string): Promise<Conversation> {
    const conversation = await Conversation.findOne({
      where: {
        id: conversationId,
        doctorId,
        invitationStatus: 'pending',
      },
    });

    if (!conversation) {
      throw new Error('Invitation not found or already processed');
    }

    await conversation.update({ invitationStatus: 'accepted' });

    // Send system message about acceptance
    await this.sendMessage({
      conversationId: conversation.id,
      senderId: doctorId,
      senderRole: 'doctor',
      content: 'Invitation accepted. You can now start chatting.',
      type: 'system',
    });

    // Notify hospital that invitation was accepted
    emitToUser(conversation.hospitalId, 'invitation:accepted', {
      conversationId: conversation.id,
      doctorId,
    });

    logger.info(`Invitation accepted: ${conversationId} by doctor ${doctorId}`);

    return conversation;
  }

  /**
   * Decline invitation request
   */
  async declineInvitation(conversationId: string, doctorId: string): Promise<void> {
    const conversation = await Conversation.findOne({
      where: {
        id: conversationId,
        doctorId,
        invitationStatus: 'pending',
      },
    });

    if (!conversation) {
      throw new Error('Invitation not found or already processed');
    }

    await conversation.update({ invitationStatus: 'declined', status: 'archived' });

    // Notify hospital that invitation was declined
    emitToUser(conversation.hospitalId, 'invitation:declined', {
      conversationId: conversation.id,
      doctorId,
    });

    logger.info(`Invitation declined: ${conversationId} by doctor ${doctorId}`);
  }

  /**
   * Get conversation with a specific hospital (for doctor view)
   */
  async getConversationWithHospital(
    doctorId: string,
    hospitalId: string,
    jobId?: string
  ): Promise<{
    exists: boolean;
    conversation?: Conversation;
    invitationStatus?: string;
    canMessage: boolean;
  }> {
    const whereClause: any = {
      doctorId,
      hospitalId,
      status: 'active',
    };

    if (jobId) {
      whereClause.jobId = jobId;
    }

    const conversation = await Conversation.findOne({
      where: whereClause,
      include: [
        {
          association: 'hospital',
          attributes: ['id', 'fullName', 'avatarUrl'],
          include: [{ association: 'hospitalProfile', attributes: ['hospitalName', 'images'] }],
        },
        {
          association: 'job',
          attributes: ['id', 'title'],
        },
        {
          association: 'messages',
          limit: 1,
          order: [['createdAt', 'ASC']],
          attributes: ['id', 'content', 'type', 'createdAt', 'metadata'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    if (!conversation) {
      return { exists: false, canMessage: false };
    }

    return {
      exists: true,
      conversation,
      invitationStatus: conversation.invitationStatus,
      canMessage: conversation.invitationStatus === 'accepted',
    };
  }
}

export const messageService = new MessageService();
export default messageService;
