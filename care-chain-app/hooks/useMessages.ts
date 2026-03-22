// hooks/useMessages.ts
// Hooks for messaging functionality

import { useState, useEffect, useCallback, useRef } from 'react';
import { messageApi, ApiError } from '../services/api';
import socketService, {
  connectSocket,
  disconnectSocket,
  joinConversation,
  leaveConversation,
  emitTypingStart,
  emitTypingStop,
  setSocketEventHandlers,
  clearSocketEventHandlers,
} from '../services/socket';

export interface Participant {
  id: string;
  name: string;
  avatar?: string | null;
  subtitle?: string;
}

export interface ConversationPreview {
  id: string;
  type: 'application' | 'interview' | 'general' | 'support';
  status: string;
  invitationStatus?: 'pending' | 'accepted' | 'declined';
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  job: { id: string; title: string } | null;
  participant: Participant;
}

export interface InvitationRequest {
  id: string;
  type: string;
  status: string;
  invitationStatus: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  job: { id: string; title: string } | null;
  hospital: {
    id: string;
    name: string;
    avatar?: string | null;
  };
  message: {
    id: string;
    content: string;
    type: string;
    createdAt: string;
    metadata?: any;
  } | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: 'doctor' | 'hospital';
  type: 'text' | 'image' | 'file' | 'system' | 'invitation' | 'contact_share';
  content: string;
  attachments?: any[];
  metadata?: any;
  status: 'sent' | 'delivered' | 'read';
  createdAt: string;
  sender?: {
    id: string;
    name: string;
    avatar?: string | null;
  };
}

/**
 * Hook for managing conversations list
 */
export function useConversations() {
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchConversations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await messageApi.getConversations();
      if (response.success && response.data) {
        setConversations(response.data);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to fetch conversations';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await messageApi.getUnreadCount();
      if (response.success && response.data) {
        setUnreadCount(response.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    fetchUnreadCount();

    // Connect socket and listen for new messages
    connectSocket();

    setSocketEventHandlers({
      onNewMessage: (data) => {
        // Update conversation in list
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.id === data.conversationId);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              lastMessage: data.message.content,
              lastMessageAt: data.message.createdAt,
              unreadCount: updated[idx].unreadCount + 1,
            };
            // Move to top
            return [updated[idx], ...updated.filter((_, i) => i !== idx)];
          }
          return prev;
        });
        setUnreadCount((prev) => prev + 1);
      },
      onNotification: () => {
        fetchUnreadCount();
      },
    });

    return () => {
      clearSocketEventHandlers(['onNewMessage', 'onNotification']);
    };
  }, [fetchConversations, fetchUnreadCount]);

  return {
    conversations,
    isLoading,
    error,
    unreadCount,
    refresh: fetchConversations,
    refreshUnread: fetchUnreadCount,
  };
}

// Maximum messages kept in memory per conversation to prevent unbounded growth
const MAX_MESSAGES = 200;

/**
 * Hook for managing a single conversation's messages
 */
