// services/socket.ts
// Socket.IO client for real-time messaging and attendance notifications

import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENV } from '../config/env';
import { STORAGE_KEYS } from './api';

let socket: Socket | null = null;

// Attendance notification types
export interface AttendanceNotification {
  attendanceId: string;
  assignmentId: string;
  doctorId?: string;
  doctorName?: string;
  date: string;
  status: string;
  checkInTime?: string;
  checkOutTime?: string;
  workDuration?: { hours: number; minutes: number };
  message: string;
}

export interface SocketEventHandlers {
  onNewMessage?: (data: { message: any; conversationId: string }) => void;
  onMessageRead?: (data: { conversationId: string; messageIds: string[]; readBy: string; readAt: string }) => void;
  onTypingStart?: (data: { conversationId: string; userId: string }) => void;
  onTypingStop?: (data: { conversationId: string; userId: string }) => void;
  onUserOnline?: (data: { userId: string }) => void;
  onUserOffline?: (data: { userId: string }) => void;
  onNotification?: (data: { conversationId: string; message: any; senderName: string }) => void;
  onMessageDeleted?: (data: { messageId: string; conversationId: string }) => void;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
  // Attendance events for Hospital
  onAttendanceCheckInRequest?: (data: AttendanceNotification) => void;
  onAttendanceCheckOutRequest?: (data: AttendanceNotification) => void;
  // Attendance events for Doctor
  onAttendanceCheckInConfirmed?: (data: AttendanceNotification) => void;
  onAttendanceCheckOutConfirmed?: (data: AttendanceNotification) => void;
  onAttendanceCancelled?: (data: AttendanceNotification) => void;
  onAttendanceMarkedAbsent?: (data: AttendanceNotification) => void;
}

const eventHandlers: SocketEventHandlers = {};
const globalHandlers: SocketEventHandlers = {};

/**
 * Initialize socket connection
 */
export async function connectSocket(): Promise<Socket | null> {
  if (socket?.connected) {
    return socket;
  }
  // ... (rest of connectSocket)
  // ...



  try {
    const accessToken = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!accessToken) {
      return null;
    }

    // Extract base URL (remove /api/v1)
    const baseUrl = ENV.API_URL.replace('/api/v1', '');

    socket = io(baseUrl, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    // Setup event listeners
    socket.on('connect', () => {
      console.log('Socket connected:', socket?.id);
      eventHandlers.onConnect?.();
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      eventHandlers.onDisconnect?.(reason);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      eventHandlers.onError?.(error);
    });

    // Message events
    socket.on('message:new', (data) => {
      eventHandlers.onNewMessage?.(data);
    });

    socket.on('message:read', (data) => {
      eventHandlers.onMessageRead?.(data);
    });

    socket.on('message:deleted', (data) => {
      eventHandlers.onMessageDeleted?.(data);
    });

    // Typing events
    socket.on('typing:start', (data) => {
      eventHandlers.onTypingStart?.(data);
    });

    socket.on('typing:stop', (data) => {
      eventHandlers.onTypingStop?.(data);
    });

    // Online status events
    socket.on('user:online', (data) => {
      eventHandlers.onUserOnline?.(data);
    });

    socket.on('user:offline', (data) => {
      eventHandlers.onUserOffline?.(data);
    });

    // Notification events
    socket.on('notification:message', (data) => {
      eventHandlers.onNotification?.(data);
    });

    // Attendance events - for Hospital (receiving doctor's requests)
    socket.on('attendance:checkin_request', (data) => {
      globalHandlers.onAttendanceCheckInRequest?.(data);
      eventHandlers.onAttendanceCheckInRequest?.(data);
    });

    socket.on('attendance:checkout_request', (data) => {
      globalHandlers.onAttendanceCheckOutRequest?.(data);
      eventHandlers.onAttendanceCheckOutRequest?.(data);
    });

    // Attendance events - for Doctor (receiving hospital's responses)
    socket.on('attendance:checkin_confirmed', (data) => {
      eventHandlers.onAttendanceCheckInConfirmed?.(data);
    });

    socket.on('attendance:checkout_confirmed', (data) => {
      eventHandlers.onAttendanceCheckOutConfirmed?.(data);
    });

    socket.on('attendance:attendance_cancelled', (data) => {
      eventHandlers.onAttendanceCancelled?.(data);
    });

    socket.on('attendance:marked_absent', (data) => {
      eventHandlers.onAttendanceMarkedAbsent?.(data);
    });

    return socket;
  } catch (error) {
    console.error('Socket initialization error:', error);
    return null;
  }
}

/**
 * Disconnect socket
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Get socket instance
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Check if socket is connected
 */
export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}

/**
 * Register event handlers
 */
export function setSocketEventHandlers(handlers: SocketEventHandlers): void {
  Object.assign(eventHandlers, handlers);
}

/**
 * Remove specific event handlers to prevent memory leaks on unmount
 */
export function clearSocketEventHandlers(keys: (keyof SocketEventHandlers)[]): void {
  for (const key of keys) {
    delete (eventHandlers as any)[key];
  }
}

/**
 * Register global event handlers (App wide)
 */
export function setGlobalSocketEventHandlers(handlers: SocketEventHandlers): void {
  Object.assign(globalHandlers, handlers);
}

/**
 * Join a conversation room
 */
export function joinConversation(conversationId: string): void {
  if (socket?.connected) {
    socket.emit('conversation:join', conversationId);
  }
}

/**
 * Leave a conversation room
 */
export function leaveConversation(conversationId: string): void {
  if (socket?.connected) {
    socket.emit('conversation:leave', conversationId);
  }
}

/**
 * Emit typing started
 */
export function emitTypingStart(conversationId: string): void {
  if (socket?.connected) {
    socket.emit('typing:start', { conversationId });
  }
}

/**
 * Emit typing stopped
 */
export function emitTypingStop(conversationId: string): void {
  if (socket?.connected) {
    socket.emit('typing:stop', { conversationId });
  }
}

/**
 * Emit message read
 */
export function emitMessageRead(conversationId: string, messageIds: string[]): void {
  if (socket?.connected) {
    socket.emit('message:read', { conversationId, messageIds });
  }
}

/**
 * Join attendance room (for receiving attendance notifications)
 */
export function joinAttendanceRoom(): void {
  if (socket?.connected) {
    socket.emit('attendance:join');
  }
}

/**
 * Leave attendance room
 */
export function leaveAttendanceRoom(): void {
  if (socket?.connected) {
    socket.emit('attendance:leave');
  }
}

export default {
  connect: connectSocket,
  disconnect: disconnectSocket,
  getSocket,
  isConnected: isSocketConnected,
  setEventHandlers: setSocketEventHandlers,
  joinConversation,
  leaveConversation,
  emitTypingStart,
  emitTypingStop,
  emitMessageRead,
  joinAttendanceRoom,
  leaveAttendanceRoom,
  setGlobalSocketEventHandlers,
};
