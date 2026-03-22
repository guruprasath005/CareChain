import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCandidateDetails } from '@/hooks';
import CandidateDetailsView from '../components/CandidateDetailsView';

export default function CandidateDetailsPage() {
  const router = useRouter();
  const { id, applicationId, jobId, mode, initialAction } = useLocalSearchParams<{
    id: string;
    applicationId?: string;
    jobId?: string;
    mode?: 'search' | 'application';
    initialAction?: 'invite';
  }>();

  const { candidate, isLoading, error, refresh } = useCandidateDetails(
    typeof id === 'string' ? id : ''
  );

  // ... (existing code)

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" className="text-brand-primary" />
        <Text className="text-gray-500 mt-2">Loading candidate details...</Text>
      </View>
    );
  }

  if (error || !candidate) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-5">
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text className="text-gray-700 font-semibold mt-4 text-center">
          {error || 'Candidate not found'}
        </Text>
        <TouchableOpacity
          className="mt-4 bg-brand-primary px-6 py-3 rounded-xl"
          onPress={refresh}
        >
          <Text className="text-white font-semibold">Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="mt-3"
          onPress={() => router.back()}
        >
          <Text className="text-brand-primary font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <CandidateDetailsView
        details={candidate}
        onClose={() => router.back()}
        applicationId={typeof applicationId === 'string' ? applicationId : undefined}
        jobId={typeof jobId === 'string' ? jobId : undefined}
        mode={typeof mode === 'string' ? (mode as any) : applicationId ? 'application' : 'search'}
        initialAction={initialAction as any}
      />
    </SafeAreaView>
  );
}
