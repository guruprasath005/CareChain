import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import JobDetailsView from '../../components/JobDetailsView';
import { useHospitalJobDetails } from '@/hooks';

export default function JobPostedDetailsPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { job, isLoading, error, refresh } = useHospitalJobDetails(typeof id === 'string' ? id : '');

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#1A1464" />
        <Text className="text-gray-500 mt-2">Loading job details...</Text>
      </View>
    );
  }

  if (error || !job) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-6">
        <Text className="text-lg font-semibold text-gray-800 mb-2">
          {error || 'Job not found'}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-blue-900 px-4 py-2 rounded-lg"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <JobDetailsView
      job={{
        id: job.id,
        title: job.title,
        hospital: 'Your Hospital',
        location: job.location,
        experience: job.experience,
        salary: job.salary,
        avatar: null,
        status: job.status === 'open' || job.status === 'paused' ? 'Open' : 'Closed',
        views: job.views,
        specialization: job.specialization,
        dates: job.dates,
        applicants: job.applicants,
        description: job.description,
        qualifications: job.qualifications,
        skills: job.skills,
        shiftTime: job.shiftTime,
        shiftType: job.shiftType,
        facilities: job.facilities,
        requirements: job.requirements,
      }}
      applicationStats={job.applicationStats}
    />
  );
}
