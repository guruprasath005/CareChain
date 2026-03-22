import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  ImageBackground,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doctorApi } from '@/services/api';
import { useRouter, Link } from 'expo-router';
import { Colors } from '@/constants/Colors';


interface DoctorProfileData {
  id: string;
  name: string;
  displayName: string;
  email: string;
  phone?: string;
  phoneNumber?: string;
  isPhoneVerified?: boolean;
  specialization?: string;
  subSpecializations?: string[];
  designation?: string;
  avatar?: string;
  yearsOfExperience?: number;
  profileCompletion?: number | { percentage?: number; };
  location?: {
    city?: string;
    state?: string;
  };
  address?: {
    city?: string;
    state?: string;
  };
  verification?: {
    email?: boolean;
    phone?: boolean;
    aadhaar?: {
      verified: boolean;
      maskedNumber?: string;
    };
    medicalLicense?: boolean;
  };
  education?: Array<{
    institution: string;
    degree: string;
    specialization?: string;
    startYear?: number;
    endYear?: number;
    documentUrl?: string;
    isVerified?: boolean;
  }>;
  licenses?: Array<{
    name?: string;
    registrationNumber?: string;
    issuingBody?: string;
    issuingAuthority?: string;
    validFrom?: string;
    validTill?: string;
    documentUrl?: string;
    isVerified?: boolean;
  }>;
  skills?: Array<{
    name: string;
    level?: string;
    certificate?: string;
  }>;
  experience?: Array<{
    role?: string;
    department?: string;
    institution?: string;
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
    documents?: Array<{
      title?: string;
      url?: string;
      fileName?: string;
      size?: string;
      uploadedAt?: string;
    } | string>;
  }>;
  platformExperience?: Array<{
    id?: string;
    role?: string;
    hospitalName?: string;
    department?: string;
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
    status?: string;
  }>;
  stats?: {
    jobsCompleted?: number;
    attendanceRate?: number;
    performance?: number;
    rating?: number;
  };
  gender?: string;
  jobPreferences?: {
    shortTermJobs?: boolean;
    longTermJobs?: boolean;
    expectedHourlyRate?: number;
    expectedDailyRate?: number;
    expectedMonthlyRate?: number;
    expectedPerPatientRate?: number;
    preferredLocations?: Array<{ city?: string; state?: string; }>;
    availability?: {
      isAvailable?: boolean;
    };
    jobStatus?: 'available' | 'open_to_work' | 'not_available';
    willingToRelocate?: boolean;
  };
  bio?: string;
  isAvailable?: boolean;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<DoctorProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await doctorApi.getProfile();
      const doctorData = response.success ? ((response.data as any)?.doctor || (response.data as any)?.profile) : null;

