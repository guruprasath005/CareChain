import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MySchedule, { MyScheduleProps } from '../_components/MySchedule';
import { useEmployeeSchedule, useDoctorProfile, useActiveJobs } from '@/hooks';
import type { MyScheduleData } from '../../../data/activeJobs';

export default function MyScheduleScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Fetch schedule data
  const { schedule, isLoading: scheduleLoading, fetchSchedule } = useEmployeeSchedule(id || '');
  const { profile } = useDoctorProfile();
  const { activeJobs } = useActiveJobs();

  const job = activeJobs.find(j => j.id === id);

  useEffect(() => {
    if (id) {
      fetchSchedule();
    }
  }, [id, fetchSchedule]);

  // Navigation handlers
  const handleNotifications = () => {
    // TODO: Implement notifications
  };
  const handleSettings = () => {
    // TODO: Implement settings
  };

  // Transform data
  const scheduleData: MyScheduleData | null = useMemo(() => {
    if (!schedule || !profile) return null;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const todayEntry = schedule.find(s => s.date === todayStr);

    // Format upcoming (next 7 days exlcuding today)
    const upcoming = schedule
      .filter(s => s.date > todayStr)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(entry => {
        const date = new Date(entry.date);
        return {
          id: entry.id,
          dayShort: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
          dayNumber: date.getDate().toString(),
          title: entry.isWorkDay ? 'Work Shift' : 'Off Duty',
          subtitle: entry.isWorkDay ? `${entry.startTime} - ${entry.endTime}` : 'No work scheduled',
          startLabel: entry.isWorkDay ? entry.startTime : '',
          endLabel: entry.isWorkDay ? entry.endTime : '',
          isOff: !entry.isWorkDay
        };
      });

    // Format today
    let todayData = null;
    if (todayEntry && todayEntry.isWorkDay) {
      // Simple parsing to split time and meridiem if needed, or just use string
      // Expected format usually "09:00 AM" if we stored it right in hospital side
      const startParts = todayEntry.startTime.split(' ');
      const endParts = todayEntry.endTime.split(' ');

      todayData = {
        title: 'Regular Shift',
        imageUri: profile.avatar || undefined,
        clinicName: job?.hospital || 'Hospital',
        location: 'Main Branch', // Mock location if not in job
        startTime: startParts[0] || todayEntry.startTime,
        startMeridiem: startParts[1] || '',
        endTime: endParts[0] || todayEntry.endTime,
        endMeridiem: endParts[1] || '',
        statusLabel: 'UPCOMING', // Logic to determine if active/completed could be added
        shiftDurationLabel: '8h Shift' // Calculate real duration if needed
      };
    }

    return {
      id: id!,
      doctorName: `${profile.firstName} ${profile.lastName}`,
      doctorRole: profile.specialization || 'Doctor',
      todayDateLabel: today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      today: todayData,
      upcoming: upcoming
    };
  }, [schedule, profile, job, id]);


  if (scheduleLoading && !scheduleData) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#1A1464" />
      </View>
    );
  }

  if (!scheduleData) {
    // If just loading profile or something
    if (scheduleLoading) return <View className="flex-1 bg-gray-50 items-center justify-center"><ActivityIndicator size="large" color="#1A1464" /></View>;

    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-6">
        <Text className="text-lg font-semibold text-gray-800 mb-2">Schedule not available</Text>
        <TouchableOpacity onPress={() => router.back()} className="bg-indigo-900 px-4 py-2 rounded-lg">
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <MySchedule
      data={scheduleData}
      onPressNotifications={handleNotifications}
      onPressSettings={handleSettings}
    />
  );
}
