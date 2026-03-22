import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { ScrollView, Text, TouchableOpacity, View, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Feather,
  FontAwesome,
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from '@expo/vector-icons';
import { useJobDetails, useJobApplication, useApplications, Job } from '../../../hooks';
import { usePendingInvitations } from '../../../hooks/useMessages';
import { useAuth } from '../../../contexts/AuthContext';
import api, { messageApi } from '../../../services/api';
import ChatScreen from '../../_components/ChatScreen';
import EmployerBottomSheet from '../_components/EmployerBottomSheet';
import { Colors } from '../../../constants/Colors';

type HospitalPublicProfile = {
  id: string;
  name: string;
  type?: string | null;
  description?: string | null;
  website?: string | null;
  logo?: string | null;
  coverPhoto?: string | null;
  location?: {
    city?: string | null;
    state?: string | null;
    fullAddress?: string | null;
  };
  specialties?: string[];
  departments?: string[];
  facilities?: {
    emergency24x7?: boolean;
    icuFacilities?: boolean;
    diagnosticLab?: boolean;
    pharmacy?: boolean;
    ambulanceService?: boolean;
    bloodBank?: boolean;
    parking?: boolean;
    canteen?: boolean;
  };
  stats?: {
    rating?: number;
    totalEmployees?: number;
    activeJobs?: number;
  };
  isVerified?: boolean;
  isOpen24Hours?: boolean;
};

type ConversationStatus = {
  exists: boolean;
  conversation?: any;
  invitationStatus?: 'pending' | 'accepted' | 'declined';
  canMessage: boolean;
};

// Star Rating Component
function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <View className="flex-row items-center">
      {[...Array(fullStars)].map((_, i) => (
        <Ionicons key={`full-${i}`} name="star" size={size} color="#f59e0b" />
      ))}
      {hasHalfStar && <Ionicons name="star-half" size={size} color="#f59e0b" />}
      {[...Array(emptyStars)].map((_, i) => (
        <Ionicons key={`empty-${i}`} name="star-outline" size={size} color="#f59e0b" />
      ))}
    </View>
  );
}

