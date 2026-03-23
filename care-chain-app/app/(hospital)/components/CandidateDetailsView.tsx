import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  useWindowDimensions,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Linking,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CandidateDetails } from '@/hooks/useHospital';
import { hospitalApi, messageApi } from '@/services/api';
import { getFullImageUrl } from '@/utils/upload';
import OfferModal, { OfferFormData } from './OfferModal';
import ScheduleInterviewModal from './ScheduleInterviewModal';

type Props = {
  details: CandidateDetails;
  onClose?: () => void;
  applicationId?: string;
  jobId?: string;
  mode?: 'search' | 'application';
  initialAction?: 'invite';
};

type ExperienceTab = 'off' | 'on';

function Chip({ label }: { label: string }) {
  return (
    <View className="bg-gray-100 rounded-xl px-4 py-3 mr-3 mb-3">
      <Text className="text-gray-500 font-semibold">{label}</Text>
    </View>
  );
}

export default function CandidateDetailsView({
  details,
  onClose,
  mode = 'search',
  applicationId,
  jobId,
  initialAction,
}: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isNarrow = width < 360;

  const [activeTab, setActiveTab] = useState<'overview' | 'experience' | 'reviews'>('overview');
  const [experienceTab, setExperienceTab] = useState<ExperienceTab>('on');
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [scheduleInterviewModalVisible, setScheduleInterviewModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-open invite modal if requested
  useEffect(() => {
    if (initialAction === 'invite') {
      setInviteModalVisible(true);
    }
  }, [initialAction]);

  const showApplicationActions = mode === 'application' && Boolean(applicationId);

  const visibleSkills = useMemo(() => {
    const maxBase = 4;
    const base = details.skills.slice(0, maxBase);
    const remaining = Math.max(details.skills.length - maxBase, 0);
    if (remaining <= 0) return base;
    return [...base, `+${remaining} more`];
  }, [details.skills]);

  const handleInvite = async () => {
    if (!details.id) {
      Alert.alert('Error', 'Doctor ID not available');
      return;
    }

    setIsSubmitting(true);
    try {
      let response;
      const message = inviteMessage || `Hi ${details.name}, we would like to invite you to discuss a potential opportunity at our hospital.`;

      if (jobId) {
        // Send official job invitation
        response = await messageApi.sendInvitation(
          details.id,
          jobId,
          message
        );
      } else {
        // Start general conversation
        const convResponse = await messageApi.createConversation({
          participantId: details.id,
          type: 'general',
          initialMessage: message,
        });

        if (convResponse.success && convResponse.data?.conversation) {
          response = {
            success: true,
            data: convResponse.data
          };
        } else {
          throw new Error('Failed to create conversation');
        }
      }

      if (response.success && response.data?.conversation) {
        Alert.alert(
          'Invitation Sent!',
          'A conversation has been started with this candidate.',
          [
            {
              text: 'View Messages',
              onPress: () => {
                setInviteModalVisible(false);
                router.push('/(hospital)/messages');
              },
            },
            {
              text: 'OK',
              onPress: () => setInviteModalVisible(false),
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to send invitation');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (status: 'shortlisted' | 'interview_scheduled' | 'rejected') => {
    if (!applicationId) {
      Alert.alert('Error', 'No application ID available. Please access this from the applications list.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await hospitalApi.updateApplicationStatus(applicationId, status);
      if (response.success) {
        Alert.alert('Success', `Candidate status updated: ${status.replace(/_/g, ' ')}`);
        onClose?.();
      } else {
        Alert.alert('Error', 'Failed to update status');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendOffer = async (offerData: OfferFormData) => {
    if (!applicationId) {
      Alert.alert('Error', 'No application ID available. Please access this from the applications list.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await hospitalApi.sendOffer(applicationId, offerData);
      if (response.success) {
        Alert.alert(
          'Offer Sent! 🎉',
          'The candidate will receive an email and in-app notification with the offer details.',
          [
            {
              text: 'OK',
              onPress: () => {
                setOfferModalVisible(false);
                onClose?.();
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

  const handleScheduleInterview = async (data: { date: string; time: string; message: string }) => {
    setIsSubmitting(true);
    try {
      if (showApplicationActions && applicationId) {
        const scheduledAt = parseScheduleToISO(data.date, data.time);
        const response = await hospitalApi.scheduleInterview(applicationId, {
          scheduledAt,
          type: 'in_person',
          notes: data.message || undefined,
        });
        if (response.success) {
          Alert.alert(
            'Interview Scheduled! 📅',
            `Interview scheduled for ${data.date} at ${data.time}. The candidate will be notified.`,
            [
              {
                text: 'OK',
                onPress: () => {
                  setScheduleInterviewModalVisible(false);
                  onClose?.();
                },
              },
            ]
          );
        } else {
          Alert.alert('Error', 'Failed to schedule interview');
        }
      } else {
        Alert.alert(
          'Interview Request',
          'This action is only available for applicants. Please invite this candidate first.',
        );
        setScheduleInterviewModalVisible(false);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to schedule interview');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" contentContainerClassName="pb-10">
        {/* ===== Top Header ===== */}
        <View 
          style={{
            backgroundColor: '#130160',
            paddingTop: 48,
            paddingBottom: 40,
            paddingHorizontal: 20,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onClose}
            style={{
              height: 40,
              width: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={20} color="#ffffff" />
          </TouchableOpacity>

          <View className="items-center mt-6">
            <View 
              style={{
                height: 96,
                width: 96,
                borderRadius: 48,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                borderWidth: 3,
                borderColor: 'rgba(255, 255, 255, 0.3)',
              }}
            >
              {details.avatar ? (
                <Image
                  source={{ uri: getFullImageUrl(details.avatar) }}
                  className="h-full w-full"
                  resizeMode="cover"
                />
              ) : (
                <Ionicons name="person" size={54} color="#ffffff" />
              )}
            </View>
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginTop: 16, fontFamily: 'DMSans-Bold' }}>
              {details.name}
            </Text>
            <Text style={{ color: '#FFFFFF', fontSize: 14, marginTop: 4, fontFamily: 'DMSans-Regular' }}>
              {details.role}
            </Text>
          </View>
        </View>

        {/* ===== Content ===== */}
        <View className="px-5 mt-5">
          {/* Profile Overview */}
          <View className="bg-white rounded-2xl p-5 mb-4">
            <View className="flex-row items-center mb-3">
              <Ionicons name="person-outline" size={20} color="#130160" />
              <Text style={{ color: '#130160', fontWeight: 'bold', marginLeft: 12, fontSize: 16, fontFamily: 'DMSans-Bold' }}>
                Profile Overview
              </Text>
            </View>
            <Text style={{ color: '#6B7280', lineHeight: 22, fontFamily: 'DMSans-Regular' }}>
              {details.overview}
            </Text>
          </View>

          {/* Education & Training */}
          <View className="bg-white rounded-2xl p-5 mb-4">
            <View className="flex-row items-center mb-4">
              <Ionicons name="school-outline" size={20} color="#130160" />
              <Text style={{ color: '#130160', fontWeight: 'bold', marginLeft: 12, fontSize: 16, fontFamily: 'DMSans-Bold' }}>
                Education & Training
              </Text>
            </View>

            <View>
              {details.education.map((e, idx) => (
                <View key={`${e.institution}-${idx}`} className="mb-4 pb-4 border-b border-gray-100">
                  <Text style={{ color: '#111827', fontWeight: 'bold', fontSize: 15, fontFamily: 'DMSans-Bold' }}>
                    {e.institution}
                  </Text>
                  <Text style={{ color: '#6B7280', marginTop: 4, fontSize: 13, fontFamily: 'DMSans-Regular' }}>
                    {e.program}
                  </Text>
                  <Text style={{ color: '#9CA3AF', marginTop: 2, fontSize: 12, fontFamily: 'DMSans-Regular' }}>
                    {e.years}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* License */}
          <View className="bg-white rounded-2xl p-5 mb-4">
            <View className="flex-row items-center justify-between mb-4">
              <Text style={{ color: '#111827', fontWeight: 'bold', fontSize: 16, fontFamily: 'DMSans-Bold' }}>
                License
              </Text>
              <Ionicons name="eye-outline" size={20} color="#9CA3AF" />
            </View>
            <View className="flex-row flex-wrap">
              {details.licenses.map((l, idx) => (
                <View 
                  key={`license-${idx}`} 
                  style={{
                    backgroundColor: '#F3F4F6',
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    marginRight: 12,
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ color: '#111827', fontWeight: '600', fontSize: 13, fontFamily: 'DMSans-SemiBold' }}>
                    {l.name}
                  </Text>
                  {l.authority ? (
                    <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 2, fontFamily: 'DMSans-Regular' }}>
                      {l.authority}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>

          {/* Skill & Certifications */}
          <View className="bg-white rounded-2xl p-5 mb-4">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <Ionicons name="sparkles-outline" size={20} color="#130160" />
                <Text style={{ color: '#130160', fontWeight: 'bold', marginLeft: 12, fontSize: 16, fontFamily: 'DMSans-Bold' }}>
                  Skill & Certifications
                </Text>
              </View>
              <Ionicons name="eye-outline" size={20} color="#9CA3AF" />
            </View>
            <View className="flex-row flex-wrap">
              {visibleSkills.map((s, index) => (
                <View 
                  key={`${s}-${index}`}
                  style={{
                    backgroundColor: '#F3F4F6',
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    marginRight: 12,
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 13, fontFamily: 'DMSans-SemiBold' }}>
                    {s}
                  </Text>
                </View>
              ))}
            </View>
            {details.skills.length > 4 && (
              <TouchableOpacity activeOpacity={0.85} onPress={() => console.log('See more skills')}>
                <Text style={{ color: '#130160', textAlign: 'center', fontWeight: '600', marginTop: 8, fontFamily: 'DMSans-SemiBold' }}>
                  See more
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Working Experience */}
          <View className="bg-white rounded-2xl p-5 mb-4">
            <View className="flex-row items-center mb-4">
              <Ionicons name="briefcase-outline" size={20} color="#130160" />
              <Text style={{ color: '#130160', fontWeight: 'bold', marginLeft: 12, fontSize: 16, fontFamily: 'DMSans-Bold' }}>
                Working Experience
              </Text>
            </View>

            <View className="flex-row">
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setExperienceTab('off')}
                className="flex-1 items-center"
              >
                <Text style={{ 
                  color: experienceTab === 'off' ? '#111827' : '#9CA3AF',
                  fontWeight: experienceTab === 'off' ? 'bold' : '600',
                  fontSize: 13,
                  fontFamily: experienceTab === 'off' ? 'DMSans-Bold' : 'DMSans-SemiBold',
                }}>
                  Off-Platform Experience
                </Text>
                <View style={{ 
                  marginTop: 8,
                  height: 2,
                  width: '100%',
                  backgroundColor: experienceTab === 'off' ? '#130160' : '#E5E7EB',
                }} />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setExperienceTab('on')}
                className="flex-1 items-center"
              >
                <Text style={{ 
                  color: experienceTab === 'on' ? '#111827' : '#9CA3AF',
                  fontWeight: experienceTab === 'on' ? 'bold' : '600',
                  fontSize: 13,
                  fontFamily: experienceTab === 'on' ? 'DMSans-Bold' : 'DMSans-SemiBold',
                }}>
                  On-Platform Experience
                </Text>
                <View style={{ 
                  marginTop: 8,
                  height: 2,
                  width: '100%',
                  backgroundColor: experienceTab === 'on' ? '#130160' : '#E5E7EB',
                }} />
              </TouchableOpacity>
            </View>

            {experienceTab === 'on' ? (
              <View className="mt-5">
                <View 
                  style={{
                    backgroundColor: '#F0F9FF',
                    borderRadius: 16,
                    padding: 20,
                    marginBottom: 16,
                  }}
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <View>
                      <Text style={{ color: '#111827', fontWeight: 'bold', fontSize: 16, fontFamily: 'DMSans-Bold' }}>
                        Jobs Completed
                      </Text>
                      <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 2, fontFamily: 'DMSans-Regular' }}>
                        Total patients finished
                      </Text>
                    </View>
                    <View 
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        backgroundColor: '#130160',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="checkmark" size={24} color="#ffffff" />
                    </View>
                  </View>
                  <View className="flex-row items-end">
                    <Text style={{ fontSize: 36, fontWeight: 'bold', color: '#130160', fontFamily: 'DMSans-Bold' }}>
                      {details.onPlatform.jobsCompleted}
                    </Text>
                    <Text style={{ color: '#10B981', fontWeight: '600', marginLeft: 12, marginBottom: 4, fontFamily: 'DMSans-SemiBold' }}>
                      {details.onPlatform.jobsCompletedDeltaLabel}
                    </Text>
                  </View>
                </View>

                <View 
                  style={{
                    backgroundColor: '#FEF2F2',
                    borderRadius: 16,
                    padding: 20,
                    marginBottom: 16,
                  }}
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <View>
                      <Text style={{ color: '#111827', fontWeight: 'bold', fontSize: 16, fontFamily: 'DMSans-Bold' }}>
                        Attendance Rate
                      </Text>
                      <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 2, fontFamily: 'DMSans-Regular' }}>
                        On-time delivery rate
                      </Text>
                    </View>
                    <Ionicons name="shield-checkmark-outline" size={24} color="#EF4444" />
                  </View>
                  <View className="flex-row items-end">
                    <Text style={{ fontSize: 36, fontWeight: 'bold', color: '#EF4444', fontFamily: 'DMSans-Bold' }}>
                      {details.onPlatform.attendanceRate}%
                    </Text>
                    <Text style={{ color: '#EF4444', fontWeight: '600', marginLeft: 12, marginBottom: 4, fontFamily: 'DMSans-SemiBold' }}>
                      {details.onPlatform.attendanceLabel}
                    </Text>
                  </View>
                </View>

                <Text style={{ color: '#111827', fontWeight: 'bold', marginBottom: 12, fontSize: 15, fontFamily: 'DMSans-Bold' }}>
                  Recent Activity
                </Text>
                <View className="bg-white rounded-2xl overflow-hidden">
                  {details.onPlatform.recentActivity.map((a) => (
                    <View 
                      key={a.id} 
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 16,
                        borderBottomWidth: 1,
                        borderBottomColor: '#F3F4F6',
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <View 
                        style={{
                          height: 40,
                          width: 40,
                          borderRadius: 12,
                          backgroundColor: '#F3F4F6',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="checkmark" size={20} color="#111827" />
                      </View>
                      <View className="flex-1 ml-3">
                        <Text style={{ color: '#111827', fontWeight: '600', fontSize: 14, fontFamily: 'DMSans-SemiBold' }}>
                          {a.title}
                        </Text>
                        <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 2, fontFamily: 'DMSans-Regular' }}>
                          {a.subtitle}
                        </Text>
                      </View>
                      <Text style={{ color: '#9CA3AF', fontSize: 11, fontFamily: 'DMSans-Regular' }}>
                        {a.when}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View className="mt-5">
                {details.offPlatformExperiences.length > 0 ? (
                  details.offPlatformExperiences.map((exp, expIdx) => (
                    <View key={`exp-${expIdx}`} className="mb-4">
                      <View 
                        style={{
                          backgroundColor: '#F9FAFB',
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: '#E5E7EB',
                          padding: 20,
                        }}
                      >
                        {exp.isCurrent && (
                          <View 
                            style={{
                              backgroundColor: '#D1FAE5',
                              alignSelf: 'flex-start',
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: 8,
                              marginBottom: 12,
                            }}
                          >
                            <Text style={{ color: '#059669', fontSize: 11, fontWeight: 'bold', fontFamily: 'DMSans-Bold' }}>
                              Currently Working
                            </Text>
                          </View>
                        )}
                        <View className="mb-4">
                          <Text style={{ color: '#9CA3AF', fontSize: 11, fontFamily: 'DMSans-Regular' }}>Role</Text>
                          <Text style={{ color: '#111827', fontWeight: '600', marginTop: 6, fontSize: 14, fontFamily: 'DMSans-SemiBold' }}>
                            {exp.role}
                          </Text>
                        </View>
                        <View className="mb-4">
                          <Text style={{ color: '#9CA3AF', fontSize: 11, fontFamily: 'DMSans-Regular' }}>Department</Text>
                          <Text style={{ color: '#111827', fontWeight: '600', marginTop: 6, fontSize: 14, fontFamily: 'DMSans-SemiBold' }}>
                            {exp.department}
                          </Text>
                        </View>
                        <View className="mb-4">
                          <Text style={{ color: '#9CA3AF', fontSize: 11, fontFamily: 'DMSans-Regular' }}>Institution</Text>
                          <Text style={{ color: '#111827', fontWeight: '600', marginTop: 6, fontSize: 14, fontFamily: 'DMSans-SemiBold' }}>
                            {exp.institution}
                          </Text>
                        </View>
                        <View>
                          <Text style={{ color: '#9CA3AF', fontSize: 11, fontFamily: 'DMSans-Regular' }}>Duration</Text>
                          <Text style={{ color: '#111827', fontWeight: '600', marginTop: 6, fontSize: 14, fontFamily: 'DMSans-SemiBold' }}>
                            {exp.duration}
                          </Text>
                        </View>
                      </View>

                      {exp.documents.length > 0 && (
                        <>
                          <Text style={{ color: '#111827', fontWeight: 'bold', marginTop: 16, marginBottom: 12, fontSize: 15, fontFamily: 'DMSans-Bold' }}>
                            Supporting Documents
                          </Text>
                          {exp.documents.map((d) => (
                            <View 
                              key={d.id} 
                              style={{
                                backgroundColor: '#FFFFFF',
                                borderRadius: 16,
                                borderWidth: 1,
                                borderColor: '#E5E7EB',
                                padding: 16,
                                marginBottom: 12,
                                flexDirection: 'row',
                                alignItems: 'center',
                              }}
                            >
                              <View 
                                style={{
                                  height: 48,
                                  width: 48,
                                  borderRadius: 12,
                                  backgroundColor: '#FEE2E2',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Ionicons name="document-text-outline" size={24} color="#DC2626" />
                              </View>
                              <View className="flex-1 ml-3">
                                <Text style={{ color: '#111827', fontWeight: '600', fontSize: 14, fontFamily: 'DMSans-SemiBold' }}>
                                  {d.title}
                                </Text>
                                <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 2, fontFamily: 'DMSans-Regular' }}>
                                  {d.meta}
                                </Text>
                              </View>
                              <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => {
                                  if (d.url) {
                                    Linking.openURL(d.url).catch(() => {
                                      Alert.alert('Error', 'Unable to open document');
                                    });
                                  } else {
                                    Alert.alert('Unavailable', 'Document link not available');
                                  }
                                }}
                              >
                                <Ionicons name="eye-outline" size={20} color={d.url ? "#130160" : "#9CA3AF"} />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </>
                      )}
                    </View>
                  ))
                ) : (
                  <View 
                    style={{
                      paddingVertical: 32,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#F9FAFB',
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                      borderStyle: 'dashed',
                    }}
                  >
                    <Ionicons name="briefcase-outline" size={40} color="#9CA3AF" />
                    <Text style={{ color: '#6B7280', marginTop: 12, fontWeight: '600', fontFamily: 'DMSans-SemiBold' }}>
                      No off-platform experience listed
                    </Text>
                    <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 4, textAlign: 'center', paddingHorizontal: 24, fontFamily: 'DMSans-Regular' }}>
                      This candidate hasn't added any external work experience yet.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Actions */}
          <View className="bg-white rounded-2xl p-5">
            <View className="flex-row items-center mb-5">
              <Ionicons name="checkbox-outline" size={20} color="#130160" />
              <Text style={{ color: '#130160', fontWeight: 'bold', marginLeft: 12, fontSize: 16, fontFamily: 'DMSans-Bold' }}>
                Actions
              </Text>
            </View>

            {/* Always show 4 action buttons */}
            <View className="flex-row mb-3">
              <TouchableOpacity
                activeOpacity={0.9}
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(40, 167, 69, 0.8)',
                  borderRadius: 16,
                  paddingVertical: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 8,
                  opacity: isSubmitting ? 0.5 : 1,
                }}
                onPress={() => {
                  if (showApplicationActions) {
                    setOfferModalVisible(true);
                  } else {
                    Alert.alert('Hire Candidate', 'This action is only available for applicants. Please invite this candidate first.');
                  }
                }}
                disabled={isSubmitting}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16, fontFamily: 'DMSans-Bold' }}>
                  Hire Candidate
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(0, 123, 255, 0.8)',
                  borderRadius: 16,
                  paddingVertical: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 8,
                  opacity: isSubmitting ? 0.5 : 1,
                }}
                onPress={() => {
                  if (showApplicationActions) {
                    handleUpdateStatus('shortlisted');
                  } else {
                    Alert.alert('Short-list', 'This action is only available for applicants. Please invite this candidate first.');
                  }
                }}
                disabled={isSubmitting}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16, fontFamily: 'DMSans-Bold' }}>
                  Short-list
                </Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row">
              <TouchableOpacity
                activeOpacity={0.9}
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(253, 126, 20, 0.8)',
                  borderRadius: 16,
                  paddingVertical: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 8,
                  opacity: isSubmitting ? 0.5 : 1,
                }}
                onPress={() => setScheduleInterviewModalVisible(true)}
                disabled={isSubmitting}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16, fontFamily: 'DMSans-Bold' }}>
                  Schedule Interview
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(220, 53, 69, 0.8)',
                  borderRadius: 16,
                  paddingVertical: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 8,
                  opacity: isSubmitting ? 0.5 : 1,
                }}
                onPress={() => {
                  if (showApplicationActions) {
                    handleUpdateStatus('rejected');
                  } else {
                    Alert.alert('Reject', 'This action is only available for applicants. Please invite this candidate first.');
                  }
                }}
                disabled={isSubmitting}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16, fontFamily: 'DMSans-Bold' }}>
                  Reject
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Invite Modal */}
      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-center px-5">
          <View className="bg-white rounded-2xl p-6">
            <View className="flex-row items-center mb-4">
              <View 
                style={{
                  height: 48,
                  width: 48,
                  borderRadius: 24,
                  backgroundColor: '#DBEAFE',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="mail" size={24} color="#130160" />
              </View>
              <View className="ml-3 flex-1">
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111827', fontFamily: 'DMSans-Bold' }}>
                  Invite {details.name}
                </Text>
                <Text style={{ fontSize: 13, color: '#6B7280', fontFamily: 'DMSans-Regular' }}>
                  Start a conversation
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 8, fontFamily: 'DMSans-SemiBold' }}>
              Message (optional)
            </Text>
            <TextInput
              placeholder={`Hi ${details.name}, we would like to discuss an opportunity...`}
              value={inviteMessage}
              onChangeText={setInviteMessage}
              style={{
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                marginBottom: 24,
                minHeight: 100,
                fontFamily: 'DMSans-Regular',
                fontSize: 14,
              }}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor="#9CA3AF"
            />

            <View className="flex-row">
              <TouchableOpacity
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#D1D5DB',
                  borderRadius: 12,
                  paddingVertical: 12,
                  marginRight: 8,
                }}
                onPress={() => {
                  setInviteModalVisible(false);
                  setInviteMessage('');
                }}
              >
                <Text style={{ color: '#6B7280', fontWeight: '600', textAlign: 'center', fontFamily: 'DMSans-SemiBold' }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#130160',
                  borderRadius: 12,
                  paddingVertical: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 8,
                  opacity: isSubmitting ? 0.5 : 1,
                }}
                onPress={handleInvite}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="send" size={16} color="#ffffff" />
                    <Text style={{ color: '#FFFFFF', fontWeight: '600', textAlign: 'center', marginLeft: 8, fontFamily: 'DMSans-SemiBold' }}>
                      Send Invitation
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Offer Modal */}
      <OfferModal
        visible={offerModalVisible}
        onClose={() => setOfferModalVisible(false)}
        onSubmit={handleSendOffer}
        candidateName={details.name}
        jobTitle={details.role}
        isSubmitting={isSubmitting}
      />

      {/* Schedule Interview Modal */}
      <ScheduleInterviewModal
        visible={scheduleInterviewModalVisible}
        onClose={() => setScheduleInterviewModalVisible(false)}
        onSubmit={handleScheduleInterview}
        candidateName={details.name}
        jobTitle={details.role}
        isSubmitting={isSubmitting}
      />
    </View>
  );
}
