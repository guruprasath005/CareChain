// Shared Chat Screen Component for Doctor and Hospital
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useChat, ChatMessage, Participant } from '../../hooks/useMessages';

interface ChatScreenProps {
  conversationId: string;
  participant: Participant;
  onBack: () => void;
  currentUserId: string;
  currentUserRole: 'doctor' | 'hospital';
  invitationStatus?: 'pending' | 'accepted' | 'declined';
  applicationStatus?: string | null; // Add application status prop
}

function Avatar({ size = 48, avatar }: { size?: number; avatar?: string | null }) {
  return (
    <View
      style={{ width: size, height: size }}
      className="rounded-full bg-gray-100 border border-gray-300 items-center justify-center overflow-hidden"
    >
      <Ionicons name="person" size={Math.max(18, Math.floor(size * 0.45))} color="#4b5563" />
    </View>
  );
}

function ChatBubble({
  message,
  isMe,
}: {
  message: ChatMessage;
  isMe: boolean;
}) {
  const bubbleClass = isMe
    ? 'bg-brand-primary rounded-xl rounded-br-lg'
    : 'bg-white rounded-xl rounded-bl-lg border border-gray-300';
  const textClass = isMe ? 'text-white' : 'text-gray-900';
  const timeClass = isMe ? 'text-white/70' : 'text-gray-500';

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Handle special message types
  if (message.type === 'system') {
    return (
      <View className="w-full items-center mb-3">
        <View className="px-3 py-1 rounded-full bg-gray-100">
          <Text className="text-gray-600 text-xs font-medium">{message.content}</Text>
        </View>
      </View>
    );
  }

  if (message.type === 'invitation') {
    return (
      <View className="bg-white rounded-xl border border-gray-300 overflow-hidden mb-3">
        <View className="flex-row">
          <View className="w-1 bg-brand-primary" />
          <View className="flex-1 p-3">
            <View className="flex-row items-center">
              <View className="w-9 h-9 rounded-lg bg-indigo-100 items-center justify-center">
                <Ionicons name="mail" size={16} color={Colors.brand.primary} />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-gray-900 font-bold text-base">Job Invitation</Text>
                <Text className="text-gray-500 text-sm mt-1">{message.content}</Text>
              </View>
            </View>
            <Text className={`${timeClass} text-xs font-medium mt-2 text-right`}>
              {formatTime(message.createdAt)}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (message.type === 'contact_share') {
    return (
      <View className="bg-white rounded-xl border border-gray-300 overflow-hidden mb-3">
        <View className="flex-row">
          <View className="w-1 bg-brand-primary" />
          <View className="flex-1 p-3">
            <View className="flex-row items-center">
              <View className="w-9 h-9 rounded-lg bg-blue-100 items-center justify-center">
                <Ionicons name="person" size={16} color={Colors.brand.primary} />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-gray-900 font-bold text-base">Contact Details Shared</Text>
                <Text className="text-gray-500 text-sm mt-1">{message.content}</Text>
              </View>
            </View>
            <Text className={`${timeClass} text-xs font-medium mt-2 text-right`}>
              {formatTime(message.createdAt)}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className={`w-full flex-row ${isMe ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isMe && (
        <View className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center mr-2 mt-1">
          <Ionicons name="person" size={14} color="#111827" />
        </View>
      )}

      <View className={`max-w-[80%] px-3 py-2 ${bubbleClass}`}>
        <Text className={`${textClass} text-sm font-medium`}>{message.content}</Text>
        <View className="flex-row items-center justify-end mt-1">
          <Text className={`${timeClass} text-xs font-medium`}>{formatTime(message.createdAt)}</Text>
          {isMe && (
            <View className="ml-1">
              <Ionicons
                name={message.status === 'read' ? 'checkmark-done' : 'checkmark'}
                size={12}
                color={message.status === 'read' ? '#60a5fa' : '#93c5fd'}
              />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function ShareContactCard({ onPress }: { onPress?: () => void }) {
  return (
    <View className="bg-white rounded-xl border border-gray-300 overflow-hidden mb-3">
      <View className="flex-row">
        <View className="w-1 bg-brand-primary" />
        <View className="flex-1 p-3">
          <View className="flex-row items-center">
            <View className="w-9 h-9 rounded-lg bg-blue-100 items-center justify-center">
              <Ionicons name="lock-closed" size={16} color={Colors.brand.primary} />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-gray-900 font-bold text-base">Share Contact Details</Text>
              <Text className="text-gray-500 text-sm mt-1">
                Help the recruiter contact you faster for the interview process
              </Text>
            </View>
          </View>

          <View className="items-end mt-2">
            <TouchableOpacity
              onPress={onPress}
              activeOpacity={0.9}
              className="bg-brand-primary rounded-lg px-3 py-2 flex-row items-center"
            >
              <Text className="text-white font-bold text-sm mr-2">Share Now</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

function TypingIndicator() {
  return (
    <View className="flex-row items-center mb-3">
      <View className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center mr-2">
        <Ionicons name="person" size={14} color="#111827" />
      </View>
      <View className="bg-gray-100 rounded-xl px-4 py-3">
        <View className="flex-row">
          <View className="w-2 h-2 rounded-full bg-gray-400 mr-1 animate-pulse" />
          <View className="w-2 h-2 rounded-full bg-gray-400 mr-1 animate-pulse" />
          <View className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
        </View>
      </View>
    </View>
  );
}

export default function ChatScreen({
  conversationId,
  participant,
  onBack,
  currentUserId,
  currentUserRole,
  invitationStatus,
  applicationStatus,
}: ChatScreenProps) {
  const {
    messages,
    isLoading,
    isSending,
    isTyping,
    sendMessage,
    handleTyping,
  } = useChat(conversationId);

  const [draft, setDraft] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Check if doctor can share contact info
  // Only allowed if shortlisted or interview scheduled
  const canShareContact = currentUserRole === 'doctor' && 
    applicationStatus && 
    ['shortlisted', 'interview_scheduled', 'interviewed'].includes(applicationStatus.toLowerCase());

  const handleSend = async () => {
    if (!draft.trim()) return;
    const content = draft.trim();
    setDraft('');
    await sendMessage(content);
  };

  const handleMenuAction = (action: string) => {
    setShowMenu(false);
    switch (action) {
      case 'block':
        // Implement block logic
        console.log('Block user');
        break;
      case 'delete':
        // Implement delete logic
        console.log('Delete conversation');
        break;
      case 'star':
        // Implement star logic
        console.log('Star conversation');
        break;
      case 'mute':
        // Implement mute logic
        console.log('Mute conversation');
        break;
    }
  };

  const handleShareContact = async () => {
    await sendMessage('Contact details shared', 'contact_share', {
      type: 'contact_share',
    });
  };

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages.length]);

  // Group messages by date
  const groupMessagesByDate = (msgs: ChatMessage[]) => {
    const groups: { date: string; messages: ChatMessage[] }[] = [];
    let currentDate = '';

    msgs.forEach((msg) => {
      const msgDate = new Date(msg.createdAt).toLocaleDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });

    return groups;
  };

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const messageGroups = groupMessagesByDate(messages);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.brand.secondary} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Chat Header */}
        <View className="px-4 pt-4 pb-3 border-b border-gray-300 bg-white z-20">
          <View className="w-full max-w-2xl self-center">
            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={onBack}
                activeOpacity={0.85}
                className="w-9 h-9 rounded-full bg-gray-100 border border-gray-300 items-center justify-center"
              >
                <Ionicons name="arrow-back" size={18} color="#4b5563" />
              </TouchableOpacity>

              <View className="flex-row items-center flex-1 ml-3">
                <View className="mr-3">
                  <Avatar size={36} avatar={participant.avatar} />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-900 text-base font-bold" numberOfLines={1}>
                    {participant.name}
                  </Text>
                  <Text className="text-gray-600 text-sm font-medium" numberOfLines={1}>
                    {participant.subtitle || (isTyping ? 'Typing...' : 'Active now')}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setShowMenu(!showMenu)}
                activeOpacity={0.85}
                className={`w-9 h-9 rounded-full border items-center justify-center ml-2 ${showMenu ? 'bg-blue-100 border-blue-300' : 'bg-gray-100 border-gray-300'
                  }`}
              >
                <Ionicons name="ellipsis-vertical" size={18} color={showMenu ? Colors.brand.primary : '#4b5563'} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Menu Dropdown Overlay */}
        {showMenu && (
          <>
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => setShowMenu(false)}
              className="absolute top-0 bottom-0 left-0 right-0 z-30 bg-black/10"
            />
            <View className="absolute top-[60px] right-4 z-40 w-56 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
              <TouchableOpacity
                onPress={() => handleMenuAction('star')}
                className="flex-row items-center px-4 py-3 border-b border-gray-100 active:bg-gray-50"
              >
                <Ionicons name="star-outline" size={20} color="#eab308" />
                <Text className="ml-3 text-gray-700 font-medium">Star Conversation</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleMenuAction('mute')}
                className="flex-row items-center px-4 py-3 border-b border-gray-100 active:bg-gray-50"
              >
                <Ionicons name="notifications-off-outline" size={20} color="#6b7280" />
                <Text className="ml-3 text-gray-700 font-medium">Mute Notifications</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleMenuAction('block')}
                className="flex-row items-center px-4 py-3 border-b border-gray-100 active:bg-gray-50"
              >
                <Ionicons name="ban-outline" size={20} color="#ef4444" />
                <Text className="ml-3 text-red-500 font-medium">Block User</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleMenuAction('delete')}
                className="flex-row items-center px-4 py-3 active:bg-gray-50"
              >
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
                <Text className="ml-3 text-red-500 font-medium">Delete Conversation</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Messages */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={Colors.brand.primary} />
            <Text className="text-gray-500 mt-2">Loading messages...</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            className="flex-1"
            contentContainerStyle={{ paddingVertical: 12 }}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
          >
            <View className="px-4 w-full max-w-2xl self-center">
              {messages.length === 0 ? (
                <View className="items-center py-8">
                  <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-4">
                    <Ionicons name="chatbubble-outline" size={32} color="#9ca3af" />
                  </View>
                  <Text className="text-gray-500 text-center">
                    No messages yet.{'\n'}Start the conversation!
                  </Text>
                </View>
              ) : (
                messageGroups.map((group, groupIdx) => (
                  <View key={group.date}>
                    {/* Date separator */}
                    <View className="items-center mb-3 mt-2">
                      <View className="px-3 py-1 rounded-full bg-gray-100">
                        <Text className="text-gray-600 text-xs font-medium">
                          {formatDateLabel(group.messages[0].createdAt)}
                        </Text>
                      </View>
                    </View>

                    {group.messages.map((msg, idx) => (
                      <ChatBubble
                        key={msg.id}
                        message={msg}
                        isMe={msg.senderId === currentUserId}
                      />
                    ))}
                  </View>
                ))
              )}

              {isTyping && <TypingIndicator />}

              {/* Show share contact card for doctors only if shortlisted/interview scheduled */}
              {canShareContact && messages.length > 0 && !messages.some(m => m.type === 'contact_share') && (
                <ShareContactCard onPress={handleShareContact} />
              )}
            </View>
          </ScrollView>
        )}

        {/* Message Input or Pending Status */}
        {invitationStatus === 'pending' && currentUserRole === 'hospital' ? (
          <View className="bg-white border-t border-gray-300 px-4 py-4 items-center">
            <View className="bg-orange-50 rounded-xl px-4 py-3 border border-orange-100 w-full flex-row items-center justify-center">
              <Ionicons name="time-outline" size={20} color="#f97316" />
              <Text className="text-orange-800 font-semibold ml-2">Waiting for acceptance</Text>
            </View>
            <Text className="text-gray-500 text-xs mt-2 text-center">
              You can send messages once {participant.name} accepts your invitation.
            </Text>
          </View>
        ) : (
          <View className="bg-white border-t border-gray-300 px-3 py-2">
            <View className="w-full max-w-2xl self-center flex-row items-center">
              <TouchableOpacity
                activeOpacity={0.85}
                className="w-10 h-10 rounded-lg bg-gray-100 items-center justify-center"
              >
                <Ionicons name="add" size={20} color="#6B7280" />
              </TouchableOpacity>

              <View className="flex-1 mx-2">
                <View className="bg-gray-100 rounded-lg px-3 py-2 flex-row items-center">
                  <TextInput
                    value={draft}
                    onChangeText={(text) => {
                      setDraft(text);
                      handleTyping();
                    }}
                    placeholder="Type a message..."
                    placeholderTextColor="#9CA3AF"
                    className="flex-1 text-gray-900 text-sm"
                    multiline
                    maxLength={1000}
                  />
                  <TouchableOpacity activeOpacity={0.85}>
                    <Ionicons name="happy-outline" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleSend}
                disabled={isSending || !draft.trim()}
                activeOpacity={0.9}
                className={`w-10 h-10 rounded-lg items-center justify-center ${draft.trim() ? 'bg-brand-primary' : 'bg-gray-300'
                  }`}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="send" size={18} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