// Route Screen Component
export default function JobDetailsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const { job, isLoading, error, refresh } = useJobDetails(id || '');
  const { apply, withdraw, isLoading: isApplying } = useJobApplication();
  const { applications, refresh: refreshApplications } = useApplications();
  const { acceptInvitation, declineInvitation } = usePendingInvitations();

  const [hospitalProfile, setHospitalProfile] = useState<HospitalPublicProfile | null>(null);
  const [hospitalLoading, setHospitalLoading] = useState(false);
  const [conversationStatus, setConversationStatus] = useState<ConversationStatus | null>(null);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [processingInvitation, setProcessingInvitation] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showEmployerBottomSheet, setShowEmployerBottomSheet] = useState(false);

  // Fetch hospital profile
  const fetchHospitalProfile = useCallback(async () => {
    if (!job?.hospitalId) return;
    setHospitalLoading(true);
    try {
      const res = await api.search.getHospitalPublicProfile(job.hospitalId);
      if (res.success && res.data) {
        setHospitalProfile(res.data as HospitalPublicProfile);
      }
    } catch (e) {
      console.error('Failed to fetch hospital profile:', e);
    } finally {
      setHospitalLoading(false);
    }
  }, [job?.hospitalId]);

  // Fetch conversation status
  const fetchConversationStatus = useCallback(async () => {
    if (!job?.hospitalId) return;
    setConversationLoading(true);
    try {
      const res = await messageApi.getConversationWithHospital(job.hospitalId, job.id);
      if (res.success && res.data) {
        setConversationStatus(res.data as ConversationStatus);
      }
    } catch (e) {
      console.error('Failed to fetch conversation status:', e);
    } finally {
      setConversationLoading(false);
    }
  }, [job?.hospitalId, job?.id]);

  useEffect(() => {
    if (job?.hospitalId) {
      fetchHospitalProfile();
      fetchConversationStatus();
    }
  }, [job?.hospitalId, fetchHospitalProfile, fetchConversationStatus]);

  // Find the application for this job
  const applicationForJob = useMemo(() => {
    return applications.find(app => app.jobId === id);
  }, [applications, id]);

  // Determine button state based on application status
  const buttonState = useMemo(() => {
    if (!applicationForJob) return { text: 'Apply', action: 'apply', disabled: false };

    switch (applicationForJob.status) {
      case 'applied':
      case 'under_review':
      case 'shortlisted':
      case 'interview_scheduled':
      case 'interviewed':
      case 'offer_made':
        return { text: 'Withdraw', action: 'withdraw', disabled: false };
      case 'hired':
        return { text: 'Leave', action: 'leave', disabled: false };
      case 'rejected':
      case 'withdrawn':
        return { text: 'Apply', action: 'apply', disabled: false };
      default:
        return { text: 'Apply', action: 'apply', disabled: false };
    }
  }, [applicationForJob]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), fetchHospitalProfile(), fetchConversationStatus()]);
    refreshApplications();
    setRefreshing(false);
  };

  const handleAction = async () => {
    if (!job) return;

    const { action } = buttonState;

    if (action === 'apply') {
      Alert.alert(
        'Apply for Job',
        `Are you sure you want to apply for "${job.title}" at ${job.hospital}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Apply',
            onPress: async () => {
              const result = await apply(job.id);
              if (result.success) {
                Alert.alert('Success', 'Your application has been submitted!');
                refresh();
                refreshApplications();
              } else {
                Alert.alert('Error', result.error || 'Failed to apply');
              }
            }
          },
        ]
      );
    } else if (action === 'withdraw') {
      Alert.alert(
        'Withdraw Application',
        `Are you sure you want to withdraw your application for "${job.title}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Withdraw',
            style: 'destructive',
            onPress: async () => {
              const result = await withdraw(job.id);
              if (result.success) {
                Alert.alert('Success', 'Your application has been withdrawn!');
                refresh();
                refreshApplications();
              } else {
                Alert.alert('Error', result.error || 'Failed to withdraw');
              }
            }
          },
        ]
      );
    } else if (action === 'leave') {
      Alert.alert(
        'Request Leave',
        `Are you sure you want to request leave from "${job.title}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Request Leave',
            style: 'destructive',
            onPress: () => {
              Alert.alert('Info', 'Leave request functionality will be available soon.');
            }
          },
        ]
      );
    }
  };

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

  // Hospital facilities list
  const hospitalFacilitiesList = useMemo(() => {
    const f = hospitalProfile?.facilities;
    if (!f) return [];
    const items: Array<{ key: string; label: string; enabled: boolean | undefined }> = [
      { key: 'emergency24x7', label: '24x7 Emergency', enabled: f.emergency24x7 },
      { key: 'icuFacilities', label: 'ICU', enabled: f.icuFacilities },
      { key: 'diagnosticLab', label: 'Diagnostic Lab', enabled: f.diagnosticLab },
      { key: 'pharmacy', label: 'Pharmacy', enabled: f.pharmacy },
      { key: 'ambulanceService', label: 'Ambulance', enabled: f.ambulanceService },
      { key: 'bloodBank', label: 'Blood Bank', enabled: f.bloodBank },
      { key: 'parking', label: 'Parking', enabled: f.parking },
      { key: 'canteen', label: 'Canteen', enabled: f.canteen },
    ];
    return items.filter((x) => x.enabled);
  }, [hospitalProfile]);

  const locationText = useMemo(() => {
    if (!hospitalProfile?.location) return job?.location || null;
    const city = hospitalProfile.location.city?.trim();
    const state = hospitalProfile.location.state?.trim();
    const full = hospitalProfile.location.fullAddress?.trim();
    return full || [city, state].filter(Boolean).join(', ') || job?.location;
  }, [hospitalProfile, job?.location]);

  // Show chat screen
  if (showChat && conversationStatus?.conversation) {
    const hospitalName = hospitalProfile?.name || job?.hospital || 'Hospital';
    return (
      <ChatScreen
        conversationId={conversationStatus.conversation.id}
        participant={{
          id: job?.hospitalId || '',
          name: hospitalName,
          avatar: hospitalProfile?.logo || null,
          subtitle: 'Hospital',
        }}
        onBack={() => {
          setShowChat(false);
          fetchConversationStatus();
        }}
        currentUserId={user?.id || ''}
        currentUserRole="doctor"
        applicationStatus={applicationForJob?.status || null}
      />
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#1A1464" />
        <Text className="text-gray-500 mt-2">Loading job details...</Text>
      </View>
    );
  }

  if (error || !job) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-lg font-semibold text-gray-800 mb-2">
          {error || 'Job not found'}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-indigo-900 px-4 py-2 rounded-lg"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <View className="px-4 pt-4">
        {/* Back Button */}
        <TouchableOpacity activeOpacity={0.8} className="mb-3" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>

        {/* Main Job Card */}
        <View className="bg-white rounded-2xl border border-gray-200 p-5 mb-4 shadow-sm">
          {/* Views in top right corner */}
          <View className="absolute top-5 right-5 flex-row items-center">
            <Ionicons name="eye-outline" size={16} color="#6b7280" />
            <Text className="text-gray-500 text-sm ml-1">{job.views} Views</Text>
          </View>

          {/* Job Title */}
          <Text className="text-2xl font-extrabold text-gray-900 mb-2 pr-24">{job.title}</Text>
          
          {/* Specialization */}
          <Text className="text-blue-700 text-sm font-semibold mb-4">
            Specialization: {job.specialization}
          </Text>

          {/* Date Posted and Applicants Row */}
          <View className="flex-row flex-wrap mb-4" style={{ gap: 14 }}>
            <View className="flex-row items-center">
              <Ionicons name="calendar-outline" size={16} color="#6b7280" />
              <Text className="text-gray-500 text-sm ml-2">{job.dates}</Text>
            </View>

            <View className="flex-row items-center">
              <Ionicons name="people-outline" size={16} color="#6b7280" />
              <Text className="text-gray-500 text-sm ml-2">{job.applicants} applicants</Text>
            </View>
          </View>

          {/* Salary and Location Row */}
          <View className="flex-row flex-wrap mb-4" style={{ gap: 14 }}>
            <View className="flex-row items-center">
              <FontAwesome name="rupee" size={16} color="#6b7280" />
              <Text className="text-gray-500 text-sm ml-2">{job.salary}</Text>
            </View>

            <View className="flex-row items-center">
              <Ionicons name="location-outline" size={16} color="#6b7280" />
              <Text className="text-gray-500 text-sm ml-2">{job.location}</Text>
            </View>
          </View>
        </View>

        {/* Work Schedule Section */}
        <View className="bg-white rounded-2xl border border-gray-200 p-5 mb-4 shadow-sm">
          <Text className="text-gray-500 text-xs font-extrabold mb-4 tracking-wider">WORK SCHEDULE</Text>

          <View className="flex-row" style={{ gap: 24 }}>
            <View className="flex-1">
              <Text className="text-gray-600 text-sm mb-2">Shift Time</Text>
              <Text className="text-gray-900 text-lg font-extrabold">{job.shiftTime}</Text>
            </View>

            <View className="flex-1">
              <Text className="text-gray-600 text-sm mb-2">Shift Type</Text>
              <View className="flex-row items-center">
                <Ionicons name="sunny-outline" size={18} color="#f59e0b" />
                <Text className="text-gray-900 text-lg font-extrabold ml-2">{job.shiftType}</Text>
              </View>
            </View>
          </View>
        </View>



        {/* Job Overview */}
        <View className="bg-white rounded-2xl border border-gray-200 p-5 mb-4 shadow-sm">
          <View className="flex-row items-center mb-3">
            <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
              <Ionicons name="document-text-outline" size={20} color="#1d4ed8" />
            </View>
            <Text className="text-lg font-extrabold text-gray-900">Job Description</Text>
          </View>

          <Text className="text-gray-500 text-sm leading-6 mb-2" numberOfLines={isExpanded ? undefined : 3}>
            {job.description}
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            className="flex-row items-center self-start p-1"
            onPress={() => setIsExpanded(!isExpanded)}
          >
            <Text className="text-gray-900 text-sm font-semibold">
              {isExpanded ? 'Read Less' : 'Read More'}
            </Text>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="#111827"
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>

          {/* Visit Employer Profile Button */}
          <TouchableOpacity
            activeOpacity={0.7}
            className="mt-4 bg-indigo-900 py-3 rounded-xl items-center"
            onPress={() => setShowEmployerBottomSheet(true)}
          >
            <Text className="text-white text-sm font-bold">
              Visit Employer Profile
            </Text>
          </TouchableOpacity>
        </View>

        {/* Mandatory Qualifications */}
        <View className="bg-white rounded-2xl border border-gray-200 p-5 mb-4 shadow-sm">
          <View className="flex-row items-center mb-4">
            <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
              <Ionicons name="sparkles-outline" size={20} color="#1d4ed8" />
            </View>
            <Text className="text-lg font-extrabold text-gray-900">Mandatory Qualifications</Text>
          </View>

          {job.qualifications.map((qual: string, index: number) => (
            <View
              key={index}
              className={`flex-row items-start py-3 ${index === job.qualifications.length - 1 ? '' : 'border-b border-gray-100'}`}
            >
              <Ionicons
                name="checkmark-circle"
                size={20}
                color="#1e3a8a"
                style={{ marginRight: 12, marginTop: 2 }}
              />
              <Text className="text-gray-600 text-sm flex-1">{qual}</Text>
            </View>
          ))}
        </View>

        {/* Job Criteria */}
        <View className="bg-white rounded-2xl border border-gray-200 p-5 mb-4 shadow-sm">
          <View className="flex-row items-center mb-4">
            <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
              <FontAwesome name="briefcase" size={20} color="#1d4ed8" />
            </View>
            <Text className="text-lg font-extrabold text-gray-900">Job Criteria</Text>
          </View>

          <View className="flex-row" style={{ gap: 14 }}>
            {/* Years Required - Left Half */}
            <View className="flex-1 bg-white rounded-2xl border border-gray-200 p-6 items-center">
              <View className="w-14 h-14 bg-blue-100 rounded-full items-center justify-center mb-3">
                <Feather name="briefcase" size={26} color="#1d4ed8" />
              </View>
              <Text style={{ fontSize: 48, fontWeight: '800', color: Colors.ui.textSecondary }}>
                {typeof job.minimumExperience === 'number' ? `${job.minimumExperience}+` : 'Open'}
              </Text>
              <Text style={{ color: Colors.ui.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 8 }}>YEARS</Text>
              <Text style={{ color: Colors.ui.textSecondary, fontSize: 12, fontWeight: '600' }}>REQUIRED</Text>
            </View>

            {/* Required Skills - Right Half */}
            <View className="flex-1 bg-white rounded-2xl border border-gray-200 p-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-gray-600 text-xs font-extrabold">REQUIRED SKILLS</Text>
              </View>

              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {job.skills.slice(0, 6).map((skill: string, index: number) => (
                  <View
                    key={`${skill}-${index}`}
                    className="bg-blue-100 border border-blue-200 px-3 py-2 rounded-full flex-row items-center"
                  >
                    <Ionicons name="checkmark-circle" size={14} color="#1e3a8a" />
                    <Text className="text-indigo-900 text-xs font-semibold ml-2">{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Job Facilities */}
        <View className="bg-white rounded-2xl border border-gray-200 p-5 mb-5 shadow-sm">
          <View className="flex-row items-center mb-4">
            <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
              <Ionicons name="star-outline" size={20} color="#1d4ed8" />
            </View>
            <Text className="text-lg font-extrabold text-gray-900">Facilities</Text>
          </View>

          <View className="flex-row justify-around">
            <View className="items-center">
              <View className={`w-14 h-14 rounded-full items-center justify-center mb-2 ${job.facilities?.meals ? 'bg-green-100' : 'bg-red-100'}`}>
                <MaterialCommunityIcons name="silverware-fork-knife" size={24} color={job.facilities?.meals ? '#16a34a' : '#ef4444'} />
              </View>
              <Text className="text-gray-500 text-xs font-semibold">Meals</Text>
            </View>

            <View className="items-center">
              <View className={`w-14 h-14 rounded-full items-center justify-center mb-2 ${job.facilities?.transport ? 'bg-green-100' : 'bg-red-100'}`}>
                <FontAwesome5 name="bus" size={22} color={job.facilities?.transport ? '#16a34a' : '#ef4444'} />
              </View>
              <Text className="text-gray-500 text-xs font-semibold">Transport</Text>
            </View>

            <View className="items-center">
              <View className={`w-14 h-14 rounded-full items-center justify-center mb-2 ${job.facilities?.accommodation ? 'bg-green-100' : 'bg-red-100'}`}>
                <FontAwesome5 name="bed" size={22} color={job.facilities?.accommodation ? '#16a34a' : '#ef4444'} />
              </View>
              <Text className="text-gray-500 text-xs font-semibold">Stay</Text>
            </View>

            <View className="items-center">
              <View className={`w-14 h-14 rounded-full items-center justify-center mb-2 ${job.facilities?.insurance ? 'bg-green-100' : 'bg-red-100'}`}>
                <MaterialCommunityIcons name="medical-bag" size={24} color={job.facilities?.insurance ? '#16a34a' : '#ef4444'} />
              </View>
              <Text className="text-gray-500 text-xs font-semibold">Insurance</Text>
            </View>
          </View>
        </View>

        {/* Apply Button */}
        <TouchableOpacity
          activeOpacity={0.9}
          className={`w-full py-4 rounded-2xl items-center shadow-sm ${buttonState.disabled ? 'bg-gray-400' : 'bg-indigo-900'}`}
          onPress={handleAction}
          disabled={isApplying || buttonState.disabled}
        >
          {isApplying ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-white text-lg font-extrabold">
              {buttonState.text}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Employer Bottom Sheet */}
      <EmployerBottomSheet
        visible={showEmployerBottomSheet}
        onClose={() => setShowEmployerBottomSheet(false)}
        onViewFullProfile={() => {
          setShowEmployerBottomSheet(false);
          router.push({
            pathname: '/(doctor)/(tabs)/hospitalProfile',
            params: { id: job.hospitalId, jobId: job.id }
          });
        }}
        hospitalProfile={hospitalProfile}
        isLoading={hospitalLoading}
        jobId={job.id}
      />
    </ScrollView >
  );
}
