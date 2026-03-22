import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View, Alert, Image } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import api, { messageApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { usePendingInvitations } from '@/hooks/useMessages';
import { useDoctorProfile } from '@/hooks/useProfile';
import ChatScreen from '@/app/_components/ChatScreen';
import { mapCapabilityTags, CapabilityChip, ProfileSectionStatic, DetailRow, formatPhoneNumber, StaffingCard, mapInfrastructureTags, InfrastructureTag, VerifiedDocRow } from '@/app/(doctor)/_components/ProfileComponents';

type HospitalPublicProfile = {
  id: string;
  name: string;
  type?: string | null;
  description?: string | null;
  website?: string | null;
  logo?: string | null;
  coverPhoto?: string | null;
  registrationNumber?: string | null;
  establishedYear?: number | null;
  location?: {
    city?: string | null;
    state?: string | null;
    fullAddress?: string | null;
  };
  specialties?: string[];
  departments?: Array<{
    name: string;
    headName?: string;
    contactNumber?: string;
  }>;
  facilities?: {
    emergency24x7?: boolean;
    icuFacilities?: boolean;
    diagnosticLab?: boolean;
    pharmacy?: boolean;
    ambulanceService?: boolean;
    bloodBank?: boolean;
    parking?: boolean;
    canteen?: boolean;
    wifi?: boolean;
    atm?: boolean;
    wheelchairAccess?: boolean;
    cafeteria?: boolean;
    opFacility?: boolean;
    ipFacility?: boolean;
    ipBeds?: number;
    radiologyDepartment?: boolean;
  };
  infrastructure?: {
    totalBeds?: number;
    icuBeds?: number;
    operationTheaters?: number;
    emergencyBeds?: number;
    photos?: Array<{ url: string; caption?: string }>;
  };
  workingHours?: Record<string, { isOpen: boolean; openTime?: string; closeTime?: string }>;
  stats?: {
    rating?: number;
    totalEmployees?: number;
    activeJobs?: number;
    totalHires?: number;
  };
  isVerified?: boolean;
  isOpen24Hours?: boolean;
  hospitalLicense?: {
    licenseNumber?: string;
    issuingAuthority?: string;
  };
  nabhAccreditation?: {
    certificateNumber?: string;
    validUntil?: string;
  };
  representative?: {
    fullName?: string;
    email?: string;
    phone?: { countryCode: string; number: string };
  };
  contactPersons?: Array<{
    name: string;
    designation?: string;
    email?: string;
    phone?: { countryCode: string; number: string };
    isPrimary: boolean;
  }>;
  staffing?: {
    totalDoctors?: number;
    totalNurses?: number;
  };
  credentials?: {
    registrationNumber?: string;
    accreditations?: string[];
    establishmentLicense?: {
      url?: string;
      isVerified?: boolean;
    };
    fireSafetyNOC?: {
      url?: string;
      isVerified?: boolean;
    };
  };
};


type ConversationStatus = {
  exists: boolean;
  conversation?: any;
  invitationStatus?: 'pending' | 'accepted' | 'declined';
  canMessage: boolean;
};

export default function HospitalProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile: doctorProfile } = useDoctorProfile();
  const { id, jobId } = useLocalSearchParams<{ id?: string; jobId?: string }>();

  const [profile, setProfile] = useState<HospitalPublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Conversation & Invite Logic
  const { acceptInvitation, declineInvitation } = usePendingInvitations();
  const [conversationStatus, setConversationStatus] = useState<ConversationStatus | null>(null);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [processingInvitation, setProcessingInvitation] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isAboutExpanded, setIsAboutExpanded] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!id) {
      setError('Hospital id missing');
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const res = await api.search.getHospitalPublicProfile(String(id));
      if (!res.success || !res.data) {
        setError(res.message || res.error || 'Failed to load hospital profile');
        setProfile(null);
        return;
      }
      setProfile(res.data as HospitalPublicProfile);
    } catch (e: any) {
      console.error('[HospitalProfile] Failed to fetch profile:', e);
      const errorMessage = e?.message || 'Failed to load hospital profile';
      setError(errorMessage);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const fetchConversationStatus = useCallback(async () => {
    if (!id) return;
    setConversationLoading(true);
    try {
      const res = await messageApi.getConversationWithHospital(String(id), jobId);
      if (res.success && res.data) {
        setConversationStatus(res.data as ConversationStatus);
      } else {
        // Silently fail - conversation status is optional
        setConversationStatus(null);
      }
    } catch (e) {
      // Silently fail - conversation status is optional
      console.error('[HospitalProfile] Failed to fetch conversation status:', e);
      setConversationStatus(null);
    } finally {
      setConversationLoading(false);
    }
  }, [id, jobId]);

  useEffect(() => {
    fetchProfile();
    fetchConversationStatus();
  }, [fetchProfile, fetchConversationStatus]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchProfile(), fetchConversationStatus()]);
    setRefreshing(false);
  }, [fetchProfile, fetchConversationStatus]);

  // Invitation Handlers
  const handleAcceptInvitation = async () => {
    if (!conversationStatus?.conversation?.id) return;
    setProcessingInvitation(true);
    const result = await acceptInvitation(conversationStatus.conversation.id);
    setProcessingInvitation(false);
    if (result.success) {
      Alert.alert('Success', 'Invitation accepted! You can now chat with the hospital.');
      fetchConversationStatus();
    } else {
      Alert.alert('Error', result.error || 'Failed to accept invitation');
    }
  };

  const handleDeclineInvitation = async () => {
    if (!conversationStatus?.conversation?.id) return;
    Alert.alert(
      'Decline Invitation',
      'Are you sure you want to decline this invitation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setProcessingInvitation(true);
            const result = await declineInvitation(conversationStatus.conversation.id);
            setProcessingInvitation(false);
            if (result.success) {
              Alert.alert('Success', 'Invitation declined.');
              fetchConversationStatus();
            } else {
              Alert.alert('Error', result.error || 'Failed to decline invitation');
            }
          },
        },
      ]
    );
  };

  const handleOpenChat = () => {
    if (conversationStatus?.canMessage && conversationStatus?.conversation) {
      setShowChat(true);
    }
  };

  const locationText = useMemo(() => {
    if (!profile?.location) return null;
    const city = profile.location.city?.trim();
    const state = profile.location.state?.trim();
    const full = profile.location.fullAddress?.trim();
    return full || [city, state].filter(Boolean).join(', ');
  }, [profile]);

  // Show chat screen
  if (showChat && conversationStatus?.conversation) {
    // Get application status from conversation if available
    const applicationStatus = conversationStatus?.conversation?.application?.status || null;
    
    return (
      <ChatScreen
        conversationId={conversationStatus.conversation.id}
        participant={{
          id: id || '',
          name: profile?.name || 'Hospital',
          avatar: profile?.logo || null,
          subtitle: 'Hospital',
        }}
        onBack={() => {
          setShowChat(false);
          fetchConversationStatus();
        }}
        currentUserId={user?.id || ''}
        currentUserRole="doctor"
        applicationStatus={applicationStatus}
      />
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator testID="activity-indicator" size="large" color="#1A1464" />
        <Text className="text-gray-500 mt-2">Loading hospital profile...</Text>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-lg font-semibold text-gray-800 mb-2">{error || 'Hospital not found'}</Text>
        <TouchableOpacity onPress={() => router.back()} className="bg-indigo-900 px-4 py-2 rounded-lg">
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      testID="hospital-profile-scroll"
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View className="px-4 pt-4">
        <TouchableOpacity activeOpacity={0.8} className="mb-3" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>

        {/* Doctor Identity Header */}
        <View className="bg-white rounded-2xl border border-gray-200 p-5 mb-4 shadow-sm items-center">
          {/* Doctor Avatar */}
          <View className="w-20 h-20 rounded-full bg-gray-100 border-2 border-gray-200 items-center justify-center overflow-hidden mb-3">
            {user?.avatar || doctorProfile?.avatar ? (
              <Image
                source={{ uri: user?.avatar || doctorProfile?.avatar || '' }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <Ionicons name="person" size={40} color="#9ca3af" />
            )}
          </View>

          {/* Doctor Name */}
          <Text className="text-xl font-extrabold text-gray-900 text-center mb-1">
            {user?.fullName || doctorProfile?.name || 'Doctor'}
          </Text>

          {/* Doctor Specialization (conditional) */}
          {doctorProfile?.specialization && (
            <Text className="text-sm text-gray-600 text-center">
              {doctorProfile.specialization}
            </Text>
          )}
        </View>

        {/* General Information Section */}
        <View className="bg-white rounded-2xl border border-gray-200 p-5 mb-4 shadow-sm">
          {/* Hospital Avatar and Name */}
          <View className="flex-row items-start mb-4">
            {/* Hospital Avatar - Left Side */}
            <View className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200 items-center justify-center overflow-hidden mr-3">
              {profile.logo ? (
                <Image
                  source={{ uri: profile.logo }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <FontAwesome5 name="hospital" size={28} color="#9ca3af" />
              )}
            </View>

            {/* Hospital Name and Summary - Right Side */}
            <View className="flex-1">
              <Text className="text-xl font-extrabold text-gray-900 leading-tight mb-1">{profile.name}</Text>
              
              {/* Hospital Type and Established Year */}
              {profile.type && (
                <View className="flex-row flex-wrap items-center mb-2">
                  <Text className="text-gray-600 text-sm font-semibold">{String(profile.type).replace(/_/g, ' ')}</Text>
                  {profile.establishedYear && (
                    <>
                      <Text className="text-gray-400 mx-2">•</Text>
                      <Text className="text-gray-500 text-sm">Est. {profile.establishedYear}</Text>
                    </>
                  )}
                </View>
              )}

              {/* Verification Badge */}
              {profile.isVerified && (
                <View className="flex-row items-center self-start bg-green-50 px-2 py-0.5 rounded-full border border-green-100 mb-2">
                  <Ionicons name="checkmark-circle" size={12} color="#16a34a" />
                  <Text className="text-green-700 text-[10px] font-bold ml-1 uppercase">Verified</Text>
                </View>
              )}

              {/* Location Display */}
              {locationText && (
                <View className="flex-row items-center mt-1">
                  <Ionicons name="location-outline" size={14} color="#6b7280" />
                  <Text className="text-gray-500 text-sm ml-1 flex-1">{locationText}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Capability Tags - Dynamic Rendering */}
          {(() => {
            const capabilityTags = mapCapabilityTags(profile.facilities);
            return capabilityTags.length > 0 ? (
              <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
                {capabilityTags.map((tag, index) => (
                  <CapabilityChip key={index} label={tag.label} variant={tag.variant} />
                ))}
              </View>
            ) : null;
          })()}

          {/* Website Link */}
          {profile.website && (
            <TouchableOpacity onPress={() => {/* In real app use Linking.openURL */ }} className="mb-4">
              <Text className="text-blue-600 text-sm underline">{profile.website}</Text>
            </TouchableOpacity>
          )}

          {/* Stats Row */}
          <View className="flex-row bg-gray-50 rounded-2xl p-4 border border-gray-100 justify-between">
            <View className="items-center flex-1 border-r border-gray-200">
              <Text className="text-gray-400 text-[10px] font-bold tracking-wider mb-1">RATING</Text>
              <View className="flex-row items-center justify-center">
                <Text className="text-gray-900 text-lg font-black mr-1">
                  {(profile.stats?.rating ?? 0).toFixed(1)}
                </Text>
                <Ionicons name="star" size={14} color="#f59e0b" />
              </View>
            </View>

            <View className="items-center flex-1 border-r border-gray-200">
              <Text className="text-gray-400 text-[10px] font-bold tracking-wider mb-1">JOBS</Text>
              <Text className="text-gray-900 text-lg font-black">{profile.stats?.activeJobs ?? 0}</Text>
            </View>

            <View className="items-center flex-1 border-r border-gray-200 px-1">
              <Text className="text-gray-400 text-[10px] font-bold tracking-wider mb-1 text-center">TEAM</Text>
              <Text className="text-gray-900 text-lg font-black">{profile.stats?.totalEmployees ?? 0}</Text>
            </View>

            <View className="items-center flex-1">
              <Text className="text-gray-400 text-[10px] font-bold tracking-wider mb-1">HIRED</Text>
              <Text className="text-gray-900 text-lg font-black text-green-600">{profile.stats?.totalHires ?? 0}</Text>
            </View>
          </View>
        </View>

        {/* Message / Invitation Section */}
        <View className="bg-white rounded-2xl border border-gray-200 p-5 mb-4 shadow-sm">
          <Text className="text-gray-900 font-bold text-sm mb-4">Connection Status</Text>
          {conversationLoading ? (
            <View className="flex-row items-center justify-center py-2">
              <ActivityIndicator size="small" color="#1e3a8a" />
              <Text className="text-gray-500 text-sm ml-2">Checking messages...</Text>
            </View>
          ) : conversationStatus?.invitationStatus === 'pending' ? (
            // Show invitation card
            <View className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <View className="flex-row items-center mb-3">
                <View className="w-10 h-10 bg-amber-100 rounded-full items-center justify-center mr-3">
                  <Ionicons name="mail" size={20} color="#d97706" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-900 font-bold text-base">Invitation Received</Text>
                  <Text className="text-gray-600 text-sm">
                    {profile.name} wants to connect with you
                  </Text>
                </View>
              </View>

              {conversationStatus?.conversation?.messages?.[0]?.content && (
                <View className="bg-white rounded-lg p-3 mb-3 border border-amber-100">
                  <Text className="text-gray-600 text-sm italic">
                    "{conversationStatus.conversation.messages[0].content}"
                  </Text>
                </View>
              )}

              <View className="flex-row" style={{ gap: 12 }}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  className="flex-1 bg-white border border-gray-300 py-3 rounded-xl items-center"
                  onPress={handleDeclineInvitation}
                  disabled={processingInvitation}
                >
                  {processingInvitation ? (
                    <ActivityIndicator size="small" color="#6b7280" />
                  ) : (
                    <Text className="text-gray-700 font-bold">Decline</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.9}
                  className="flex-1 bg-indigo-900 py-3 rounded-xl items-center"
                  onPress={handleAcceptInvitation}
                  disabled={processingInvitation}
                >
                  {processingInvitation ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="text-white font-bold">Accept & Chat</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : conversationStatus?.canMessage ? (
            // Show message button
            <TouchableOpacity
              activeOpacity={0.9}
              className="bg-indigo-900 py-3 rounded-xl flex-row items-center justify-center"
              onPress={handleOpenChat}
            >
              <Ionicons name="chatbubble" size={18} color="#ffffff" />
              <Text className="text-white font-bold ml-2">Message Hospital</Text>
            </TouchableOpacity>
          ) : (
            // No conversation yet - Allow Doctor to initiate
            <View className="bg-white rounded-xl p-4 items-center">
              <Text className="text-gray-600 text-sm mb-4 text-center">
                Interested in this hospital? Start a conversation to discuss opportunities.
              </Text>

              <TouchableOpacity
                activeOpacity={0.9}
                className="w-full bg-indigo-900 py-3 rounded-xl flex-row items-center justify-center"
                onPress={async () => {
                  if (!profile?.id) return;
                  setProcessingInvitation(true);
                  try {
                    const res = await messageApi.createConversation({
                      participantId: profile.id,
                      jobId: jobId,
                      type: jobId ? 'application' : 'general',
                      initialMessage: jobId
                        ? `Hi, I'm interested in the job posting.`
                        : `Hi, I'd like to connect with your hospital regarding potential opportunities.`
                    });

                    if (res.success) {
                      await fetchConversationStatus();
                      // Automatically open chat? Or just show the message button (which happens on refresh)
                      if (res.data?.conversation) {
                        setShowChat(true);
                      }
                      Alert.alert('Success', 'Message sent successfully!');
                    } else {
                      Alert.alert('Error', res.error || 'Failed to start conversation');
                    }
                  } catch (e: any) {
                    Alert.alert('Error', e.message || 'Failed to connect');
                  } finally {
                    setProcessingInvitation(false);
                  }
                }}
                disabled={processingInvitation}
              >
                {processingInvitation ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={18} color="#ffffff" />
                    <Text className="text-white font-bold ml-2">Send Message & Connect</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* About */}
        {profile.description ? (
          <View className="bg-white rounded-2xl border border-gray-200 p-5 mb-4 shadow-sm">
            <View className="flex-row items-center mb-3">
              <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
                <Ionicons name="information-circle-outline" size={20} color="#1d4ed8" />
              </View>
              <Text className="text-lg font-extrabold text-gray-900">About</Text>
            </View>
            <Text className="text-gray-600 text-sm leading-6" numberOfLines={isAboutExpanded ? undefined : 3}>
              {profile.description}
            </Text>
            {profile.description.length > 150 && (
              <TouchableOpacity
                onPress={() => setIsAboutExpanded(!isAboutExpanded)}
                className="mt-2"
              >
                <Text className="text-indigo-600 font-semibold">
                  {isAboutExpanded ? 'Show Less' : 'Read More'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {/* Representative Details Section */}
        {(() => {
          // Check if there's any representative data to display
          const hasFullName = !!profile.representative?.fullName;
          const hasPhone = !!profile.representative?.phone;
          const hasEmail = !!profile.representative?.email;
          const hasRepresentativeData = hasFullName || hasPhone || hasEmail;
          
          // Only render section if there's data to display
          return hasRepresentativeData ? (
            <ProfileSectionStatic icon="person-circle-outline" title="Representative Details">
              <DetailRow 
                label="Full Name" 
                value={profile.representative?.fullName} 
              />
              <DetailRow 
                label="Contact Number" 
                value={formatPhoneNumber(profile.representative?.phone)} 
              />
              <DetailRow 
                label="Email Address" 
                value={profile.representative?.email} 
              />
            </ProfileSectionStatic>
          ) : null;
        })()}

        {/* Staffing Details Section */}
        {(() => {
          // Check if there's any staffing data to display
          const doctorCount = profile.staffing?.totalDoctors ?? profile.stats?.totalEmployees ?? 0;
          const nurseCount = profile.staffing?.totalNurses ?? 0;
          const hasStaffingData = doctorCount > 0 || nurseCount > 0;
          
          // Only render section if there's data to display
          return hasStaffingData ? (
            <ProfileSectionStatic icon="people-outline" title="Staffing Details">
              <View className="flex-row justify-around pt-3">
                <StaffingCard
                  icon="medical"
                  iconColor="#1e3a8a"
                  iconBg="bg-blue-50"
                  value={String(doctorCount)}
                  label="Doctors"
                />
                <StaffingCard
                  icon="heart"
                  iconColor="#dc2626"
                  iconBg="bg-red-50"
                  value={String(nurseCount)}
                  label="Nurses"
                />
              </View>
            </ProfileSectionStatic>
          ) : null;
        })()}

        {/* Infrastructure Details Section */}
        {(() => {
          // Check if there's any infrastructure data to display
          const infrastructureTags = mapInfrastructureTags(profile.infrastructure);
          const hasPhotos = profile.infrastructure?.photos && profile.infrastructure.photos.length > 0;
          const hasInfrastructureData = infrastructureTags.length > 0 || hasPhotos;
          
          // Only render section if there's data to display
          return hasInfrastructureData ? (
            <ProfileSectionStatic icon="business-outline" title="Infrastructure Details">
              {/* Infrastructure Tags - Dynamic Rendering */}
              {infrastructureTags.length > 0 && (
                <View className="flex-row flex-wrap pt-3" style={{ gap: 12 }}>
                  {infrastructureTags.map((tag, index) => (
                    <InfrastructureTag
                      key={index}
                      label={tag.label}
                      value={tag.value}
                      unit={tag.unit}
                    />
                  ))}
                </View>
              )}

              {/* Facility Gallery - Conditional Display */}
              {hasPhotos && (
                <View className="mt-4">
                  <Text className="text-gray-700 font-semibold text-sm mb-3">Facility Gallery</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 12 }}
                  >
                    {profile.infrastructure!.photos!.map((photo, index) => (
                      <View key={index} className="w-48">
                        <Image
                          source={{ uri: photo.url }}
                          className="w-full h-32 rounded-xl"
                          resizeMode="cover"
                        />
                        {photo.caption && (
                          <Text className="text-gray-600 text-xs mt-2" numberOfLines={2}>
                            {photo.caption}
                          </Text>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
            </ProfileSectionStatic>
          ) : null;
        })()}

        {/* Credentials & Verification Section */}
        {(() => {
          // Check if there's any credentials data to display
          const hasRegistrationNumber = !!(profile.registrationNumber || profile.hospitalLicense?.licenseNumber);
          const hasAccreditation = !!profile.nabhAccreditation?.certificateNumber;
          const hasCredentialsData = hasRegistrationNumber || hasAccreditation;
          
          // Only render section if there's data to display
          return hasCredentialsData ? (
            <ProfileSectionStatic icon="shield-checkmark-outline" title="Credentials & Verification">
              {hasRegistrationNumber && (
                <DetailRow 
                  label="Registration Number" 
                  value={profile.registrationNumber || profile.hospitalLicense?.licenseNumber || 'Not available'} 
                />
              )}
              {hasAccreditation && (
                <DetailRow 
                  label="Accreditation" 
                  value={profile.nabhAccreditation.certificateNumber} 
                />
              )}
            </ProfileSectionStatic>
          ) : null;
        })()}

        {/* Verified Documents Section */}
        {(() => {
          // Filter documents to show only those with URL and verified=true
          const verifiedDocs: Array<{ label: string; verified: boolean; hasDocument: boolean }> = [];
          
          if (profile.credentials?.establishmentLicense?.url && profile.credentials?.establishmentLicense?.isVerified) {
            verifiedDocs.push({
              label: 'Establishment License',
              verified: true,
              hasDocument: true
            });
          }
          
          if (profile.credentials?.fireSafetyNOC?.url && profile.credentials?.fireSafetyNOC?.isVerified) {
            verifiedDocs.push({
              label: 'Fire Safety NOC',
              verified: true,
              hasDocument: true
            });
          }
          
          // Only render section if there are verified documents
          return verifiedDocs.length > 0 ? (
            <ProfileSectionStatic icon="document-text-outline" title="Verified Documents">
              {verifiedDocs.map((doc, index) => (
                <VerifiedDocRow
                  key={index}
                  label={doc.label}
                  verified={doc.verified}
                  hasDocument={doc.hasDocument}
                />
              ))}
            </ProfileSectionStatic>
          ) : null;
        })()}
      </View>
    </ScrollView>
  );
}
