import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useConversations, usePendingInvitations, ConversationPreview, InvitationRequest } from '../../hooks/useMessages';
import { useAuth } from '../../contexts/AuthContext';
import ChatScreen from '../_components/ChatScreen';

type ThreadTag = 'Application' | 'Interview' | 'General';

function tagStyle(tag: ThreadTag) {
  switch (tag) {
    case 'Application':
      return { container: 'bg-indigo-100', text: 'text-indigo-900', icon: 'document-text-outline' as const };
    case 'Interview':
      return { container: 'bg-emerald-100', text: 'text-emerald-900', icon: 'call-outline' as const };
    default:
      return { container: 'bg-gray-100', text: 'text-gray-700', icon: 'chatbubble-ellipses-outline' as const };
  }
}

function Avatar({ size = 48 }: { size?: number }) {
  return (
    <View
      style={{ width: size, height: size }}
      className="rounded-full bg-gray-100 border border-gray-300 items-center justify-center overflow-hidden"
    >
      <Ionicons name="person" size={Math.max(18, Math.floor(size * 0.45))} color="#4b5563" />
    </View>
  );
}

function mapTypeToTag(type: string): ThreadTag {
  switch (type) {
    case 'application':
      return 'Application';
    case 'interview':
      return 'Interview';
    default:
      return 'General';
  }
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function ThreadCard({
  conversation,
  onPress,
}: {
  conversation: ConversationPreview;
  onPress: () => void;
}) {
  const tag = tagStyle(mapTypeToTag(conversation.type));

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      className="bg-white rounded-xl border border-gray-300 px-4 py-3 flex-row items-center mb-3"
    >
      <View className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center overflow-hidden">
        <Ionicons name="business" size={20} color="#111827" />
      </View>

      <View className="flex-1 ml-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-bold text-gray-900 flex-1" numberOfLines={1}>
            {conversation.participant.name}
          </Text>
          <Text className="text-gray-500 text-xs ml-2">
            {formatTimeAgo(conversation.lastMessageAt)}
          </Text>
        </View>

        <View className="flex-row items-center mt-1">
          <View className={`px-2 py-1 rounded-full flex-row items-center ${tag.container}`}>
            <Ionicons name={tag.icon} size={12} color="#1e3a8a" />
            <Text className={`ml-1 font-bold text-xs ${tag.text}`}>
              {mapTypeToTag(conversation.type)}
            </Text>
          </View>
          {conversation.job && (
            <Text className="text-gray-500 text-xs ml-2" numberOfLines={1}>
              • {conversation.job.title}
            </Text>
          )}
        </View>

        <Text className="text-gray-500 text-sm mt-1" numberOfLines={1}>
          {conversation.lastMessage || 'No messages yet'}
        </Text>
      </View>

      <View className="ml-2 items-center justify-center">
        {conversation.unreadCount > 0 ? (
          <View className="w-5 h-5 rounded-full bg-blue-600 items-center justify-center">
            <Text className="text-white text-xs font-bold">{conversation.unreadCount}</Text>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
        )}
      </View>
    </TouchableOpacity>
  );
}

function EmptyState() {
  return (
    <View className="items-center py-12">
      <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
        <Ionicons name="chatbubble-ellipses-outline" size={40} color="#9ca3af" />
      </View>
      <Text className="text-gray-900 text-lg font-bold mb-2">No Messages Yet</Text>
      <Text className="text-gray-500 text-center px-8">
        When hospitals reach out to you about job opportunities, your conversations will appear here.
      </Text>
    </View>
  );
}

