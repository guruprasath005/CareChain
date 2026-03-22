import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import JobCard from '../_components/JobCard';
import { useJobs, useJobApplication, type Job } from '../../../hooks';
import { Colors } from '@/constants/Colors';

const AllJobsScreen: React.FC = () => {
  const router = useRouter();
	const {
		jobs,
		isLoading,
		error,
		refresh,
		loadMore,
		hasMore,
	} = useJobs({ limit: 20 });
  const { apply, isLoading: isApplying } = useJobApplication();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleViewProfile = (jobId: string) =>
    router.push({ pathname: '/(doctor)/(tabs)/jobDetails', params: { id: jobId } });

  const handleApply = (jobId: string, title?: string, hospital?: string) => {
    Alert.alert(
      'Apply for Job',
      `Apply for "${title || 'this job'}"${hospital ? ` at ${hospital}` : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: async () => {
            const result = await apply(jobId);
            if (result.success) {
              Alert.alert('Success', 'Your application has been submitted!');
              await refresh();
            } else {
              Alert.alert('Error', result.error || 'Failed to apply');
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.ui.backgroundGray} />
      <ScrollView 
        style={{ flex: 1, backgroundColor: Colors.ui.background, padding: 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand.primary]} />
        }
        onScrollEndDrag={() => {
          if (hasMore) loadMore();
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.brand.tertiary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: Colors.ui.textPrimary, marginLeft: 16 }}>
            All Jobs
          </Text>
        </View>

        {/* Jobs List */}
        {isLoading && jobs.length === 0 ? (
          <View style={{ marginTop: 24, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={Colors.brand.primary} />
            <Text style={{ marginTop: 12, color: Colors.ui.textSecondary }}>Loading jobs...</Text>
          </View>
        ) : error ? (
          <View style={{ marginTop: 24, alignItems: 'center' }}>
            <MaterialIcons name="error-outline" size={48} color="#EF4444" />
            <Text style={{ marginTop: 8, color: Colors.ui.textPrimary, fontWeight: '600' }}>Unable to load jobs</Text>
            <Text style={{ marginTop: 4, color: Colors.ui.textSecondary, fontSize: 12, textAlign: 'center' }}>{error}</Text>
          </View>
        ) : jobs.length === 0 ? (
          <View style={{ marginTop: 24, alignItems: 'center' }}>
            <MaterialIcons name="work-outline" size={48} color={Colors.ui.placeholder} />
            <Text style={{ marginTop: 8, color: Colors.ui.textPrimary, fontWeight: '600' }}>No jobs available</Text>
            <Text style={{ marginTop: 4, color: Colors.ui.textSecondary, fontSize: 12 }}>New opportunities will appear here once posted.</Text>
          </View>
        ) : (
          <>
            {jobs.map((job: Job) => (
              <JobCard
                key={job.id}
                title={job.title}
                hospital={job.hospital}
                location={job.location}
                experience={job.experience}
                salary={job.salary}
                avatar={job.avatar}
                onViewProfile={() => handleViewProfile(job.id)}
                onInvite={() => handleApply(job.id, job.title, job.hospital)}
              />
            ))}
            {hasMore && (
              <TouchableOpacity
                onPress={loadMore}
                activeOpacity={0.8}
                style={{ marginTop: 16, alignSelf: 'center', backgroundColor: Colors.brand.tertiary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}
              >
                <Text style={{ color: Colors.ui.background, fontSize: 14, fontWeight: '600' }}>Load More</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
};

export default AllJobsScreen;
