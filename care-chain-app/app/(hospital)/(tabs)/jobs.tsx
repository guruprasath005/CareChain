import React, { useState, useCallback, useEffect } from 'react';
import {
	View,
	Text,
	ScrollView,
	TouchableOpacity,
	TextInput,
	ActivityIndicator,
	RefreshControl,
	Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import JobPostedCard from '../components/JobPostedCard';
import { usePostedJobs, useDebounce, useFilterPersistence } from '@/hooks';
import { EmptyState } from '../../_components/EmptyState';
import { SkeletonLoader } from '../../_components/SkeletonLoader';

type TabKey = 'Opened' | 'Expired' | 'Trash';

function Tab({
	label,
	active,
	onPress,
}: {
	label: TabKey;
	active: boolean;
	onPress: () => void;
}) {
	return (
		<TouchableOpacity activeOpacity={0.85} onPress={onPress} className="px-6 py-2">
			<Text className={`${active ? 'text-brand-primary font-bold' : 'text-gray-400 font-semibold'} text-base`}>
				{label}
			</Text>
			<View className={`mt-2 h-1 rounded-full ${active ? 'bg-brand-primary' : 'bg-transparent'}`} />
		</TouchableOpacity>
	);
}

export default function HospitalJobsPosted() {
	const router = useRouter();
	const [activeTab, setActiveTab] = useState<TabKey>('Opened');
	const [searchQuery, setSearchQuery] = useState('');
	const [refreshing, setRefreshing] = useState(false);

	// Debounce search query with 500ms delay (Requirement 14.1)
	const debouncedSearchQuery = useDebounce(searchQuery, { delay: 500 });

	// Load filters from persistence (Requirement 14.2)
	const { filters, clearFilters: clearPersistedFilters } = useFilterPersistence<{
		status?: string;
		datePosted?: string;
		minApplicants?: number;
		maxApplicants?: number;
	}>('hospital_jobs_filters');

	// Map tab to status for backend filtering
	const getStatusForTab = (tab: TabKey): string | undefined => {
		switch (tab) {
			case 'Opened':
				return 'open'; // Backend will handle open, draft, paused
			case 'Expired':
				return 'expired'; // Backend will handle expired, closed, filled
			case 'Trash':
				return 'trash'; // Backend will handle trash, cancelled
			default:
				return undefined;
		}
	};

	const { jobs, loading, error, refetch, deleteJob, restoreJob, deleteJobPermanently } = usePostedJobs(
		getStatusForTab(activeTab),
		debouncedSearchQuery,
		filters
	);

	// Filter jobs by tab on client side (since backend returns all statuses for a category)
	const filteredJobs = jobs.filter(job => {
		switch (activeTab) {
			case 'Opened':
				return job.status === 'open' || job.status === 'draft' || job.status === 'paused';
			case 'Expired':
				return job.status === 'expired' || job.status === 'closed' || job.status === 'filled';
			case 'Trash':
				return job.status === 'trash' || job.status === 'cancelled';
			default:
				return true;
		}
	});

	const isEmpty = filteredJobs.length === 0;

	// Count active filters (Requirement 14.2)
	const activeFilterCount = filters ? Object.keys(filters).length : 0;
	const hasActiveFilters = activeFilterCount > 0;

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await refetch();
		setRefreshing(false);
	}, [refetch]);

	const handleSearchChange = (text: string) => {
		setSearchQuery(text);
	};

	const handleClearSearch = () => {
		setSearchQuery('');
	};

	const handleClearFilters = async () => {
		try {
			await clearPersistedFilters();
			// Refetch jobs after clearing filters
			await refetch();
		} catch (error) {
			console.error('Error clearing filters:', error);
		}
	};

	const getStatusLabel = (status: string) => {
		switch (status) {
			case 'open':
				return 'Open';
			case 'paused':
				return 'Paused';
			case 'draft':
				return 'Draft';
			case 'expired':
				return 'Expired';
			case 'filled':
				return 'Filled';
			case 'cancelled':
				return 'Cancelled';
			case 'closed':
				return 'Closed';
			case 'trash':
				return 'Trash';
			default:
				return status;
		}
	};

	return (
		<View className="flex-1 bg-gray-50">
			<ScrollView
				className="flex-1"
				contentContainerClassName="px-5 pt-5 pb-28"
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#130160']} />
				}
			>
				{/* Tabs */}
				<View className="flex-row justify-center">
					<Tab label="Opened" active={activeTab === 'Opened'} onPress={() => setActiveTab('Opened')} />
					<Tab label="Expired" active={activeTab === 'Expired'} onPress={() => setActiveTab('Expired')} />
					<Tab label="Trash" active={activeTab === 'Trash'} onPress={() => setActiveTab('Trash')} />
				</View>

				{/* Search */}
				<View className="mt-3 bg-white rounded-full border border-gray-200 flex-row items-center px-4 py-3">
					<Ionicons name="search-outline" size={18} color="#9CA3AF" />
					<TextInput
						value={searchQuery}
						onChangeText={handleSearchChange}
						placeholder="Search for Job Posts by Post Title"
						placeholderTextColor="#9CA3AF"
						className="flex-1 ml-3 text-gray-900"
					/>
					{searchQuery.trim().length > 0 && (
						<TouchableOpacity onPress={handleClearSearch} accessibilityLabel="Clear search">
							<Ionicons name="close-circle" size={18} color="#9CA3AF" />
						</TouchableOpacity>
					)}
				</View>

				{/* Filter Button - Hidden for now */}
				{/* <View className="mt-3 flex-row items-center">
					<TouchableOpacity
						onPress={() => router.push('/(hospital)/(tabs)/jobsFilter')}
						className="flex-row items-center bg-white border border-gray-300 rounded-lg px-4 py-2.5"
					>
						<Ionicons name="funnel-outline" size={16} className="text-brand-primary" />
						<Text className="text-sm font-semibold text-indigo-900 ml-2">Filters</Text>
						{hasActiveFilters && (
							<View className="ml-2 bg-brand-primary rounded-full w-5 h-5 items-center justify-center">
								<Text className="text-xs font-bold text-white">{activeFilterCount}</Text>
							</View>
						)}
					</TouchableOpacity>
					{hasActiveFilters && (
						<TouchableOpacity
							onPress={handleClearFilters}
							className="ml-2 bg-red-500 rounded-lg px-4 py-2.5"
						>
							<Text className="text-sm font-semibold text-white">Clear Filters</Text>
						</TouchableOpacity>
					)}
				</View> */}

				{/* Inline search indicator */}
				{searchQuery.trim().length > 0 && (
					<View className="mt-2 flex-row items-center px-2">
						<Ionicons name="funnel-outline" size={14} color="#6B7280" />
						<Text className="text-xs text-gray-600 ml-1">
							Filtering by: "{searchQuery}"
						</Text>
					</View>
				)}

				{/* Loading State */}
				{loading && !refreshing ? (
					<View className="mt-5">
						<SkeletonLoader variant="card" count={3} />
					</View>
				) : error ? (
					<EmptyState
						type="error"
						title="Error"
						message={error}
						onRetry={onRefresh}
					/>
				) : isEmpty ? (
					<EmptyState
						type={searchQuery.trim() ? 'no-search-results' : 'no-data'}
						icon="briefcase-outline"
						title={searchQuery.trim() ? 'No jobs match your search' : `No ${activeTab.toLowerCase()} jobs`}
						message={searchQuery.trim() ? 'Try adjusting your search terms' : undefined}
						showSearchButton={searchQuery.trim().length > 0}
						onClearSearch={searchQuery.trim() ? handleClearSearch : undefined}
					/>
				) : (
					/* List */
					<View className="mt-5">
						{filteredJobs.map((job) => (
							<JobPostedCard
								key={job.id}
								job={{
									id: job.id,
									title: job.title,
									specialization: job.specialization,
									status: getStatusLabel(job.status),
									views: job.views,
									applicants: job.applicants,
									shiftTime: job.shiftTime || 'Not specified',
									salary: job.salary || 'Not specified',
									dates: job.dates || 'Not specified',
									location: job.location || 'Not specified',
								}}
								variant={
									job.status === 'trash'
										? 'trash'
										: job.status === 'open' || job.status === 'paused'
											? 'open'
											: job.status === 'draft'
												? 'draft'
												: 'expired'
								}
								rejections={job.rejections}
								onPressTitle={(jobId) =>
									router.push({ pathname: '/(hospital)/(tabs)/jobPostedDetails/[id]', params: { id: jobId } })
								}
								onShortlist={(jobId) =>
									router.push({ pathname: '/(hospital)/(tabs)/jobApplications/[id]', params: { id: jobId } })
								}
								onEdit={(jobId) =>
									router.push({ pathname: '/(hospital)/postJob/jobDetails', params: { id: jobId, mode: 'edit' } })
								}
								onDelete={(jobId) => {
									Alert.alert(
										'Move to Trash',
										'Are you sure you want to move this job to trash? You can restore it later.',
										[
											{ text: 'Cancel', style: 'cancel' },
											{
												text: 'Move to Trash',
												style: 'destructive',
												onPress: async () => {
													const result = await deleteJob(jobId);
													if (result.success) {
														Alert.alert('Success', 'Job moved to trash');
													} else {
														Alert.alert('Error', result.error || 'Failed to move job to trash');
													}
												},
											},
										]
									);
								}}
								onRestore={async (jobId) => {
									Alert.alert(
										'Restore Job',
										'Are you sure you want to restore this job?',
										[
											{ text: 'Cancel', style: 'cancel' },
											{
												text: 'Restore',
												onPress: async () => {
													const result = await restoreJob(jobId);
													if (result.success) {
														Alert.alert('Success', 'Job restored successfully');
													} else {
														Alert.alert('Error', result.error || 'Failed to restore job');
													}
												},
											},
										]
									);
								}}
								onDeleteForever={(jobId) => {
									Alert.alert(
										'Delete Permanently',
										'Are you sure you want to permanently delete this job? This action CANNOT be undone.',
										[
											{ text: 'Cancel', style: 'cancel' },
											{
												text: 'Delete Forever',
												style: 'destructive',
												onPress: async () => {
													const result = await deleteJobPermanently(jobId);
													if (result.success) {
														Alert.alert('Success', 'Job permanently deleted');
													} else {
														Alert.alert('Error', result.error || 'Failed to delete job');
													}
												},
											},
										]
									);
								}}
								onMenuPress={(jobId) =>
									router.push({ pathname: '/(hospital)/(tabs)/jobPostedDetails/[id]', params: { id: jobId } })
								}
							/>
						))}
					</View>
				)}
			</ScrollView>

			{/* Floating Add Button */}
			<TouchableOpacity
				activeOpacity={0.9}
				onPress={() => router.push('/(hospital)/postJob/jobDetails')}
				className="absolute right-5 bottom-24 h-16 w-16 rounded-full bg-brand-primary items-center justify-center"
				style={{
					shadowColor: '#000',
					shadowOpacity: 0.18,
					shadowRadius: 14,
					shadowOffset: { width: 0, height: 10 },
					elevation: 10,
				}}
				accessibilityRole="button"
				accessibilityLabel="Add job"
			>
				<Ionicons name="add" size={30} color="#ffffff" />
			</TouchableOpacity>
		</View>
	);
}