      if (doctorData) {
        setProfile(doctorData);
      }
    } catch (error) {
      console.warn('Failed to fetch profile:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Profile completion
  const getProfileCompletion = () => {
    const completionValue: any = profile?.profileCompletion;
    return Math.max(
      0,
      Math.min(
        100,
        Math.round(
          typeof completionValue === 'number'
            ? completionValue
            : typeof completionValue?.percentage === 'number'
              ? completionValue.percentage
              : 0
        )
      )
    );
  };

  const profileCompletion = getProfileCompletion();
  const headerSubtitle = [profile?.specialization, profile?.designation].filter(Boolean).join(' • ');
  const formatMonthYear = (value?: string) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  if (isLoading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#1A1464" />
        <Text className="mt-3 text-gray-500">Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#1e3a8a" />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1A1464']} />
        }
      >
        {/* Header Section */}
        <ImageBackground
          source={require('../assets/images/top-bg_.png')}
          resizeMode="cover"
          className="rounded-b-3xl overflow-hidden"
        >
          <View className="px-4 pt-4 pb-6">
            <Pressable
              className="h-11 w-11 rounded-xl bg-white/10 border border-white/20 items-center justify-center"
              onPress={() => router.back()}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>

            <View className="mt-3 items-center">
              {/* Avatar */}
              <View className="h-24 w-24 rounded-full border-2 border-white/50 items-center justify-center">
                <View className="h-20 w-20 rounded-full overflow-hidden bg-white/10">
                  <Image
                    source={profile?.avatar ? { uri: profile.avatar } : require('../assets/images/logo.png')}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                </View>
              </View>

              <Text className="mt-3 text-white text-xl font-semibold">
                {profile?.displayName || profile?.name || 'Doctor'}
              </Text>
              {headerSubtitle ? (
                <Text className="mt-1 text-blue-100 text-xs">{headerSubtitle}</Text>
              ) : null}

              {/* Profile Completion */}
              <View className="mt-3 w-full">
                <View className="flex-row items-center justify-between">
                  <Text className="text-white/90 text-xs font-semibold">Profile Completion</Text>
                  <Text className="text-white/90 text-xs font-semibold">{profileCompletion}%</Text>
                </View>
                <View className="mt-2 h-2 w-full rounded-full bg-white/20 overflow-hidden">
                  <View
                    className="h-2 rounded-full bg-green-500"
                    style={{ width: `${profileCompletion}%` }}
                  />
                </View>
              </View>
            </View>
          </View>
        </ImageBackground>

        <View className="px-4 py-5">
          {/* Profile Details Header */}
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-gray-900">Profile Details</Text>
            <Link href="/(doctor)/editProfile" asChild>
              <Pressable className="flex-row items-center gap-2 rounded-xl bg-blue-50 border border-blue-100 px-4 py-2">
                <Text className="text-blue-900 text-xs font-semibold">Edit profile</Text>
                <Ionicons name="chevron-forward" size={14} color="#1e3a8a" />
              </Pressable>
            </Link>
          </View>

          {/* Personal Information Section */}
          <ProfileSection
            icon="person"
            title="Personal Information"
          >
            <View className="flex-row items-start mt-3">
              <View className="h-10 w-10 rounded-full bg-blue-100 items-center justify-center">
                <Text className="text-blue-900 font-bold text-sm">
                  {(profile?.displayName || profile?.name || 'D').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-gray-900 font-semibold">
                  {profile?.displayName || profile?.name || 'Not set'}
                </Text>
                <Text className="text-gray-500 text-xs mt-0.5">
                  {profile?.specialization || 'Specialization not set'}
                </Text>
                <View className="flex-row items-center mt-1">
                  <Ionicons name="location-outline" size={12} color="#6b7280" />
                  <Text className="text-gray-500 text-xs ml-1">
                    {profile?.location?.city || profile?.location?.state || 'Location not set'}
                  </Text>
                </View>
                {/* Gender Display */}
                {profile?.gender ? (
                  <View className="flex-row items-center mt-1">
                    <Ionicons name={profile.gender.toLowerCase() === 'male' ? 'male' : profile.gender.toLowerCase() === 'female' ? 'female' : 'male-female'} size={12} color="#6b7280" />
                    <Text className="text-gray-500 text-xs ml-1 capitalize">
                      {profile.gender}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Key Capabilities */}
            <Text className="text-gray-400 text-[10px] font-semibold mt-4 mb-2">KEY CAPABILITIES</Text>
            <View className="flex-row flex-wrap gap-2">
              {!!profile?.specialization && (
                <CapabilityChip label={profile.specialization} color="red" />
              )}
              {(profile?.yearsOfExperience || 0) > 0 && (
                <CapabilityChip label={`${profile.yearsOfExperience} Years Exp`} color="blue" />
              )}
              {profile?.subSpecializations?.slice(0, 2).map((sub, idx) => (
                <CapabilityChip key={idx} label={sub} color="green" />
              ))}
            </View>
          </ProfileSection>

          {/* Profile Overview Section */}
          <ProfileSection
            icon="document-text"
            title="Profile Overview"
            onEdit={() => router.push('/(doctor)/editProfile?section=personal')}
          >
            <Text className="mt-3 text-gray-600 text-sm leading-5">
              {profile?.bio || 'No overview added. Write a short bio to introduce yourself.'}
            </Text>
          </ProfileSection>

          {/* Contact Details Section */}
          <ProfileSection icon="call" title="Contact Details">
            <View className="mt-3">
              <View className="flex-row justify-between">
                <View className="flex-1">
                  <Text className="text-gray-400 text-[10px]">Email</Text>
                  <Text className="text-gray-900 font-medium text-sm mt-1">{profile?.email || 'Not set'}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-gray-400 text-[10px]">Phone</Text>
                  <View className="flex-row items-center mt-1">
                    <Text className="text-gray-900 font-medium text-sm">
                      {profile?.phone || (profile?.phoneNumber ? `+91 ${profile.phoneNumber}` : 'Not set')}
                    </Text>
                    {profile?.isPhoneVerified && (
                      <Ionicons name="checkmark-circle" size={14} color="#16a34a" style={{ marginLeft: 4 }} />
                    )}
                  </View>
                </View>
              </View>

              {/* Location */}
              <View className="mt-4">
                <Text className="text-gray-400 text-[10px]">Location</Text>
                <Text className="text-gray-900 font-medium text-sm mt-1">
                  {[
                    profile?.address?.city || profile?.location?.city,
                    profile?.address?.state || profile?.location?.state
                  ].filter(Boolean).join(', ') || 'Not set'}
                </Text>
              </View>

              {/* Aadhaar Verification */}
              <View className="mt-4 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 flex-row items-center justify-between">
                <View>
                  <Text className="text-gray-500 text-[10px]">Aadhar Number</Text>
                  <Text className="mt-1 text-gray-900 font-semibold">
                    {profile?.verification?.aadhaar?.maskedNumber || 'XXXX XXXX XXXX'}
                  </Text>
                </View>
                <Ionicons
                  name={profile?.verification?.aadhaar?.verified ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={profile?.verification?.aadhaar?.verified ? '#16a34a' : '#dc2626'}
                />
              </View>
            </View>
          </ProfileSection>

          {/* Education Section */}
          <ProfileSection icon="school" title="Education & Training">
            {profile?.education && profile.education.length > 0 ? (
              profile.education.map((edu, idx) => (
                <View key={idx} className="mt-3 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <Text className="text-gray-900 font-semibold">{edu.institution}</Text>
                      <Text className="text-gray-500 text-xs mt-1">
                        {edu.degree}{edu.specialization ? ` - ${edu.specialization}` : ''}
                      </Text>
                      {(edu.startYear || edu.endYear) && (
                        <Text className="text-gray-400 text-xs mt-1">
                          {[edu.startYear, edu.endYear].filter(Boolean).join(' – ')}
                        </Text>
                      )}
                    </View>
                    {edu.documentUrl && (
                      <View className="bg-green-100 rounded-lg px-2 py-1">
                        <Ionicons name="document-text" size={14} color="#16a34a" />
                      </View>
                    )}
                  </View>
                  {edu.isVerified && (
                    <View className="flex-row items-center mt-2">
                      <Ionicons name="checkmark-circle" size={12} color="#16a34a" />
                      <Text className="text-green-600 text-[10px] ml-1">Verified</Text>
                    </View>
                  )}
                </View>
              ))
            ) : (
              <Text className="mt-3 text-gray-500 text-xs">No education added yet</Text>
            )}
          </ProfileSection>

          {/* Licenses Section */}
          <ProfileSection icon="ribbon" title="Licenses & Registrations">
            {profile?.licenses && profile.licenses.length > 0 ? (
              <View className="mt-3">
                {profile.licenses.map((license, idx) => (
                  <View key={idx} className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 mb-2">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center flex-1">
                        <Ionicons name="document-text" size={16} color="#1e3a8a" />
                        <View className="ml-2 flex-1">
                          <Text className="text-blue-900 font-medium text-xs">
                            {license.registrationNumber || license.name || license.issuingBody}
                          </Text>
                          {license.issuingAuthority && (
                            <Text className="text-blue-600 text-[10px] mt-0.5">{license.issuingAuthority}</Text>
                          )}
                        </View>
                      </View>
                      {license.isVerified && (
                        <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                      )}
                    </View>
                    {(license.validFrom || license.validTill) && (
                      <Text className="text-blue-500 text-[10px] mt-2">
                        Valid: {[
                          license.validFrom ? String(license.validFrom).slice(0, 10) : null,
                          license.validTill ? String(license.validTill).slice(0, 10) : null
                        ].filter(Boolean).join(' – ')}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <Text className="mt-3 text-gray-500 text-xs">No licenses added yet</Text>
            )}
          </ProfileSection>

          {/* Skills Section */}
          <ProfileSection icon="flash" title="Skills & Certifications">
            {profile?.skills && profile.skills.length > 0 ? (
              <View className="mt-3">
                <View className="flex-row flex-wrap gap-2">
                  {profile.skills.slice(0, 5).map((skill, idx) => (
                    <View key={idx} className="rounded-full bg-gray-100 border border-gray-200 px-3 py-1.5 flex-row items-center">
                      <Text className="text-gray-700 text-xs">{skill.name}</Text>
                      {skill.level === 'expert' && (
                        <Ionicons name="star" size={10} color="#f59e0b" style={{ marginLeft: 4 }} />
                      )}
                    </View>
                  ))}
                  {profile.skills.length > 5 && (
                    <View className="rounded-full bg-blue-100 border border-blue-200 px-3 py-1.5">
                      <Text className="text-blue-700 text-xs">+{profile.skills.length - 5} more</Text>
                    </View>
                  )}
                </View>
                {profile.skills.some(s => s.certificate) && (
                  <Text className="text-green-600 text-[10px] mt-2">
                    <Ionicons name="document-text" size={10} color="#16a34a" /> Certificates uploaded
                  </Text>
                )}
              </View>
            ) : (
              <Text className="mt-3 text-gray-500 text-xs">No skills added yet</Text>
            )}
          </ProfileSection>

          {/* On-Platform Experience Section */}
          <ProfileSection icon="briefcase" title="On-Platform Experience">
            <View className="mt-4">
              <View className="flex-row gap-3">
                <View className="flex-1 rounded-2xl bg-blue-50 border border-blue-100 px-4 py-4">
                  <View className="flex-row items-center">
                    <View className="h-9 w-9 rounded-full bg-blue-100 items-center justify-center">
                      <Ionicons name="checkmark-circle" size={16} color="#1e3a8a" />
                    </View>
                    <View className="ml-2 flex-1">
                      <Text className="text-gray-500 text-[10px]">Jobs Completed</Text>
                      <Text className="text-blue-900 text-xl font-semibold">
                        {profile?.stats?.jobsCompleted || 0}
                      </Text>
                    </View>
                  </View>
                </View>
                <View className="flex-1 rounded-2xl bg-green-50 border border-green-100 px-4 py-4">
                  <View className="flex-row items-center">
                    <View className="h-9 w-9 rounded-full bg-green-100 items-center justify-center">
                      <Ionicons name="stats-chart" size={16} color="#16a34a" />
                    </View>
                    <View className="ml-2 flex-1">
                      <Text className="text-gray-500 text-[10px]">Attendance Rate</Text>
                      <Text className="text-green-700 text-xl font-semibold">
                        {profile?.stats?.attendanceRate ?? 100}%
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View className="mt-4">
                <Text className="text-gray-400 text-[10px] font-semibold mb-2">RECENT ACTIVITY</Text>
                {profile?.platformExperience && profile.platformExperience.length > 0 ? (
                  <View className="rounded-xl border border-gray-100 bg-white">
                    {profile.platformExperience.slice(0, 4).map((exp, idx) => (
                      <View
                        key={exp.id || idx}
                        className={`flex-row items-center px-3 py-3 ${idx === profile.platformExperience!.slice(0, 4).length - 1 ? '' : 'border-b border-gray-100'}`}
                      >
                        <View className="h-8 w-8 rounded-full bg-blue-50 items-center justify-center">
                          <Ionicons name="briefcase" size={14} color="#1e3a8a" />
                        </View>
                        <View className="ml-3 flex-1">
                          <Text className="text-gray-900 text-xs font-semibold">{exp.role || 'Consultant'}</Text>
                          <Text className="text-gray-400 text-[10px]">{exp.hospitalName || 'Hospital'}</Text>
                        </View>
                        <Text className="text-gray-400 text-[10px]">
                          {exp.startDate ? new Date(exp.startDate).toLocaleDateString() : 'Recent'}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View className="rounded-xl border border-gray-100 bg-white px-3 py-4 items-center">
                    <Text className="text-gray-500 text-xs">No platform activity yet</Text>
                  </View>
                )}
              </View>
            </View>
          </ProfileSection>

          {/* Off-Platform Experience Section */}
          <ProfileSection icon="document-text" title="Off-Platform Experience">
            {profile?.experience && profile.experience.length > 0 ? (
              <View className="mt-4">
                {profile.experience.map((exp, idx) => (
                  <View key={idx} className="rounded-2xl bg-gray-50 border border-gray-100 px-4 py-4 mt-3">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-gray-900 font-semibold">{exp.role || 'Role not specified'}</Text>
                      {exp.isCurrent && (
                        <View className="bg-green-100 px-2 py-0.5 rounded">
                          <Text className="text-green-700 text-[10px] font-semibold">Current</Text>
                        </View>
                      )}
                    </View>

                    <View className="mt-3">
                      <Text className="text-gray-400 text-[10px]">Department</Text>
                      <Text className="text-gray-900 text-xs font-medium mt-1">
                        {exp.department || 'Not specified'}
                      </Text>
                    </View>

                    <View className="mt-3">
                      <Text className="text-gray-400 text-[10px]">Institution</Text>
                      <Text className="text-gray-900 text-xs font-medium mt-1">
                        {exp.institution || 'Not specified'}
                      </Text>
                    </View>

                    <View className="mt-3">
                      <Text className="text-gray-400 text-[10px]">Duration</Text>
                      <Text className="text-gray-900 text-xs font-medium mt-1">
                        {formatMonthYear(exp.startDate)} - {exp.isCurrent ? 'Present' : formatMonthYear(exp.endDate)}
                      </Text>
                    </View>

                    {exp.documents && exp.documents.length > 0 ? (
                      <View className="mt-4">
                        <Text className="text-gray-400 text-[10px] font-semibold mb-2">SUPPORTING DOCUMENTS</Text>
                        {exp.documents.map((doc, docIdx) => {
                          const docUrl = typeof doc === 'string' ? doc : doc.url;
                          const docName = typeof doc === 'string' ? 'Document' : (doc.title || doc.fileName || 'Document');
                          const docSize = typeof doc === 'string' ? null : doc.size;
                          const docDate = typeof doc === 'string' ? null : doc.uploadedAt;

                          return (
                            <Pressable
                              key={docIdx}
                              className="flex-row items-center py-2"
                              onPress={() => (docUrl ? Linking.openURL(docUrl) : undefined)}
                              disabled={!docUrl}
                            >
                              <View className="h-9 w-9 rounded-lg bg-red-50 border border-red-100 items-center justify-center">
                                <Text className="text-red-600 text-[10px] font-bold">PDF</Text>
                              </View>
                              <View className="ml-3 flex-1">
                                <Text className="text-gray-900 text-xs font-semibold" numberOfLines={1}>
                                  {docName}
                                </Text>
                                <Text className="text-gray-400 text-[10px] mt-0.5">
                                  {[docSize, docDate ? new Date(docDate).toLocaleDateString() : null]
                                    .filter(Boolean)
                                    .join(' • ') || 'Tap to view'}
                                </Text>
                              </View>
                              <Ionicons name="eye" size={16} color="#6b7280" />
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : (
                      <Text className="text-gray-400 text-xs mt-4">No supporting documents</Text>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <View className="mt-4 py-4 items-center justify-center">
                <Text className="text-gray-500 text-xs text-center">No off-platform experience added</Text>
              </View>
            )}

            {/* Add Work Experience Button */}
            <Link href="/(doctor)/editProfile" asChild>
              <Pressable className="mt-4 flex-row items-center justify-center py-3 rounded-xl border border-dashed border-blue-300 bg-blue-50">
                <Ionicons name="add-circle-outline" size={18} color="#1e3a8a" />
                <Text className="ml-2 text-blue-900 text-sm font-medium">Add Work Experience</Text>
              </Pressable>
            </Link>
          </ProfileSection>

          {/* Job Preferences Section */}
          <ProfileSection icon="settings" title="Job Preferences">
            <View className="mt-3">

              <View className="flex-row justify-between">
                <View className="flex-1">
                  <Text className="text-gray-400 text-[10px]">Preferred Type</Text>
                  <Text className="text-gray-900 font-medium text-sm mt-1">
                    {[
                      profile?.jobPreferences?.longTermJobs && 'Long term',
                      profile?.jobPreferences?.shortTermJobs && 'Short term',
                    ].filter(Boolean).join(' / ') || 'Not set'}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-gray-400 text-[10px]">Expected Rate</Text>
                  <Text className="text-gray-900 font-medium text-sm mt-1">
                    {(() => {
                      const p = profile?.jobPreferences;
                      if (!p) return 'Not set';
                      if (p.expectedMonthlyRate != null) return `₹${p.expectedMonthlyRate}/month`;
                      if (p.expectedPerPatientRate != null) return `₹${p.expectedPerPatientRate}/patient`;
                      if (p.expectedDailyRate != null) return `₹${p.expectedDailyRate}/day`;
                      if (p.expectedHourlyRate != null) return `₹${p.expectedHourlyRate}/hr`;
                      return 'Not set';
                    })()}
                  </Text>
                </View>
              </View>

              <View className="mt-4">
                <Text className="text-gray-400 text-[10px]">Preferred Locations</Text>
                <Text className="text-gray-900 font-medium text-sm mt-1">
                  {profile?.jobPreferences?.preferredLocations
                    ?.map((l) => [l.city, l.state].filter(Boolean).join(', '))
                    .filter(Boolean)
                    .join(' • ') || profile?.location?.city || 'Not set'}
                </Text>
              </View>

              {/* Availability */}
              <View className="mt-4 flex-row gap-3">
                <AvailabilityBadge
                  label="Available"
                  active={profile?.jobPreferences?.jobStatus === 'available' || profile?.isAvailable}
                />
                <AvailabilityBadge
                  label="Willing to Relocate"
                  active={profile?.jobPreferences?.willingToRelocate}
                />
              </View>
            </View>
          </ProfileSection>

          <View className="h-20" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ================== COMPONENTS ==================

function ProfileSection({
  icon,
  title,
  children,
  onEdit,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: React.ReactNode;
  onEdit?: () => void;
}) {
  const resolvedChildren =
    typeof children === 'string' || typeof children === 'number' ? (
      <Text className="mt-2 text-gray-700 text-sm">{children}</Text>
    ) : (
      children
    );

  return (
    <View className="mt-4 rounded-2xl bg-white border border-gray-100 px-4 py-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <View className="h-8 w-8 rounded-lg bg-blue-50 items-center justify-center">
            <Ionicons name={icon} size={16} color="#1e3a8a" />
          </View>
          <Text className="ml-3 text-gray-900 font-semibold">{title}</Text>
        </View>
        {onEdit && (
          <Pressable onPress={onEdit} className="p-1">
            <Ionicons name="pencil" size={16} color="#1e3a8a" />
          </Pressable>
        )}
      </View>
      {resolvedChildren}
    </View>
  );
}

function CapabilityChip({ label, color }: { label: string; color: 'red' | 'blue' | 'green' }) {
  const colors = {
    red: 'bg-red-100 border-red-200 text-red-700',
    blue: 'bg-blue-100 border-blue-200 text-blue-700',
    green: 'bg-green-100 border-green-200 text-green-700',
  };
  return (
    <View className={`rounded-lg border px-3 py-1.5 ${colors[color]}`}>
      <Text className={`text-xs font-medium ${colors[color].split(' ')[2]}`}>{label}</Text>
    </View>
  );
}

function AvailabilityBadge({ label, active }: { label: string; active?: boolean }) {
  return (
    <View className={`flex-1 rounded-xl border px-3 py-3 flex-row items-center justify-center ${active ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
      }`}>
      <View className={`h-2 w-2 rounded-full mr-2 ${active ? 'bg-green-500' : 'bg-gray-400'}`} />
      <Text className={`text-xs font-medium ${active ? 'text-green-700' : 'text-gray-500'}`}>
        {label}
      </Text>
    </View>
  );
}
