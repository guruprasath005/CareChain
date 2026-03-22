import React, { useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ActiveJobManager from '../_components/ActiveJobManager';
import { useActiveJobs, useAttendance, useDoctorProfile, useEmployeeSchedule } from '@/hooks';
import { ActiveJobManagerData } from '@/data/activeJobs';
import EmployeeFeedbackForm from '@/app/_components/feedback/EmployeeFeedbackForm';
import { Alert } from 'react-native';
import { useState } from 'react';

export default function ActiveJobManagerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [isFeedbackVisible, setIsFeedbackVisible] = useState(false);

  // Fetch real data
  const { activeJobs, loading: jobsLoading } = useActiveJobs();
  const { profile, isLoading: profileLoading } = useDoctorProfile();

  // Fetch schedule to get today's specific shift
  // We assume 'id' here corresponds to the assignmentId which the schedule is keyed by
  const { schedule, isLoading: scheduleLoading, fetchSchedule } = useEmployeeSchedule(id || '');

  const { history, isLoading: attendanceLoading } = useAttendance(id!);

  useEffect(() => {
    if (id) {
      fetchSchedule();
    }
  }, [id, fetchSchedule]);

  // Find the specific job
  const job = activeJobs.find(j => j.id === id);

  // Derive stats from history
  const stats = useMemo(() => {
    const present = history.filter(h => h.status === 'present').length;
    // Assuming 'absent' records exist or we just count present
    const absent = history.filter(h => h.status === 'absent').length;
    return { present, absent };
  }, [history]);

  // Get today's specific schedule
  const todayShiftDetailed = useMemo(() => {
    if (!schedule) return null;
    const todayStr = new Date().toISOString().split('T')[0];
    return schedule.find(s => s.date === todayStr);
  }, [schedule]);

  const isLoading = jobsLoading || profileLoading; // Schedule loading is optional, can show default while loading

  if (isLoading) {
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
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-indigo-900 px-4 py-2 rounded-lg"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Determine display time for today
  let displayTime = job.timeRange || '09:00 AM - 05:00 PM';
  if (todayShiftDetailed) {
    if (todayShiftDetailed.isWorkDay) {
      displayTime = `${todayShiftDetailed.startTime} - ${todayShiftDetailed.endTime}`;
    } else {
      displayTime = 'Off Duty';
    }
  }

  // Transform to component data format
  // Note: Some fields are mocked because they aren't in the ActiveJob interface yet
  const data: ActiveJobManagerData = {
    id: job.id,
    doctorName: (profile?.firstName && profile?.lastName)
      ? `${profile.firstName} ${profile.lastName}`
      : (profile?.fullName || 'Doctor'),
    doctorRole: profile?.specialization || job.title,
    status: (job.status === 'active' ? 'Active' :
      job.status === 'on_leave' ? 'On Leave' :
        job.status === 'paused' ? 'Paused' : 'Active'), // Map status
    jobCode: job.assignmentCode || `#JOB-${job.id.substring(0, 6)}`,
    title: job.title,
    clinicName: job.hospital,
    todayShift: displayTime,
    shiftType: job.jobType || 'Day Shift',
    onCall: job.onCallStatus?.isOnCall ? 'Available' : 'Unavailable',
    admin: job.reportingTo?.name || job.reportingTo?.designation || job.hospital || 'Hospital Admin',
    location: job.location || 'Unknown Location', // Pass location with fallback
    daysPresent: stats.present,
    daysAbsent: stats.absent,
  };

  return (
    <>
      <ActiveJobManager
        data={data}
        onPressNotification={() => {
          // TODO: Implement notifications
        }}
        onPressSettings={() => {
          // TODO: Implement settings
        }}
        onPressEmployerProfile={() => {
          if (job.hospitalId) {
            // @ts-ignore - Dynamic route
            router.push({ pathname: '/(doctor)/(tabs)/hospitalProfile', params: { id: job.hospitalId } });
          }
        }}
        onPressMarkAttendance={() =>
          router.push({ pathname: '/(doctor)/(tabs)/markAttendance', params: { id: data.id } })
        }
        onPressRequestLeave={() =>
          router.push({ pathname: '/(doctor)/(tabs)/requestLeave', params: { id: data.id } })
        }
        onPressWorkSchedule={() =>
          router.push({ pathname: '/(doctor)/(tabs)/mySchedule', params: { id: data.id } })
        }
        onPressQuitJob={() => {
          setIsFeedbackVisible(true);
        }}
      />

      {
        job && (
          <EmployeeFeedbackForm
            isVisible={isFeedbackVisible}
            onClose={() => setIsFeedbackVisible(false)}
            onSubmitSuccess={() => {
              setIsFeedbackVisible(false);
              Alert.alert('Feedback Submitted', 'Thank you for your feedback. Our team will review your resignation request.', [
                { text: 'OK', onPress: () => router.back() }
              ]);
            }}
            assignmentId={job.id}
            hospitalName={job.hospital}
            jobTitle={job.title}
          />
        )
      }
    </>
  );
}
