import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'react-native';
import { Colors } from '@/constants/Colors';

export default function SuccessScreen() {
  const router = useRouter();
  const { jobId, jobTitle } = useLocalSearchParams();

  const handleViewJob = () => {
    if (jobId) {
      router.push({ pathname: '/(hospital)/(tabs)/jobPostedDetails/[id]', params: { id: jobId as string } });
    } else {
      router.push('/(hospital)/(tabs)/jobs');
    }
  };

  const handleViewApplicants = () => {
    // Navigate to job applications if we have an ID, otherwise jobs list
    if (jobId) {
      // Based on logic in jobs.tsx, usually navigates to jobApplications/[id]
      // But let's check if that route exists. If not, maybe just jobs list.
      // Assuming '/(hospital)/(tabs)/jobApplications/[id]' is correct.
      router.push({ pathname: '/(hospital)/(tabs)/jobApplications/[id]', params: { id: jobId as string } });
    } else {
      router.push('/(hospital)/(tabs)/jobs');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.brand.secondary} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 py-6 pb-12"
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center pt-4">
          <View className="w-32 h-32 rounded-full bg-green-100 items-center justify-center mb-6">
            <View className="w-24 h-24 rounded-full bg-green-500 items-center justify-center">
              <Ionicons name="checkmark" size={48} color="white" />
            </View>
          </View>

          <Text className="text-2xl font-semibold text-gray-900 mb-2 text-center">
            {jobTitle ? `"${jobTitle}" Posted!` : 'Job Posted Successfully'}
          </Text>
          <Text className="text-sm text-gray-500 text-center mb-8 px-8">
            Your job posting is now live and visible to eligible candidates on CareChain.
          </Text>

          <View className="flex-row items-center gap-8 mb-8">
            <View className="items-center">
              <View className="w-12 h-12 rounded-full bg-green-100 items-center justify-center mb-2">
                <Ionicons name="checkmark-circle" size={24} color="#10b981" />
              </View>
              <Text className="text-xs text-gray-600 font-medium">Job</Text>
              <Text className="text-xs text-green-600 font-semibold">Created</Text>
            </View>

            <View className="items-center opacity-40">
              <View className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center mb-2">
                <Ionicons name="people" size={24} color="#9ca3af" />
              </View>
              <Text className="text-xs text-gray-600 font-medium">Applicants</Text>
              <Text className="text-xs text-gray-500 font-semibold">Received</Text>
            </View>
          </View>
        </View>

        <View className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <Text className="text-base font-semibold text-gray-900 mb-4">Job Status</Text>

          <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
            <Text className="text-sm text-gray-600">Status</Text>
            <View className="flex-row items-center">
              <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
              <Text className="text-sm font-medium text-gray-900">Live</Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
            <Text className="text-sm text-gray-600">Visibility</Text>
            <Text className="text-sm text-gray-900 flex-1 text-right ml-4">Visible to eligible candidates</Text>
          </View>

          <View className="flex-row items-start justify-between py-3">
            <Text className="text-sm text-gray-600">Applications</Text>
            <Text className="text-sm text-gray-900 text-right flex-1 ml-4">
              You'll be notified when candidates apply
            </Text>
          </View>
        </View>

        <View className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <Text className="text-base font-semibold text-gray-900 mb-4">Next Actions</Text>

          <TouchableOpacity
            onPress={handleViewJob}
            className="bg-brand-primary rounded-xl py-4 mb-3"
            activeOpacity={0.8}
          >
            <Text className="text-white text-center font-semibold text-base">
              View Job Posting
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-white border border-gray-200 rounded-xl py-4 mb-3"
            activeOpacity={0.8}
            onPress={handleViewApplicants}
          >
            <Text className="text-gray-900 text-center font-semibold text-base">
              View Applicants
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(hospital)/postJob/jobDetails')}
            className="py-3"
            activeOpacity={0.8}
          >
            <Text className="text-brand-tertiary text-center font-semibold text-base">
              Post Another Job
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/(hospital)/(tabs)/home')}
          className="bg-gray-100 rounded-xl py-4 mb-8"
          activeOpacity={0.8}
        >
          <Text className="text-gray-900 text-center font-semibold text-base">
            Go to Dashboard
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