function InvitationCard({
  invitation,
  onAccept,
  onDecline,
  isProcessing,
}: {
  invitation: InvitationRequest;
  onAccept: () => void;
  onDecline: () => void;
  isProcessing: boolean;
}) {
  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <View className="bg-white rounded-xl border border-gray-300 mb-3 overflow-hidden">
      {/* Header with hospital info */}
      <View className="px-4 py-3 border-b border-gray-100 flex-row items-center">
        <View className="w-12 h-12 rounded-full bg-indigo-100 items-center justify-center">
          <Ionicons name="business" size={20} color="#4f46e5" />
        </View>
        <View className="flex-1 ml-3">
          <Text className="text-gray-900 text-base font-bold" numberOfLines={1}>
            {invitation.hospital.name}
          </Text>
          <Text className="text-gray-500 text-xs mt-0.5">
            {formatTimeAgo(invitation.createdAt)}
          </Text>
        </View>
        <View className="px-2 py-1 rounded-full bg-amber-100">
          <Text className="text-amber-800 text-xs font-bold">New Invite</Text>
        </View>
      </View>

      {/* Message content */}
      <View className="px-4 py-3">
        {invitation.job && (
          <View className="flex-row items-center mb-2">
            <Ionicons name="briefcase-outline" size={14} color="#6b7280" />
            <Text className="text-gray-600 text-sm font-medium ml-1">
              {invitation.job.title}
            </Text>
          </View>
        )}
        <Text className="text-gray-700 text-sm leading-5">
          {invitation.message?.content || 'You have been invited to connect.'}
        </Text>
      </View>

      {/* Action buttons */}
      <View className="px-4 py-3 bg-gray-50 flex-row justify-end space-x-3">
        <TouchableOpacity
          onPress={onDecline}
          disabled={isProcessing}
          activeOpacity={0.9}
          className="px-4 py-2 rounded-lg border border-gray-300 bg-white"
        >
          <Text className="text-gray-700 font-bold text-sm">Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onAccept}
          disabled={isProcessing}
          activeOpacity={0.9}
          className="px-4 py-2 rounded-lg bg-blue-600 flex-row items-center ml-3"
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text className="text-white font-bold text-sm mr-1">Continue to Message</Text>
              <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function EmptyInvitationsState() {
  return (
    <View className="items-center py-12">
      <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-4">
        <Ionicons name="mail-outline" size={32} color="#9ca3af" />
      </View>
      <Text className="text-gray-900 text-lg font-bold mb-2">No Invitations</Text>
      <Text className="text-gray-500 text-center px-8">
        When hospitals send you job invitations, they will appear here.
      </Text>
    </View>
  );
}

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { conversations, isLoading, error, unreadCount, refresh } = useConversations();
  const { 
    invitations, 
    isLoading: invitationsLoading, 
    total: invitationsCount,
    refresh: refreshInvitations,
    acceptInvitation,
    declineInvitation,
  } = usePendingInvitations();

  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<'messages' | 'notifications'>((tab as 'messages' | 'notifications') || 'messages');
  const [processingInvitation, setProcessingInvitation] = useState<string | null>(null);

  useEffect(() => {
    if (tab && (tab === 'messages' || tab === 'notifications')) {
      setActiveTab(tab);
    }
  }, [tab]);
  const [search, setSearch] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<ConversationPreview | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      [c.participant.name, c.lastMessage || '', c.type, c.job?.title || ''].some((v) =>
        v.toLowerCase().includes(q)
      )
    );
  }, [search, conversations]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshInvitations()]);
    setRefreshing(false);
  };

  const handleAcceptInvitation = async (invitation: InvitationRequest) => {
    setProcessingInvitation(invitation.id);
    const result = await acceptInvitation(invitation.id);
    setProcessingInvitation(null);
    
    if (result.success) {
      // Switch to messages tab and open the conversation
      setActiveTab('messages');
      await refresh();
      // Find the newly accepted conversation and open it
      const newConversation: ConversationPreview = {
        id: invitation.id,
        type: invitation.type as any,
        status: 'active',
        lastMessage: invitation.message?.content || null,
        lastMessageAt: invitation.createdAt,
        unreadCount: 0,
        job: invitation.job,
        participant: {
          id: invitation.hospital.id,
          name: invitation.hospital.name,
          avatar: invitation.hospital.avatar,
          subtitle: 'Hospital',
        },
      };
      setSelectedConversation(newConversation);
    } else {
      Alert.alert('Error', result.error || 'Failed to accept invitation');
    }
  };

  const handleDeclineInvitation = async (invitation: InvitationRequest) => {
    Alert.alert(
      'Decline Invitation',
      `Are you sure you want to decline the invitation from ${invitation.hospital.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setProcessingInvitation(invitation.id);
            const result = await declineInvitation(invitation.id);
            setProcessingInvitation(null);
            
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to decline invitation');
            }
          },
        },
      ]
    );
  };

  // Show chat screen when a conversation is selected
  if (selectedConversation) {
    // Find application status for this conversation's job
    const applicationForJob = selectedConversation.job?.id 
      ? conversations.find(c => c.job?.id === selectedConversation.job?.id)
      : null;
    
    return (
      <ChatScreen
        conversationId={selectedConversation.id}
        participant={selectedConversation.participant}
        onBack={() => {
          setSelectedConversation(null);
          refresh(); // Refresh conversations on back
        }}
        currentUserId={user?.id || ''}
        currentUserRole="doctor"
        applicationStatus={applicationForJob?.status || null}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#1e3a8a" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View className="px-4 pt-4 pb-4">
          <View className="w-full max-w-2xl self-center">
            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={() => router.back()}
                className="mr-3 p-2 -ml-2 rounded-full"
              >
                <Ionicons name="arrow-back" size={24} color="#111827" />
              </TouchableOpacity>
              <View>
                <Text className="text-gray-900 text-xl font-bold">Messages</Text>
                <Text className="text-gray-600 text-sm font-medium mt-1">Connect with recruiters</Text>
              </View>
            </View>

            {/* Segmented tabs */}
            <View className="mt-6 flex-row justify-around">
              <TouchableOpacity
                onPress={() => setActiveTab('messages')}
                activeOpacity={0.9}
                className={`px-4 py-2 rounded-lg ${activeTab === 'messages' ? 'bg-blue-900' : 'bg-gray-100'}`}
              >
                <View className="flex-row items-center">
                  <Text
                    className={`font-bold text-sm ${activeTab === 'messages' ? 'text-white' : 'text-gray-700'}`}
                  >
                    Messages
                  </Text>
                  {unreadCount > 0 && (
                    <View className="ml-2 px-1.5 py-0.5 rounded-full bg-red-500">
                      <Text className="text-white text-xs font-bold">{unreadCount}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab('notifications')}
                activeOpacity={0.9}
                className={`ml-3 px-4 py-2 rounded-lg ${activeTab === 'notifications' ? 'bg-blue-900' : 'bg-gray-100'
                  }`}
              >
                <View className="flex-row items-center">
                  <Text
                    className={`font-bold text-sm ${activeTab === 'notifications' ? 'text-white' : 'text-gray-700'
                      }`}
                  >
                    Notifications
                  </Text>
                  {invitationsCount > 0 && (
                    <View className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-500">
                      <Text className="text-white text-xs font-bold">{invitationsCount}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Search */}
        <View className="px-4">
          <View className="w-full max-w-2xl self-center">
            <View className="bg-white rounded-lg border border-gray-400 flex-row items-center overflow-hidden">
              <View className="flex-row items-center flex-1 px-3 py-2">
                <Ionicons name="search" size={16} color="#9CA3AF" />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search messages..."
                  placeholderTextColor="#9CA3AF"
                  className="flex-1 ml-2 text-gray-900 text-sm"
                />
              </View>
            </View>

            {/* Content */}
            <View className="mt-4">
              {isLoading ? (
                <View className="items-center py-12">
                  <ActivityIndicator size="large" color="#1e3a8a" />
                  <Text className="text-gray-500 mt-2">Loading conversations...</Text>
                </View>
              ) : error ? (
                <View className="items-center py-12">
                  <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
                  <Text className="text-red-500 mt-2">{error}</Text>
                  <TouchableOpacity
                    onPress={refresh}
                    className="mt-4 bg-blue-900 px-4 py-2 rounded-lg"
                  >
                    <Text className="text-white font-bold">Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : activeTab === 'messages' ? (
                filteredConversations.length === 0 ? (
                  <EmptyState />
                ) : (
                  filteredConversations.map((c) => (
                    <ThreadCard
                      key={c.id}
                      conversation={c}
                      onPress={() => setSelectedConversation(c)}
                    />
                  ))
                )
              ) : (
                // Notifications tab - show invitations
                invitationsLoading ? (
                  <View className="items-center py-12">
                    <ActivityIndicator size="large" color="#1e3a8a" />
                    <Text className="text-gray-500 mt-2">Loading invitations...</Text>
                  </View>
                ) : invitations.length === 0 ? (
                  <EmptyInvitationsState />
                ) : (
                  invitations.map((inv) => (
                    <InvitationCard
                      key={inv.id}
                      invitation={inv}
                      onAccept={() => handleAcceptInvitation(inv)}
                      onDecline={() => handleDeclineInvitation(inv)}
                      isProcessing={processingInvitation === inv.id}
                    />
                  ))
                )
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
