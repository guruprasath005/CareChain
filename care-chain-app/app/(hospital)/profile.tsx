import { useRouter, Href } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ImageBackground,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useHospitalProfile } from '@/hooks';
import { Colors } from '@/constants/Colors';

export default function HospitalProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile, isLoading, error, refresh } = useHospitalProfile();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const displayName = profile?.name || user?.fullName || 'Hospital';
  const displayType = profile?.type
    ? profile.type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    : 'Healthcare Institution';
  const displayLocation =
    [profile?.location?.city, profile?.location?.state].filter(Boolean).join(', ') || 'Location not set';

  // Profile sections status
  const sections = profile?.profileCompletionDetails?.sections || {};
  const completionPercentage = profile?.profileCompletion || 0;
  const completedCount = Object.values(sections).filter(Boolean).length;
  const totalCount = Object.keys(sections).length || 5;

  // Get section status
  const getSectionStatus = (key: string) => {
    const completed = (sections as Record<string, boolean>)?.[key] === true;
    return {
      completed,
      label: completed ? 'Completed' : 'Needs Attention',
      color: completed ? 'text-green-600' : 'text-orange-500',
      icon: completed ? 'checkmark-circle' : 'warning',
      iconColor: completed ? '#16a34a' : '#f97316',
    };
  };

  if (isLoading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" className="text-brand-primary" />
        <Text className="mt-3 text-gray-500">Loading profile...</Text>
      </SafeAreaView>
    );
  }

  if (error && !profile) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center px-6">
        <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
        <Text className="mt-3 text-gray-700 text-center">{error}</Text>
        <Pressable className="mt-4 rounded-xl bg-brand-primary px-4 py-3" onPress={onRefresh}>
          <Text className="text-white font-semibold">Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.brand.secondary} />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand.secondary]} />}
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

            <View className="mt-4 items-center">
              {/* Avatar/Logo */}
              <View className="h-24 w-24 rounded-full border-2 border-white/50 items-center justify-center">
                <View className="h-20 w-20 rounded-full overflow-hidden bg-white/10">
                  <Image
                    source={
                      profile?.logo || profile?.avatar
                        ? { uri: profile?.logo || profile?.avatar }
                        : require('../assets/images/logo.png')
                    }
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                </View>

                {/* Verified Badge */}
                {profile?.verification?.isVerified && (
                  <View className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-green-500 border-2 border-white items-center justify-center">
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                )}
              </View>

              <Text className="mt-3 text-white text-xl font-bold">{displayName}</Text>
              <Text className="mt-1 text-blue-100 text-sm">{displayType}</Text>

              {/* Profile Completion */}
              <View className="mt-4 w-full">
                <View className="flex-row items-center justify-between">
                  <Text className="text-white/90 text-xs font-semibold">Profile Completion</Text>
                  <Text className="text-white/90 text-xs font-semibold">
                    {completedCount}/{totalCount} Sections({completionPercentage}%)
                  </Text>
                </View>
                <View className="mt-2 h-2.5 w-full rounded-full bg-white/20 overflow-hidden">
                  <View
                    className="h-2.5 rounded-full bg-green-500"
                    style={{ width: `${Math.max(0, Math.min(100, completionPercentage))}%` }}
                  />
                </View>

              </View>
            </View>
          </View>
        </ImageBackground>

        <View className="px-4 py-5">
          {/* Profile Details Header with Edit Button */}
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-gray-900">Profile Details</Text>
            <Pressable
              className="flex-row items-center gap-2 rounded-xl bg-gray-100 px-3 py-2"
              onPress={() => router.push('/(hospital)/editProfile' as Href)}
            >
              <Text className="text-gray-900 text-xs font-semibold">Edit</Text>
              <Ionicons name="create-outline" size={16} className="text-brand-primary" />
            </Pressable>
          </View>

          {/* Section Cards */}

          {/* General Info Section */}
          <ProfileSectionStatic
            icon="business-outline"
            title="General Info"
          >
            <View className="mt-4 flex-row items-start">
              {profile?.logo && (
                <View className="h-12 w-12 rounded-xl overflow-hidden bg-gray-100 mr-3">
                  <Image source={{ uri: profile.logo }} className="h-full w-full" resizeMode="cover" />
                </View>
              )}
              <View className="flex-1">
                <Text className="text-gray-900 font-semibold">{displayName}</Text>
                <Text className="text-gray-500 text-xs mt-1">{displayType}</Text>
                <View className="flex-row items-center mt-1">
                  <Ionicons name="location-outline" size={12} color="#9ca3af" />
                  <Text className="text-gray-400 text-xs ml-1">{displayLocation}</Text>
                </View>
                {profile?.email && (
                  <View className="flex-row items-center mt-1">
                    <Ionicons name="mail-outline" size={12} color="#9ca3af" />
                    <Text className="text-gray-400 text-xs ml-1">{profile.email}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Key Capabilities */}
            <Text className="mt-4 text-gray-500 text-xs uppercase font-medium">Key Capabilities</Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {profile?.facilities?.opFacility && <CapabilityChip label="OP/IP" />}
              {profile?.facilities?.emergency24x7 && <CapabilityChip label="Emergency" variant="danger" />}
              {profile?.facilities?.icuFacilities && <CapabilityChip label="ICU" />}
              {profile?.facilities?.radiologyDepartment && <CapabilityChip label="Radiology" />}
              {profile?.facilities?.diagnosticLab && <CapabilityChip label="Lab" />}
              {profile?.facilities?.pharmacy && <CapabilityChip label="Pharmacy" />}
            </View>
          </ProfileSectionStatic>

          {/* Representative Details Section */}
          <ProfileSectionStatic
            icon="person-outline"
            title="Representative Details"
          >
            <View className="mt-4">
              <DetailRow label="Full Name" value={profile?.representative?.fullName} />
              <DetailRow
                label="Phone"
                value={
                  typeof profile?.representative?.phone === 'object'
                    ? `${(profile.representative.phone as any).countryCode || ''} ${(profile.representative.phone as any).number || ''}`
                    : profile?.representative?.phone
                }
              />
              <DetailRow label="Email ID" value={profile?.representative?.email} />

              {/* Aadhaar Section */}
              <View className="mt-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-gray-500 text-xs">Identity Verification</Text>
                  {profile?.representative?.aadhaar?.isVerified && (
                    <View className="flex-row items-center">
                      <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                      <Text className="text-green-600 text-xs ml-1">Verified</Text>
                    </View>
                  )}
                </View>
                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="text-gray-500 text-xs">Aadhaar Number</Text>
                  <Text className="text-gray-400 text-xs">Secure & Encrypted</Text>
                </View>
                <View className="mt-2 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 flex-row items-center justify-between">
                  <Text className="text-gray-900 font-semibold">
                    {profile?.representative?.aadhaar?.maskedNumber || 'XXXX XXXX XXXX'}
                  </Text>
                  <Ionicons name="eye-off-outline" size={18} color="#9ca3af" />
                </View>
                <Text className="mt-1 text-gray-400 text-[10px]">
                  The first 8 digits are hidden for security.
                </Text>

                {/* Aadhaar Document */}
                {profile?.representative?.aadhaar?.document?.url && (
                  <View className="mt-3 rounded-xl overflow-hidden">
                    <Image
                      source={{ uri: profile.representative.aadhaar.document.url }}
                      className="w-full h-32"
                      resizeMode="cover"
                    />
                    <View className="bg-gray-50 px-3 py-2">
                      <Text className="text-gray-900 font-medium text-xs">
                        {profile.representative.aadhaar.document.fileName || 'Document'}
                      </Text>
                      <Text className="text-gray-400 text-[10px]">
                        Uploaded on {profile.representative.aadhaar.document.uploadedAt
                          ? new Date(profile.representative.aadhaar.document.uploadedAt).toLocaleDateString()
                          : 'N/A'} • {profile.representative.aadhaar.document.fileSize || 'N/A'}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </ProfileSectionStatic>

          {/* Staffing Details Section */}
          <ProfileSectionStatic
            icon="people-outline"
            title="Staffing Details"
          >
            <View className="mt-4 flex-row justify-around">
              <StaffingCard
                icon="medkit-outline"
                iconColor={Colors.brand.secondary}
                iconBg="bg-blue-50"
                value={profile?.staffing?.totalDoctors?.toString() || '0'}
                label="Doctors"
              />
              <StaffingCard
                icon="heart-outline"
                iconColor="#ec4899"
                iconBg="bg-pink-50"
                value={profile?.staffing?.totalNurses?.toString() || '0'}
                label="Nurses"
              />
            </View>
          </ProfileSectionStatic>

          {/* Infrastructure Details Section */}
          <ProfileSectionStatic
            icon="business-outline"
            title="Infrastructure Details"
          >
            <View className="mt-4">
              {/* Facility Cards */}
              {/* Facility Cards */}
              <View className="flex-row flex-wrap gap-3">
                {/* Total Beds */}
                {profile?.infrastructure?.totalBeds && (
                  <FacilityCard
                    label="Total Beds"
                    value={`${profile.infrastructure.totalBeds} Beds`}
                    available={true}
                  />
                )}

                {/* OP Facility */}
                <FacilityCard
                  label="OPD"
                  value={profile?.facilities?.opFacility ? 'Available' : 'No'}
                  available={profile?.facilities?.opFacility}
                />

                {/* IP Facility */}
                <FacilityCard
                  label="In-Patient"
                  value={profile?.facilities?.ipBeds ? `${profile.facilities.ipBeds} Beds` : (profile?.facilities?.ipFacility ? 'Yes' : 'No')}
                  available={profile?.facilities?.ipFacility}
                />

                {/* Emergency */}
                <FacilityCard
                  label="Emergency"
                  value={profile?.infrastructure?.emergencyBeds ? `${profile.infrastructure.emergencyBeds} Beds` : (profile?.facilities?.emergency24x7 ? '24/7' : 'No')}
                  available={profile?.facilities?.emergency24x7 || !!profile?.infrastructure?.emergencyBeds}
                  is24x7={profile?.facilities?.emergency24x7}
                />

                {/* ICU */}
                <FacilityCard
                  label="ICU"
                  value={profile?.infrastructure?.icuBeds ? `${profile.infrastructure.icuBeds} Beds` : (profile?.facilities?.icuFacilities ? 'Available' : 'No')}
                  available={profile?.facilities?.icuFacilities}
                />

                {/* NICU/PICU */}
                <FacilityCard
                  label="NICU/PICU"
                  value={profile?.infrastructure?.nicuPicuBeds ? `${profile.infrastructure.nicuPicuBeds} Beds` : (profile?.facilities?.nicuPicu ? 'Available' : 'No')}
                  available={profile?.facilities?.nicuPicu}
                />

                {/* Operation Theatre */}
                <FacilityCard
                  label="Op. Theatre"
                  value={profile?.infrastructure?.operationTheaters ? `${profile.infrastructure.operationTheaters} Units` : (profile?.facilities?.operationTheatre ? 'Available' : 'No')}
                  available={profile?.facilities?.operationTheatre}
                />

                {/* Diagnostic Lab */}
                <FacilityCard
                  label="Laboratory"
                  value={profile?.facilities?.diagnosticLab ? 'Available' : 'No'}
                  available={profile?.facilities?.diagnosticLab}
                />

                {/* Radiology */}
                <FacilityCard
                  label="Radiology"
                  value={profile?.facilities?.radiologyDepartment ? 'Available' : 'No'}
                  available={profile?.facilities?.radiologyDepartment}
                />

                {/* Pharmacy */}
                <FacilityCard
                  label="Pharmacy"
                  value={profile?.facilities?.pharmacy ? (profile?.facilities?.pharmacyAvailable24x7 ? '24/7' : 'Available') : 'No'}
                  available={profile?.facilities?.pharmacy}
                  is24x7={profile?.facilities?.pharmacyAvailable24x7}
                />

                {/* Blood Bank */}
                <FacilityCard
                  label="Blood Bank"
                  value={profile?.facilities?.bloodBank ? 'Available' : 'No'}
                  available={profile?.facilities?.bloodBank}
                />

                {/* Ambulance */}
                <FacilityCard
                  label="Ambulance"
                  value={profile?.facilities?.ambulanceService ? 'Available' : 'No'}
                  available={profile?.facilities?.ambulanceService}
                />

                {/* Security */}
                <FacilityCard
                  label="Security"
                  value={profile?.facilities?.securityAvailable ? 'Available' : 'No'}
                  available={profile?.facilities?.securityAvailable}
                />
              </View>

              {/* Facility Gallery */}
              {profile?.facilityGallery && profile.facilityGallery.length > 0 && (
                <View className="mt-4">
                  <Text className="text-gray-500 text-xs uppercase font-medium mb-2">Facility Gallery</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {profile.facilityGallery.map((img, idx) => (
                      <View key={idx} className="mr-2 rounded-xl overflow-hidden">
                        <Image
                          source={{ uri: img.url }}
                          className="w-20 h-20"
                          resizeMode="cover"
                        />
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </ProfileSectionStatic>

          {/* Credentials & Verification Section */}
          <ProfileSectionStatic
            icon="shield-checkmark-outline"
            title="Credentials & Verification"
          >
            <View className="mt-4">
              <CredentialRow
                label="Registration No."
                value={profile?.credentials?.registrationNumber || profile?.registrationNumber}
              />
              <CredentialRow
                label="Accreditation"
                value={
                  profile?.credentials?.accreditations?.length
                    ? profile.credentials.accreditations.join(', ')
                    : profile?.credentials?.nabh?.isVerified
                      ? 'NABH Accredited'
                      : undefined
                }
                highlight
              />

              {/* Verified Documents */}
              {(!!profile?.credentials?.establishmentLicense?.url || !!profile?.credentials?.fireSafetyNOC?.url) && (
                <>
                  <Text className="mt-4 text-gray-500 text-xs uppercase font-medium">Verified Documents</Text>
                  <View className="mt-2">
                    <VerifiedDocRow
                      label="Establishment License"
                      verified={profile?.credentials?.establishmentLicense?.isVerified}
                      hasDocument={!!profile?.credentials?.establishmentLicense?.url}
                    />
                    <VerifiedDocRow
                      label="Fire Safety NOC"
                      verified={profile?.credentials?.fireSafetyNOC?.isVerified}
                      hasDocument={!!profile?.credentials?.fireSafetyNOC?.url}
                    />
                  </View>
                </>
              )}
            </View>
          </ProfileSectionStatic>

          <View className="h-20" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Component: Section Tag
function SectionTag({ label, completed }: { label: string; completed?: boolean }) {
  return (
    <View className={`flex-row items-center rounded-full px-2 py-1 ${completed ? 'bg-white/20' : 'bg-orange-500/20'}`}>
      <Ionicons
        name={completed ? 'checkmark-circle' : 'warning'}
        size={10}
        color={completed ? '#fff' : '#f97316'}
      />
      <Text className={`ml-1 text-[10px] ${completed ? 'text-white/80' : 'text-orange-300'}`}>{label}</Text>
    </View>
  );
}

// ProfileSectionStatic updated to remove onEdit
function ProfileSectionStatic({
  icon,
  title,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-4 rounded-2xl bg-white border border-gray-100 overflow-hidden">
      <View className="px-4 py-4 flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <View className="h-10 w-10 rounded-xl bg-blue-50 items-center justify-center">
            <Ionicons name={icon} size={20} className="text-brand-primary" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-gray-900 font-semibold">{title}</Text>
          </View>
        </View>
      </View>

      <View className="px-4 pb-4 border-t border-gray-100">{children}</View>
    </View>
  );
}

// Component: Detail Row
function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View className="mt-3">
      <Text className="text-gray-500 text-xs">{label}</Text>
      <View className="mt-1 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
        <Text className="text-gray-900 font-medium">{value || 'Not set'}</Text>
      </View>
    </View>
  );
}

// Component: Capability Chip
function CapabilityChip({ label, variant = 'default' }: { label: string; variant?: 'default' | 'danger' }) {
  const bgClass = variant === 'danger' ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100';
  const textClass = variant === 'danger' ? 'text-red-600' : 'text-gray-700';

  return (
    <View className={`rounded-full border px-3 py-1.5 ${bgClass}`}>
      <Text className={`text-xs font-medium ${textClass}`}>{label}</Text>
    </View>
  );
}

// Component: Staffing Card
function StaffingCard({
  icon,
  iconColor,
  iconBg,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  value: string;
  label: string;
}) {
  return (
    <View className="items-center">
      <View className={`h-14 w-14 rounded-2xl ${iconBg} items-center justify-center`}>
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>
      <Text className="mt-2 text-2xl font-bold text-gray-900">{value}</Text>
      <Text className="text-gray-500 text-xs">{label}</Text>
    </View>
  );
}

// Component: Facility Card
function FacilityCard({
  label,
  value,
  available,
  is24x7,
}: {
  label: string;
  value: string;
  available?: boolean;
  is24x7?: boolean;
}) {
  return (
    <View className="rounded-xl bg-gray-50 border border-gray-100 p-3 min-w-[140px]">
      <View className="flex-row items-center justify-between">
        <Ionicons name="bed-outline" size={16} color="#6b7280" />
        {available !== undefined && (
          <View className={`rounded-full px-2 py-0.5 ${available ? 'bg-green-500' : 'bg-gray-300'}`}>
            <Text className="text-white text-[10px] font-medium">{available ? (is24x7 ? '24/7' : 'Yes') : 'No'}</Text>
          </View>
        )}
      </View>
      <Text className="mt-2 text-gray-500 text-xs">{label}</Text>
      <Text className="text-gray-900 font-bold">{value}</Text>
    </View>
  );
}

// Component: Credential Row
function CredentialRow({ label, value, highlight }: { label: string; value?: string | null; highlight?: boolean }) {
  return (
    <View className="flex-row items-center justify-between py-2 border-b border-gray-100">
      <Text className="text-gray-500 text-sm">{label}</Text>
      <Text className={`font-semibold ${highlight ? 'text-brand-tertiary' : 'text-gray-900'}`}>
        {value || 'Not set'}
      </Text>
    </View>
  );
}

// Component: Verified Document Row
function VerifiedDocRow({
  label,
  verified,
  hasDocument,
}: {
  label: string;
  verified?: boolean;
  hasDocument?: boolean;
}) {
  if (!hasDocument) return null; // Logic to hide if document not present

  return (
    <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
      <View className="flex-row items-center">
        <View className="h-8 w-8 rounded-lg bg-red-50 items-center justify-center">
          <Ionicons name="document-text" size={16} color="#dc2626" />
        </View>
        <Text className="ml-3 text-gray-900 font-medium">{label}</Text>
      </View>
      <Ionicons
        name={verified ? 'checkmark-circle' : 'time-outline'}
        size={20}
        color={verified ? '#16a34a' : '#f59e0b'}
      />
    </View>
  );
}
