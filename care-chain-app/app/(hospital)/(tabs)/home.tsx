import React from 'react';
import {
	View,
	Text,
	ScrollView,
	TouchableOpacity,
	StatusBar,
	ActivityIndicator,
	RefreshControl,
	Modal,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import CandidateCard from '../components/CandidateCard';
import { useHospitalProfile, usePostedJobs, useHospitalDashboard, useSearchDoctors } from '../../../hooks';
import { useAuth } from '../../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';

export default function HospitalHome() {
	const router = useRouter();
	const { user } = useAuth();
	const { profile, isLoading: profileLoading } = useHospitalProfile();
	const { jobs, isLoading: jobsLoading, refresh: refreshJobs } = usePostedJobs();
	const { stats, isLoading: statsLoading, refresh: refreshStats } = useHospitalDashboard();
	const { doctors, isLoading: doctorsLoading, refresh: refreshDoctors } = useSearchDoctors({ limit: 5 });
	const [refreshing, setRefreshing] = React.useState(false);
	const [showNotification, setShowNotification] = React.useState(false);
	const [menuVisible, setMenuVisible] = React.useState(false);
	const [selectedCandidateId, setSelectedCandidateId] = React.useState<string | null>(null);

	React.useEffect(() => {
		const checkNewApplication = async () => {
			if (stats?.latestApplication) {
				const lastSeenId = await AsyncStorage.getItem('lastSeenApplicationId');
				if (lastSeenId !== stats.latestApplication.id) {
					setShowNotification(true);
				}
			}
		};
		checkNewApplication();
	}, [stats?.latestApplication]);

	const handleNotificationClick = async () => {
		if (stats?.latestApplication) {
			await AsyncStorage.setItem('lastSeenApplicationId', stats.latestApplication.id);
			setShowNotification(false);
			router.push({
				pathname: '/(hospital)/(tabs)/jobApplications/[id]',
				params: {
					id: stats.latestApplication.jobId,
				},
			});
		}
	};

	const onRefresh = React.useCallback(async () => {
		setRefreshing(true);
		await Promise.all([refreshJobs(), refreshStats(), refreshDoctors()]);
		setRefreshing(false);
	}, [refreshJobs, refreshStats, refreshDoctors]);

	const handleSeeAll = () => {
		router.push('/(hospital)/(tabs)/allCandidates');
	};

	const handleViewProfile = (candidateId: string) => {
		router.push({ pathname: '/(hospital)/candidateDetails/[id]', params: { id: candidateId } });
	};

	const handleInvite = (candidateId: string) => {
		router.push({
			pathname: '/(hospital)/candidateDetails/[id]',
			params: { id: candidateId, mode: 'search', initialAction: 'invite' }
		});
	};

	const handlePostJob = () => {
		router.push('/(hospital)/postJob/jobDetails');
	};

	const handleFindTalent = () => {
		router.push('/(hospital)/(tabs)/search');
	};

	const handleMenuPress = (candidateId: string) => {
		setSelectedCandidateId(candidateId);
		setMenuVisible(true);
	};

	const handleNotInterested = () => {
		// TODO: Implement not interested functionality
		setMenuVisible(false);
		// Implement logic to hide candidate
	};

	const handleReport = () => {
		// TODO: Implement report functionality
		setMenuVisible(false);
		// Implement logic to report candidate
	};

	return (
		<>
			<StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

			<ScrollView
				className="flex-1 bg-gray-50"
				contentContainerClassName="px-5 pt-5 pb-8"
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
				}
			>
				{/* ===== New Application Notification ===== */}
				{showNotification && stats?.latestApplication && (
					<TouchableOpacity
						className="mb-5 bg-white rounded-xl p-4 border border-gray-100 flex-row items-center justify-between"
						onPress={handleNotificationClick}
					>
						<View className="flex-row items-center flex-1">
							<View className="h-10 w-10 rounded-full bg-gray-50 items-center justify-center">
								<Ionicons name="notifications" size={20} className="text-brand-tertiary" />
							</View>
							<View className="ml-3 flex-1">
								<Text className="text-sm font-bold text-gray-900">New Application Received!</Text>
								<Text className="text-xs text-gray-600 mt-0.5" numberOfLines={1}>
									{stats.latestApplication.doctorName} applied for {stats.latestApplication.jobTitle}
								</Text>
							</View>
						</View>
						<Ionicons name="chevron-forward" size={20} className="text-brand-tertiary" />
					</TouchableOpacity>
				)}

				{/* ===== Hero / Stats Card ===== */}
				<View className="bg-white rounded-2xl p-3 border border-gray-200">
					<Text style={{ fontSize: 15, fontWeight: 'bold', color: '#130160', textAlign: 'center', fontFamily: 'DMSans-Bold' }}>
						Find Your Perfect Candidates
					</Text>
					<Text style={{ fontSize: 11, color: '#130160', textAlign: 'center', marginTop: 4, lineHeight: 14, fontFamily: 'DMSans-Regular' }}>
						Discover talented healthcare professionals that match your hospital's needs and requirements.
					</Text>

					<View className="mt-3 flex-row items-center">
						<View className="flex-1 items-center">
							<View className="h-9 w-9 rounded-xl overflow-hidden mb-1.5">
								<LinearGradient
									colors={['#130160', '#1E40AF']}
									start={{ x: 0, y: 0 }}
									end={{ x: 1, y: 1 }}
									className="h-full w-full items-center justify-center"
								>
									<Ionicons name="briefcase-outline" size={18} color="#FFFFFF" />
								</LinearGradient>
							</View>
							<Text style={{ fontSize: 11, color: '#6B7280', fontWeight: '500', fontFamily: 'DMSans-Medium' }}>Active Jobs</Text>
							<Text style={{ fontSize: 22, fontWeight: 'bold', color: '#130160', marginTop: 1, fontFamily: 'DMSans-Bold' }}>
								{String(stats?.activeJobs || 0).padStart(2, '0')}
							</Text>
							<Text style={{ fontSize: 9, color: '#9CA3AF', marginTop: 0.5, fontFamily: 'DMSans-Regular' }}>Open positions</Text>
						</View>

						<View className="w-px h-14 bg-gray-200" />

						<View className="flex-1 items-center">
							<View className="h-9 w-9 rounded-xl overflow-hidden mb-1.5">
								<LinearGradient
									colors={['#130160', '#1E40AF']}
									start={{ x: 0, y: 0 }}
									end={{ x: 1, y: 1 }}
									className="h-full w-full items-center justify-center"
								>
									<Ionicons name="people-outline" size={18} color="#FFFFFF" />
								</LinearGradient>
							</View>
							<Text style={{ fontSize: 11, color: '#6B7280', fontWeight: '500', fontFamily: 'DMSans-Medium' }}>Hired</Text>
							<Text style={{ fontSize: 22, fontWeight: 'bold', color: '#130160', marginTop: 1, fontFamily: 'DMSans-Bold' }}>
								{String(stats?.totalHires || 0).padStart(2, '0')}
							</Text>
							<Text style={{ fontSize: 9, color: '#9CA3AF', marginTop: 0.5, fontFamily: 'DMSans-Regular' }}>Successful Hires</Text>
						</View>
					</View>
				</View>



				{/* ===== Quick Actions ===== */}
				<View className="mt-4 rounded-2xl overflow-hidden shadow-sm">
					<LinearGradient
						colors={['#130160', '#1E40AF']}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}
						className="p-4"
					>
						<Text className="text-white text-sm font-bold mb-3">Quick Actions</Text>

						<View className="flex-row">
							<TouchableOpacity
								activeOpacity={0.85}
								className="flex-1 bg-white/10 rounded-2xl py-3 items-center justify-center"
								onPress={handlePostJob}
							>
								<View className="h-10 w-10 rounded-2xl bg-white items-center justify-center shadow-sm">
									<Ionicons name="add" size={20} color="#130160" />
								</View>
								<Text className="text-white text-xs font-semibold mt-2">Post New Job</Text>
							</TouchableOpacity>

							<View className="w-3" />

							<TouchableOpacity
								activeOpacity={0.85}
								className="flex-1 bg-white/10 rounded-2xl py-3 items-center justify-center"
								onPress={handleFindTalent}
							>
								<View className="h-10 w-10 rounded-2xl bg-white items-center justify-center shadow-sm">
									<Ionicons name="search-outline" size={20} color="#1E40AF" />
								</View>
								<Text className="text-white text-xs font-semibold mt-2">Find Talent</Text>
							</TouchableOpacity>
						</View>
					</LinearGradient>
				</View>

				{/* ===== Recommended Candidates ===== */}
				<View className="mt-6">
					<View className="flex-row items-center justify-between mb-4">
						<View className="flex-row items-center">
							<MaterialIcons name="stars" size={22} style={{ color: '#130160' }} />
							<Text className="text-lg font-bold text-gray-900 ml-2">Recommended Candidates</Text>
						</View>

						<TouchableOpacity
							activeOpacity={0.8}
							onPress={() => router.push('/(hospital)/(tabs)/allCandidates')}
							className="flex-row items-center"
						>
							<Text style={{ color: '#130160', fontWeight: '600', marginRight: 4 }}>See all</Text>
							<MaterialIcons name="arrow-forward" size={18} style={{ color: '#130160' }} />
						</TouchableOpacity>
					</View>

					{doctorsLoading && !refreshing ? (
						<View className="py-8 items-center">
							<ActivityIndicator size="large" className="text-brand-secondary" />
						</View>
					) : doctors.length === 0 ? (
						<View className="py-8 items-center bg-white rounded-2xl">
							<MaterialIcons name="people-outline" size={48} color="#9CA3AF" />
							<Text className="text-gray-500 mt-2">No candidates found</Text>
							<TouchableOpacity
								className="mt-4 bg-brand-primary px-4 py-2 rounded-lg"
								onPress={handleFindTalent}
							>
								<Text className="text-white font-semibold">Find Talent</Text>
							</TouchableOpacity>
						</View>
					) : (
						doctors.slice(0, 3).map((doctor) => (
							<CandidateCard
								key={doctor.id}
								candidate={{
									id: doctor.id,
									name: doctor.name,
									role: doctor.role,
									location: doctor.location,
									experienceYears: doctor.experienceYears,
									avatarUri: doctor.avatarUri || undefined,
									invitationStatus: doctor.invitationStatus,
									conversationId: doctor.conversationId,
								}}
								onViewProfile={(id) =>
									router.push({ pathname: '/(hospital)/candidateDetails/[id]', params: { id, mode: 'search' } })
								}
								onInvite={handleInvite}
								onMenuPress={handleMenuPress}
							/>
						))
					)}
				</View>
			</ScrollView>

			{/* Menu Modal */}
			<Modal
				visible={menuVisible}
				transparent
				animationType="fade"
				onRequestClose={() => setMenuVisible(false)}
			>
				<TouchableOpacity
					activeOpacity={1}
					onPress={() => setMenuVisible(false)}
					className="flex-1 bg-black/50 justify-end"
				>
					<View className="bg-white rounded-t-3xl p-5">
						<View className="items-center mb-4">
							<View className="w-12 h-1 bg-gray-300 rounded-full" />
						</View>

						<Text className="text-lg font-bold text-gray-900 mb-4 px-2">Options</Text>

						<TouchableOpacity
							className="flex-row items-center p-4 rounded-xl active:bg-gray-50"
							onPress={handleNotInterested}
						>
							<View className="h-10 w-10 rounded-full bg-gray-100 items-center justify-center mr-3">
								<Ionicons name="eye-off-outline" size={20} color="#4B5563" />
							</View>
							<Text className="text-base font-semibold text-gray-700">Not Interested</Text>
						</TouchableOpacity>

						<TouchableOpacity
							className="flex-row items-center p-4 rounded-xl active:bg-gray-50 mt-2"
							onPress={handleReport}
						>
							<View className="h-10 w-10 rounded-full bg-red-50 items-center justify-center mr-3">
								<Ionicons name="flag-outline" size={20} color="#EF4444" />
							</View>
							<Text className="text-base font-semibold text-red-600">Report Candidate</Text>
						</TouchableOpacity>

						<TouchableOpacity
							className="mt-4 p-4 items-center"
							onPress={() => setMenuVisible(false)}
						>
							<Text className="text-gray-500 font-semibold">Cancel</Text>
						</TouchableOpacity>
					</View>
				</TouchableOpacity>
			</Modal>
		</>
	);
}