export function useChat(conversationId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMessages = useCallback(async (page: number = 1) => {
    if (!conversationId) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await messageApi.getMessages(conversationId, page);
      if (response.success && response.data) {
        const incoming: ChatMessage[] = Array.isArray(response.data)
          ? response.data
          : (response.data as any).messages ?? response.data;

        if (page === 1) {
          // Trim to cap on initial load
          setMessages(incoming.slice(-MAX_MESSAGES));
        } else {
          // Prepend older messages (load-more), keep within cap
          setMessages((prev) => [...incoming, ...prev].slice(-MAX_MESSAGES));
        }
        setCurrentPage(page);
        // Detect if there are more pages
        const total = (response as any).meta?.totalItems ?? incoming.length;
        setHasMore(page * 20 < total);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to fetch messages';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchMessages(currentPage + 1);
    }
  }, [isLoading, hasMore, currentPage, fetchMessages]);

  const sendMessage = useCallback(async (content: string, type: string = 'text', metadata?: any) => {
    if (!conversationId || !content.trim()) return null;

    setIsSending(true);
    try {
      const response = await messageApi.sendMessage(conversationId, content.trim(), type, metadata);
      if (response.success && response.data?.message) {
        const newMessage = response.data.message;
        setMessages((prev) => [...prev, newMessage]);
        return newMessage;
      }
      return null;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to send message';
      setError(message);
      return null;
    } finally {
      setIsSending(false);
    }
  }, [conversationId]);

  const markAsRead = useCallback(async () => {
    if (!conversationId) return;
    try {
      await messageApi.markAsRead(conversationId);
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  }, [conversationId]);

  const handleTyping = useCallback(() => {
    emitTypingStart(conversationId);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      emitTypingStop(conversationId);
    }, 2000);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;

    fetchMessages();
    markAsRead();

    // Join conversation room
    joinConversation(conversationId);

    // Set up socket handlers for this conversation
    setSocketEventHandlers({
      onNewMessage: (data) => {
        if (data.conversationId === conversationId) {
          setMessages((prev) => {
            const updated = [...prev, data.message];
            return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated;
          });
          markAsRead();
        }
      },
      onTypingStart: (data) => {
        if (data.conversationId === conversationId) {
          setIsTyping(true);
          setTypingUserId(data.userId);
        }
      },
      onTypingStop: (data) => {
        if (data.conversationId === conversationId) {
          setIsTyping(false);
          setTypingUserId(null);
        }
      },
      onMessageRead: (data) => {
        if (data.conversationId === conversationId) {
          setMessages((prev) =>
            prev.map((msg) => ({
              ...msg,
              status: 'read' as const,
            }))
          );
        }
      },
      onMessageDeleted: (data) => {
        if (data.conversationId === conversationId) {
          setMessages((prev) => prev.filter((msg) => msg.id !== data.messageId));
        }
      },
    });

    return () => {
      leaveConversation(conversationId);
      clearSocketEventHandlers([
        'onNewMessage',
        'onTypingStart',
        'onTypingStop',
        'onMessageRead',
        'onMessageDeleted',
      ]);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversationId, fetchMessages, markAsRead]);

  return {
    messages,
    isLoading,
    isSending,
    error,
    isTyping,
    typingUserId,
    hasMore,
    sendMessage,
    loadMore,
    refresh: fetchMessages,
    markAsRead,
    handleTyping,
  };
}

/**
 * Hook for creating a new conversation
 */
export function useCreateConversation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createConversation = useCallback(async (
    participantId: string,
    options?: {
      jobId?: string;
      applicationId?: string;
      type?: string;
      initialMessage?: string;
    }
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await messageApi.createConversation({
        participantId,
        ...options,
      });
      if (response.success && response.data?.conversation) {
        return response.data.conversation;
      }
      throw new Error('Failed to create conversation');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create conversation';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { createConversation, isLoading, error };
}

/**
 * Hook for sending job invitations
 */
export function useSendInvitation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendInvitation = useCallback(async (doctorId: string, jobId: string, message?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await messageApi.sendInvitation(doctorId, jobId, message);
      if (response.success) {
        return { success: true, data: response.data };
      }
      throw new Error('Failed to send invitation');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to send invitation';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { sendInvitation, isLoading, error };
}

/**
 * Hook for managing pending invitations (Doctor)
 */
export function usePendingInvitations() {
  const [invitations, setInvitations] = useState<InvitationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchInvitations = useCallback(async (page: number = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await messageApi.getPendingInvitations(page);
      if (response.success && response.data) {
        setInvitations(response.data);
        setTotal(response.meta?.totalItems || response.data.length);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to fetch invitations';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const acceptInvitation = useCallback(async (conversationId: string) => {
    try {
      const response = await messageApi.acceptInvitation(conversationId);
      if (response.success) {
        // Remove the accepted invitation from the list
        setInvitations((prev) => prev.filter((inv) => inv.id !== conversationId));
        setTotal((prev) => Math.max(0, prev - 1));
        return { success: true, conversation: response.data?.conversation };
      }
      throw new Error('Failed to accept invitation');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to accept invitation';
      return { success: false, error: message };
    }
  }, []);

  const declineInvitation = useCallback(async (conversationId: string) => {
    try {
      const response = await messageApi.declineInvitation(conversationId);
      if (response.success) {
        // Remove the declined invitation from the list
        setInvitations((prev) => prev.filter((inv) => inv.id !== conversationId));
        setTotal((prev) => Math.max(0, prev - 1));
        return { success: true };
      }
      throw new Error('Failed to decline invitation');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to decline invitation';
      return { success: false, error: message };
    }
  }, []);

  useEffect(() => {
    fetchInvitations();

    // Connect socket and listen for new invitations
    connectSocket();

    setSocketEventHandlers({
      onNotification: (data: any) => {
        // Refresh invitations when new notification arrives
        if (data.type === 'invitation' || data.message?.type === 'invitation') {
          fetchInvitations();
        }
      },
    });

    return () => {
      clearSocketEventHandlers(['onNotification']);
    };
  }, [fetchInvitations]);

  return {
    invitations,
    isLoading,
    error,
    total,
    refresh: fetchInvitations,
    acceptInvitation,
    declineInvitation,
  };
}
