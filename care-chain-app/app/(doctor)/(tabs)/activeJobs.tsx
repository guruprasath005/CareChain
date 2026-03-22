import React, { useState, useCallback } from 'react';
import { ScrollView, View, ActivityIndicator, Text, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ActiveJobCard, { type ActiveJob } from '../_components/ActiveJobCard';
import { useActiveJobs } from '@/hooks';
import { Colors } from '@/constants/Colors';

// Hide the layout header/tab chrome for this screen (we also gate it in the layout).
export const options = {
	headerShown: false,
};

const ActiveJobsScreen: React.FC = () => {
	const router = useRouter();
	const [refreshing, setRefreshing] = useState(false);
	const { jobs: rawJobs, loading, error, refetch } = useActiveJobs();

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await refetch();
		setRefreshing(false);
	}, [refetch]);

	// Transform API jobs to component format
	const activeJobs: ActiveJob[] = rawJobs.map((rawJob) => ({
		id: rawJob.id,
		title: rawJob.title || 'Job Title',
		hospital: rawJob.hospital || 'Hospital',
		jobType: rawJob.jobType || 'Shift-Based',
		timeRange: rawJob.timeRange || '09:00 - 17:00',
		status:
			rawJob.status === 'active'
				? 'Active'
				: rawJob.status === 'on_leave'
				? 'On Leave'
				: rawJob.status === 'paused'
				? 'Paused'
				: rawJob.status === 'completed'
				? 'Completed'
				: 'Terminated',
	}));

	if (loading && !refreshing) {
		return (
			<View style={{ flex: 1, backgroundColor: Colors.ui.backgroundGray, alignItems: 'center', justifyContent: 'center' }}>
				<ActivityIndicator size="large" color={Colors.brand.primary} />
				<Text style={{ marginTop: 12, color: Colors.ui.textSecondary }}>Loading active jobs...</Text>
			</View>
		);
	}

	if (error) {
		return (
			<View style={{ flex: 1, backgroundColor: Colors.ui.backgroundGray, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
				<Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
				<Text style={{ marginTop: 12, color: Colors.ui.textSecondary, textAlign: 'center' }}>{error}</Text>
				<TouchableOpacity
					style={{ marginTop: 16, backgroundColor: Colors.brand.tertiary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
					onPress={onRefresh}
				>
					<Text style={{ color: Colors.ui.background, fontWeight: '600' }}>Retry</Text>
				</TouchableOpacity>
			</View>
		);
	}

	return (
		<ScrollView
			style={{ flex: 1, backgroundColor: Colors.ui.backgroundGray }}
			contentContainerStyle={{ paddingVertical: 16 }}
			refreshControl={
				<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand.primary]} />
			}
		>
			<View style={{ paddingHorizontal: 20, width: '100%', maxWidth: 672, alignSelf: 'center' }}>
				{activeJobs.length === 0 ? (
					<View style={{ paddingVertical: 80, alignItems: 'center' }}>
						<Ionicons name="briefcase-outline" size={48} color={Colors.ui.placeholder} />
						<Text style={{ marginTop: 12, color: Colors.ui.textSecondary }}>No active jobs yet</Text>
						<Text style={{ marginTop: 4, color: Colors.ui.placeholder, fontSize: 14, textAlign: 'center' }}>
							Apply to jobs and once accepted, they'll appear here
						</Text>
					</View>
				) : (
					activeJobs.map((job) => (
						<ActiveJobCard
							key={job.id}
							job={job}
							onViewDetails={(assignmentId) =>
								router.push({ pathname: '/(doctor)/(tabs)/activeJobManager', params: { id: assignmentId } })
							}
							primaryActionLabel="Log Hours"
							onPrimaryAction={(jobId) =>
								router.push({ pathname: '/(doctor)/(tabs)/activeJobManager', params: { id: jobId } })
							}
							secondaryActionLabel={job.status === 'Active' ? 'Mark Attendance' : undefined}
							onSecondaryAction={
								job.status === 'Active'
									? (assignmentId) =>
										router.push({ pathname: '/(doctor)/(tabs)/markAttendance', params: { id: assignmentId } })
									: undefined
							}
						/>
					))
				)}
			</View>
		</ScrollView>
	);
};

export default ActiveJobsScreen;
