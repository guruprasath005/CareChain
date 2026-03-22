import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import RequestLeave from '../_components/RequestLeave';
import { useActiveJobs, useDoctorProfile, useLeave } from '@/hooks';
import { RequestLeaveData, LeaveRequestStatus } from '@/data/activeJobs';

export default function RequestLeaveScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { activeJobs, loading: jobsLoading } = useActiveJobs();
  const { profile, isLoading: profileLoading } = useDoctorProfile();

  const { requests, isLoading: leaveLoading, requestLeave } = useLeave();

  const job = activeJobs.find(j => j.id === id);
  const isLoading = jobsLoading || profileLoading || leaveLoading;

  const handleSubmit = async (payload: {
    dateText: string;
    startDate?: Date | null;
    endDate?: Date | null;
    dayMode: 'single' | 'multiple';
    leaveType: 'Sick' | 'Emergency';
    note: string;
  }) => {
    if (!id || !job) return;

    // Use selected dates directly if available, otherwise try parsing dateText
    let startDate: Date;
    let endDate: Date;

    if (payload.startDate) {
      startDate = payload.startDate;
      endDate = payload.dayMode === 'single' ? payload.startDate : (payload.endDate || payload.startDate);
    } else {
      // Fallback to parsing (shouldn't happen with new picker)
      try {
        if (payload.dayMode === 'single') {
          startDate = new Date(payload.dateText);
          endDate = new Date(payload.dateText);
        } else {
          const parts = payload.dateText.split('-').map(s => s.trim());
          startDate = new Date(parts[0]);
          endDate = new Date(parts[1] || parts[0]);
        }
      } catch (e) {
        Alert.alert('Invalid Date', 'Please use the date picker.');
        return;
      }
    }

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      Alert.alert('Invalid Date', 'Please select valid dates.');
      return;
    }

    const result = await requestLeave({
      assignmentId: id,
      leaveType: payload.leaveType.toLowerCase(),
      startDate,
      endDate,
      reason: payload.note,
      isHalfDay: false // Simplified
    });

    if (result.success) {
      Alert.alert('Success', 'Leave request submitted.');
      router.back();
    } else {
      Alert.alert('Error', result.error || 'Failed to submit request.');
    }
  };

  if (isLoading && !requests.length) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#1A1464" />
      </View>
    );
  }

  if (!job) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-6">
        <Text className="text-lg font-semibold text-gray-800 mb-2">Job not found</Text>
        <TouchableOpacity onPress={() => router.back()} className="bg-indigo-900 px-4 py-2 rounded-lg">
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const data: RequestLeaveData = {
    id: job.id,
    doctorName: (profile?.firstName && profile?.lastName)
      ? `${profile.firstName} ${profile.lastName}`
      : (profile?.fullName || 'Doctor'),
    doctorRole: job.title,
    availableDays: job.leaveBalance ? (job.leaveBalance.total - job.leaveBalance.used) : 12, // Default to 12 if not set
    usedYtdDays: requests.filter(r => r.status === 'approved').reduce((acc, r) => acc + (r.totalDays || 1), 0),
    usedYtdSinceLabel: 'Since Jan 1, 2026',
    recentRequests: requests.map(r => ({
      id: r.id,
      status: (r.status?.charAt(0).toUpperCase() + r.status?.slice(1) || 'Pending') as LeaveRequestStatus,
      dateRange: (() => {
        try {
          const start = new Date(r.startDate);
          const end = new Date(r.endDate);
          const startStr = start.toLocaleDateString();
          const endStr = end.toLocaleDateString();
          return startStr + (startStr !== endStr ? ` - ${endStr}` : '');
        } catch {
          return 'Invalid dates';
        }
      })(),
      typeLabel: r.leaveType?.charAt(0).toUpperCase() + r.leaveType?.slice(1) || 'Sick',
      durationLabel: `${r.totalDays || 1} day${(r.totalDays || 1) > 1 ? 's' : ''}`
    }))
  };

  return (
    <RequestLeave
      data={data}
      onPressNotifications={() => {
        // TODO: Implement notifications
      }}
      onPressSettings={() => {
        // TODO: Implement settings
      }}
      onSubmit={handleSubmit}
      onPressViewAll={() => {
        // TODO: Implement view all
      }}
    />
  );
}
