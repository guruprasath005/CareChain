import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useJobApplications, ApplicationStatus } from '@/hooks';
import OfferModal, { OfferFormData } from '../../components/OfferModal';
import ScheduleInterviewModal from '../../components/ScheduleInterviewModal';
import { hospitalApi } from '@/services/api';

type TabKey = 'applicants' | 'invited' | 'shortlisted' | 'rejected' | 'pending';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'applicants', label: 'Applicants' },
  { key: 'invited', label: 'Invited' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'pending', label: 'Pending' },
];

const STATUS_COLORS: { [key: string]: { bg: string; text: string } } = {
  applied: { bg: 'bg-blue-100', text: 'text-blue-700' },
  under_review: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  shortlisted: { bg: 'bg-green-100', text: 'text-green-700' },
  interview_scheduled: { bg: 'bg-purple-100', text: 'text-purple-700' },
  interviewed: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  offer_made: { bg: 'bg-amber-100', text: 'text-amber-700' },
  offer_declined: { bg: 'bg-orange-100', text: 'text-orange-700' },
  hired: { bg: 'bg-green-200', text: 'text-green-800' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700' },
};

export default function JobApplicationsScreen() {
  const router = useRouter();
  const { id: jobId } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>('applicants');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [selectedAppName, setSelectedAppName] = useState<string>('');
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [scheduleInterviewModalVisible, setScheduleInterviewModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sortBy, setSortBy] = useState<string[]>([]);

  const { applications, isLoading, error, refresh, updateStatus, scheduleInterview } = useJobApplications(
    typeof jobId === 'string' ? jobId : ''
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const filteredApplications = applications.filter((app) => {
    // Filter by tab
    let matchesTab = false;
    if (activeTab === 'applicants') matchesTab = ['applied', 'under_review'].includes(app.status);
    else if (activeTab === 'invited') matchesTab = ['interview_scheduled', 'interviewed'].includes(app.status);
    else if (activeTab === 'shortlisted') matchesTab = app.status === 'shortlisted';
    else if (activeTab === 'rejected') matchesTab = ['rejected', 'offer_declined'].includes(app.status);
    else if (activeTab === 'pending') matchesTab = app.status === 'applied';
    
    // Filter by search query
    const matchesSearch = searchQuery.trim() === '' || 
      app.doctor.fullName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesTab && matchesSearch;
  });

  const handleStatusUpdate = async (
    appId: string,
    newStatus: Exclude<ApplicationStatus, 'applied'>
  ) => {
    const result = await updateStatus(appId, newStatus, notes);
    if (result.success) {
      Alert.alert('Success', `Application status updated to ${formatStatus(newStatus)}`);
      setActionModalVisible(false);
      setNotes('');
    } else {
      Alert.alert('Error', result.error || 'Failed to update status');
    }
  };

  const parseScheduleToISO = (dateStr: string, timeStr: string): string => {
    const part = timeStr.split(' - ')[0]?.trim() || timeStr;
    const match = part.match(/(\d+):(\d+)\s*(AM|PM)/i);
    let hours = 12, minutes = 0;
    if (match) {
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      if (match[3].toUpperCase() === 'PM' && hours !== 12) hours += 12;
      if (match[3].toUpperCase() === 'AM' && hours === 12) hours = 0;
    }
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d, hours, minutes, 0, 0);
    return date.toISOString();
  };

  const handleScheduleInterviewFromList = async (data: { date: string; time: string; message: string }) => {
    if (!selectedApp) return;
    setIsSubmitting(true);
    try {
      const scheduledAt = parseScheduleToISO(data.date, data.time);
      const result = await scheduleInterview(selectedApp, {
        scheduledAt,
        type: 'in_person',
        notes: data.message || undefined,
      });
      if (result.success) {
        Alert.alert(
          'Interview Scheduled! 📅',
          `Interview scheduled for ${data.date} at ${data.time}. The candidate will be notified.`,
          [
            {
              text: 'OK',
              onPress: () => {
                setScheduleInterviewModalVisible(false);
                setSelectedApp(null);
                refresh();
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to schedule interview');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to schedule interview');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendOffer = async (offerData: OfferFormData) => {
    if (!selectedApp) {
      Alert.alert('Error', 'No application selected');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await hospitalApi.sendOffer(selectedApp, offerData);
      if (response.success) {
        Alert.alert(
          'Offer Sent! 🎉',
          'The candidate will receive an email and in-app notification with the offer details. When they accept, they will automatically become your employee.',
          [
            {
              text: 'OK',
              onPress: () => {
                setOfferModalVisible(false);
                refresh();
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', response.error || 'Failed to send offer');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send offer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openActionModal = (appId: string, doctorName: string) => {
    setSelectedApp(appId);
    setSelectedAppName(doctorName);
    setActionModalVisible(true);
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  if (isLoading && !refreshing) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#1A1464" />
        <Text className="text-gray-500 mt-2">Loading applications...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header with Tabs */}
      <View 
        style={{ 
          backgroundColor: '#FFFFFF',
          paddingTop: 16,
          paddingBottom: 16,
          paddingHorizontal: 20,
        }}
      >
        {/* Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 20 }}
        >
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                marginRight: 12,
                borderBottomWidth: activeTab === tab.key ? 3 : 0,
                borderBottomColor: '#111827',
              }}
            >
              <Text
                style={{
                  fontFamily: 'DMSans-Bold',
                  fontSize: 16,
                  color: activeTab === tab.key ? '#111827' : '#9CA3AF',
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Search Bar */}
      <View className="px-5 py-4 bg-white">
        <View 
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#F9FAFB',
            borderRadius: 24,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: '#130160',
          }}
        >
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            placeholder="Search Applicants by Name"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{
              flex: 1,
              marginLeft: 12,
              fontFamily: 'DMSans-Regular',
              fontSize: 14,
              color: '#111827',
            }}
            placeholderTextColor="#9CA3AF"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            onPress={() => setSortModalVisible(true)}
            style={{
              marginLeft: 12,
              backgroundColor: '#130160',
              borderRadius: 8,
              padding: 8,
            }}
          >
            <Ionicons name="filter" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Applications List */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {error ? (
          <View className="py-8 items-center">
            <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
            <Text className="text-gray-500 mt-2">{error}</Text>
            <TouchableOpacity className="mt-4 bg-blue-600 px-4 py-2 rounded-lg" onPress={onRefresh}>
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filteredApplications.length === 0 ? (
          <View className="py-8 items-center">
            <Ionicons name="documents-outline" size={48} color="#9CA3AF" />
            <Text className="text-gray-500 mt-2">No applications found</Text>
          </View>
        ) : (
          filteredApplications.map((app) => {
            const colors = STATUS_COLORS[app.status] || STATUS_COLORS.applied;
            return (
              <View
                key={app.id}
                className="bg-white rounded-2xl p-4 mb-4"
                style={{
                  shadowColor: '#000',
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 2,
                }}
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-row items-center flex-1">
                    <View 
                      style={{
                        height: 56,
                        width: 56,
                        borderRadius: 28,
                        backgroundColor: '#E5E7EB',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {app.doctor.avatar ? (
                        <Ionicons name="person" size={28} color="#6B7280" />
                      ) : (
                        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#6B7280', fontFamily: 'DMSans-Bold' }}>
                          {app.doctor.fullName?.charAt(0) || 'D'}
                        </Text>
                      )}
                    </View>
                    <View className="flex-1 ml-3">
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111827', fontFamily: 'DMSans-Bold' }}>
                        Dr. {app.doctor.fullName}
                      </Text>
                      <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 2, fontFamily: 'DMSans-Regular' }}>
                        {app.doctor.specialization || 'Medical Professional'}
                      </Text>
                      <View className="flex-row items-center mt-2">
                        {app.doctor.location && (
                          <View className="flex-row items-center mr-3">
                            <Ionicons name="location-outline" size={14} color="#9CA3AF" />
                            <Text style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 4, fontFamily: 'DMSans-Regular' }}>
                              {app.doctor.location}
                            </Text>
                          </View>
                        )}
                        {app.doctor.experience && (
                          <View className="flex-row items-center">
                            <Ionicons name="briefcase-outline" size={14} color="#9CA3AF" />
                            <Text style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 4, fontFamily: 'DMSans-Regular' }}>
                              {app.doctor.experience}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  <View className="flex-row items-center">
                    <View 
                      style={{ 
                        backgroundColor: 'rgba(55, 255, 0, 0.55)',
                        borderRadius: 9999,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        shadowColor: '#000',
                        shadowOpacity: 0.2,
                        shadowRadius: 8,
                        shadowOffset: { width: 0, height: 4 },
                        elevation: 4,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#000000', fontFamily: 'DMSans-Bold' }}>
                        Applied
                      </Text>
                    </View>
                    <TouchableOpacity className="ml-2">
                      <Ionicons name="ellipsis-vertical" size={20} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Action Buttons */}
                <View className="flex-row mt-4">
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: '#130160',
                      borderRadius: 12,
                      paddingVertical: 12,
                      alignItems: 'center',
                    }}
                    onPress={() => openActionModal(app.id, app.doctor.fullName || 'Candidate')}
                  >
                    <Text style={{ color: '#130160', fontWeight: '600', fontFamily: 'DMSans-SemiBold' }}>Actions</Text>
                  </TouchableOpacity>

                  <View className="w-3" />

                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: '#130160',
                      borderRadius: 12,
                      paddingVertical: 12,
                      alignItems: 'center',
                    }}
                    onPress={() =>
                      router.push({
                        pathname: '/(hospital)/candidateDetails/[id]',
                        params: { 
                          id: app.doctorId,
                          applicationId: app.id,
                          jobId: jobId,
                          mode: 'application',
                        },
                      })
                    }
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '600', fontFamily: 'DMSans-SemiBold' }}>View Profile</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Action Modal */}
      <Modal
        visible={actionModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setActionModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-gray-900">Update Status</Text>
              <TouchableOpacity onPress={() => setActionModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="Add notes (optional)"
              value={notes}
              onChangeText={setNotes}
              className="border border-gray-200 rounded-xl px-4 py-3 mb-4"
              multiline
              numberOfLines={2}
            />

            <TouchableOpacity
              className="bg-blue-100 rounded-xl py-4 mb-3"
              onPress={() => selectedApp && handleStatusUpdate(selectedApp, 'shortlisted')}
            >
              <Text className="text-blue-900 font-semibold text-center">Shortlist</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-purple-100 rounded-xl py-4 mb-3"
              onPress={() => {
                setActionModalVisible(false);
                setScheduleInterviewModalVisible(true);
              }}
            >
              <Text className="text-purple-900 font-semibold text-center">Schedule Interview</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-green-100 rounded-xl py-4 mb-3"
              onPress={() => {
                setActionModalVisible(false);
                setOfferModalVisible(true);
              }}
            >
              <Text className="text-green-900 font-semibold text-center">Make Offer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-red-100 rounded-xl py-4"
              onPress={() => selectedApp && handleStatusUpdate(selectedApp, 'rejected')}
            >
              <Text className="text-red-900 font-semibold text-center">Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Offer Modal */}
      <OfferModal
        visible={offerModalVisible}
        onClose={() => setOfferModalVisible(false)}
        onSubmit={handleSendOffer}
        candidateName={selectedAppName}
        jobTitle="Position"
        isSubmitting={isSubmitting}
      />

      {/* Schedule Interview Modal */}
      <ScheduleInterviewModal
        visible={scheduleInterviewModalVisible}
        onClose={() => {
          setScheduleInterviewModalVisible(false);
          setSelectedApp(null);
        }}
        onSubmit={handleScheduleInterviewFromList}
        candidateName={selectedAppName}
        jobTitle="Position"
        isSubmitting={isSubmitting}
      />

      {/* Sort Modal */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View 
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 16,
              paddingBottom: 32,
              paddingHorizontal: 20,
            }}
          >
            {/* Handle Bar */}
            <View 
              style={{
                width: 40,
                height: 4,
                backgroundColor: '#D1D5DB',
                borderRadius: 2,
                alignSelf: 'center',
                marginBottom: 20,
              }}
            />

            <View className="flex-row items-center justify-between mb-6">
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#111827', fontFamily: 'DMSans-Bold' }}>
                Sort By
              </Text>
              <TouchableOpacity onPress={() => setSortModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Sort Options */}
            <TouchableOpacity
              onPress={() => {
                if (sortBy.includes('experience')) {
                  setSortBy(sortBy.filter(s => s !== 'experience'));
                } else {
                  setSortBy([...sortBy, 'experience']);
                }
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderRadius: 16,
                borderWidth: 2,
                borderColor: sortBy.includes('experience') ? '#130160' : '#E5E7EB',
                backgroundColor: sortBy.includes('experience') ? '#F0F0FF' : '#FFFFFF',
                marginBottom: 12,
              }}
            >
              <View 
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: sortBy.includes('experience') ? '#E0E7FF' : '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 16,
                }}
              >
                <Ionicons name="briefcase-outline" size={24} color={sortBy.includes('experience') ? '#130160' : '#6B7280'} />
              </View>
              <View className="flex-1">
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#130160', fontFamily: 'DMSans-Bold' }}>
                  Experience
                </Text>
                <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 2, fontFamily: 'DMSans-Regular' }}>
                  Newest First
                </Text>
              </View>
              <View 
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  borderWidth: 2,
                  borderColor: sortBy.includes('experience') ? '#130160' : '#D1D5DB',
                  backgroundColor: sortBy.includes('experience') ? '#130160' : '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {sortBy.includes('experience') && (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (sortBy.includes('date')) {
                  setSortBy(sortBy.filter(s => s !== 'date'));
                } else {
                  setSortBy([...sortBy, 'date']);
                }
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderRadius: 16,
                borderWidth: 2,
                borderColor: sortBy.includes('date') ? '#130160' : '#E5E7EB',
                backgroundColor: sortBy.includes('date') ? '#F0F0FF' : '#FFFFFF',
                marginBottom: 12,
              }}
            >
              <View 
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: sortBy.includes('date') ? '#E0E7FF' : '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 16,
                }}
              >
                <Ionicons name="time-outline" size={24} color={sortBy.includes('date') ? '#130160' : '#6B7280'} />
              </View>
              <View className="flex-1">
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#130160', fontFamily: 'DMSans-Bold' }}>
                  Date of Application
                </Text>
                <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 2, fontFamily: 'DMSans-Regular' }}>
                  Oldest First
                </Text>
              </View>
              <View 
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  borderWidth: 2,
                  borderColor: sortBy.includes('date') ? '#130160' : '#D1D5DB',
                  backgroundColor: sortBy.includes('date') ? '#130160' : '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {sortBy.includes('date') && (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (sortBy.includes('distance')) {
                  setSortBy(sortBy.filter(s => s !== 'distance'));
                } else {
                  setSortBy([...sortBy, 'distance']);
                }
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderRadius: 16,
                borderWidth: 2,
                borderColor: sortBy.includes('distance') ? '#130160' : '#E5E7EB',
                backgroundColor: sortBy.includes('distance') ? '#F0F0FF' : '#FFFFFF',
                marginBottom: 24,
              }}
            >
              <View 
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: sortBy.includes('distance') ? '#E0E7FF' : '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 16,
                }}
              >
                <Ionicons name="location-outline" size={24} color={sortBy.includes('distance') ? '#130160' : '#6B7280'} />
              </View>
              <View className="flex-1">
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#130160', fontFamily: 'DMSans-Bold' }}>
                  Distance from Hospital
                </Text>
                <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 2, fontFamily: 'DMSans-Regular' }}>
                  5KM,10KM and etc..
                </Text>
              </View>
              <View 
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  borderWidth: 2,
                  borderColor: sortBy.includes('distance') ? '#130160' : '#D1D5DB',
                  backgroundColor: sortBy.includes('distance') ? '#130160' : '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {sortBy.includes('distance') && (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                )}
              </View>
            </TouchableOpacity>

            {/* Action Buttons */}
            <View className="flex-row">
              <TouchableOpacity
                onPress={() => {
                  setSortBy([]);
                  setSortModalVisible(false);
                }}
                style={{
                  flex: 1,
                  borderWidth: 2,
                  borderColor: '#130160',
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: 'center',
                  marginRight: 12,
                }}
              >
                <Text style={{ color: '#130160', fontWeight: 'bold', fontSize: 16, fontFamily: 'DMSans-Bold' }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  // Apply sorting logic here
                  setSortModalVisible(false);
                }}
                style={{
                  flex: 1,
                  backgroundColor: '#130160',
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16, fontFamily: 'DMSans-Bold' }}>
                  Apply
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
