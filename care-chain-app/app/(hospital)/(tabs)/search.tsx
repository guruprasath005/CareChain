import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';

import CandidateCard from '../components/CandidateCard';
import { useSearchDoctors, useDebounce, useFilterPersistence } from '../../../hooks';
import { EmptyState } from '../../_components/EmptyState';
import { SkeletonLoader } from '../../_components/SkeletonLoader';

export default function HospitalSearchScreen() {
	const router = useRouter();
	const [searchQuery, setSearchQuery] = useState('');
	const [refreshing, setRefreshing] = useState(false);
	const [searchHistory, setSearchHistory] = useState<string[]>([]);
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [showSortModal, setShowSortModal] = useState(false);
	const [sortBy, setSortBy] = useState<string>('doctorProfile.yearsOfExperience');
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

	// Search history management
	const SEARCH_HISTORY_KEY = 'hospital_search_history';
	const MAX_HISTORY_ITEMS = 10;

	// Use filter persistence hook
	const {
		filters,
		clearFilters: clearPersistedFilters,
		loadFilters,
		error: filterError,
		clearError: clearFilterError
	} = useFilterPersistence('hospital_candidate_filters');

	// Debounce search query to avoid too many API calls
	const debouncedSearchQuery = useDebounce(searchQuery, { delay: 500 });

	// Load search history on component mount
	const loadSearchHistory = async () => {
		try {
			const history = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
			if (history) {
				const parsed = JSON.parse(history);
				setSearchHistory(parsed);
				setShowSuggestions(Array.isArray(parsed) && parsed.length > 0);
			} else {
				setShowSuggestions(false);
			}
		} catch (error) {
			console.error('Error loading search history:', error);
		}
	};

	const saveSearchHistory = async (query: string) => {
		if (!query.trim()) return;

		try {
			const updatedHistory = [query, ...searchHistory.filter(item => item !== query)].slice(0, MAX_HISTORY_ITEMS);
			setSearchHistory(updatedHistory);
			await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updatedHistory));
		} catch (error) {
			console.error('Error saving search history:', error);
		}
	};

	const clearSearchHistory = async () => {
		try {
			setSearchHistory([]);
			setShowSuggestions(false);
			await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
		} catch (error) {
			console.error('Error clearing search history:', error);
		}
	};

	useEffect(() => {
		loadSearchHistory();
	}, []);

	// Reload filters when screen comes into focus (returning from filter screen)
	useFocusEffect(
		React.useCallback(() => {
			loadFilters();
		}, [loadFilters])
	);

	const { doctors, isLoading, error: apiError, refresh, totalCount } = useSearchDoctors({
		q: debouncedSearchQuery || undefined,
		specialization: filters.specialization || undefined,
		city: filters.city || undefined,
		state: filters.state || undefined,
		minExperience: filters.minExperience,
		maxExperience: filters.maxExperience,
		isAvailable: filters.isAvailable,
		sortBy: sortOrder === 'desc' ? `-${sortBy}` : sortBy,
		limit: 20,
	});

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await refresh();
		setRefreshing(false);
	}, [refresh]);

	const handleSearchChange = (value: string) => {
		setSearchQuery(value);
		setShowSuggestions(value.length === 0 && searchHistory.length > 0);
	};

	const handleSuggestionSelect = (suggestion: string) => {
		setSearchQuery(suggestion);
		saveSearchHistory(suggestion);
		setShowSuggestions(false);
	};

	const handleInputFocus = () => {
		if (!searchQuery.trim() && searchHistory.length > 0) {
			setShowSuggestions(true);
		}
	};

	const handleInputBlur = () => {
		if (searchHistory.length === 0) {
			setTimeout(() => setShowSuggestions(false), 200);
		}
	};

	const handleClearSearch = useCallback(() => {
		setSearchQuery('');
		// Filters remain active in AsyncStorage and will continue to be applied
	}, []);

	// Clear filters handler - maintains active search query
	const handleClearFilters = async () => {
		try {
			clearFilterError(); // Clear any previous errors
			await clearPersistedFilters();
			// Search query remains in component state and will continue to be applied
		} catch (error) {
			console.error('Error clearing filters:', error);
			Alert.alert(
				'Filter Error',
				'Failed to clear filters from storage. Filters have been cleared from memory.',
				[{ text: 'OK' }]
			);
		}
	};

	// Check if any filters are active
	const hasActiveFilters = Object.values(filters).some(value =>
		value !== '' && value !== undefined && value !== null &&
		!(Array.isArray(value) && value.length === 0)
	);

	const showSearchResults = debouncedSearchQuery.trim().length > 0;

	// Determine error type and message (Requirement 10.5, 10.6, 10.7)
	const getErrorDetails = () => {
		if (!apiError) return null;

		const errorLower = apiError.toLowerCase();

		// Network errors (Requirement 10.6)
		if (errorLower.includes('network') || errorLower.includes('connection') || errorLower.includes('fetch')) {
			return {
				type: 'network',
				title: 'Connection Error',
				message: 'Unable to connect. Please check your internet connection and try again.',
			};
		}

		// Rate limiting (Requirement 10.5)
		if (errorLower.includes('too many') || errorLower.includes('rate limit')) {
			return {
				type: 'rate_limit',
				title: 'Too Many Requests',
				message: 'Please wait a moment before trying again.',
			};
		}

		// Generic API error (Requirement 10.5)
		return {
			type: 'api',
			title: 'Error',
			message: apiError,
		};
	};

	const errorDetails = getErrorDetails();

	return (
		<ScrollView
			className="flex-1 bg-gray-50"
			contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
			refreshControl={
				<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
			}
		>
			<View className="flex-row items-center bg-white border border-gray-200 rounded-full overflow-hidden">
				<View className="flex-row items-center flex-1 px-4">
					<Ionicons name="search" size={18} color="#9CA3AF" />
					<TextInput
						value={searchQuery}
						onChangeText={handleSearchChange}
						onFocus={handleInputFocus}
						onBlur={handleInputBlur}
						onSubmitEditing={() => {
							if (searchQuery.trim()) {
								saveSearchHistory(searchQuery.trim());
							}
						}}
						placeholder="Search candidates by name, role, location"
						placeholderTextColor="#9CA3AF"
						className="flex-1 ml-2 py-3 text-sm text-gray-700"
					/>
					{searchQuery.trim().length > 0 ? (
						<TouchableOpacity activeOpacity={0.85} onPress={handleClearSearch} className="p-2">
							<Ionicons name="close" size={18} color="#9CA3AF" />
						</TouchableOpacity>
					) : null}
				</View>

				<TouchableOpacity
					onPress={() => router.push('./candidateFilter')}
					activeOpacity={0.9}
					className="bg-brand-primary px-5 py-3 relative"
				>
					<Ionicons name="options-outline" size={20} color="#ffffff" />
					{hasActiveFilters && (
						<View className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white items-center justify-center">
							<Text className="text-white text-[8px] font-bold">
								{Object.values(filters).filter(v => {
									if (v === '' || v === undefined || v === null) return false;
									if (Array.isArray(v) && v.length === 0) return false;
									return true;
								}).length}
							</Text>
						</View>
					)}
				</TouchableOpacity>
				{hasActiveFilters && (
					<TouchableOpacity
						onPress={handleClearFilters}
						activeOpacity={0.8}
						className="bg-red-500 px-4 py-3 rounded-l-lg flex-row items-center"
					>
						{isLoading && doctors.length > 0 ? (
							<ActivityIndicator size="small" color="#ffffff" />
						) : (
							<Text className="text-white text-xs font-semibold">Clear</Text>
						)}
					</TouchableOpacity>
				)}
			</View>

			{/* Filter Error Notification */}
			{filterError && (
				<View className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-3 flex-row items-start">
					<Ionicons name="warning-outline" size={20} color="#F97316" />
					<View className="flex-1 ml-2">
						<Text className="text-orange-900 font-semibold text-sm">Filter Storage Issue</Text>
						<Text className="text-orange-700 text-xs mt-1">
							{filterError}. Your filters are active but may not persist after closing the app.
						</Text>
					</View>
					<TouchableOpacity onPress={clearFilterError} className="ml-2">
						<Ionicons name="close" size={18} color="#F97316" />
					</TouchableOpacity>
				</View>
			)}

			{/* Search Suggestions */}
			{showSuggestions && searchHistory.length > 0 && (
				<View className="bg-white border border-gray-200 rounded-lg mt-2 shadow-sm">
					<View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
						<Text className="text-sm font-semibold text-gray-900">Recent Searches</Text>
						{searchHistory.length > 0 && (
							<TouchableOpacity
								onPress={clearSearchHistory}
								activeOpacity={0.8}
							>
								<Text className="text-xs text-red-600 font-medium">Clear All</Text>
							</TouchableOpacity>
						)}
					</View>
					{searchHistory.map((item, index) => (
						<TouchableOpacity
							key={index}
							onPress={() => handleSuggestionSelect(item)}
							activeOpacity={0.7}
							className="flex-row items-center px-4 py-3 border-b border-gray-50 last:border-b-0"
						>
							<Ionicons name="time-outline" size={16} color="#9CA3AF" />
							<Text className="text-sm text-gray-700 ml-3 flex-1">{item}</Text>
							<Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
						</TouchableOpacity>
					))}
				</View>
			)}

			<View className="mt-5 flex-row items-center justify-between">
				<View className="flex-row items-center">
					<Text className="text-sm font-bold text-gray-900">
						{showSearchResults ? 'Search Results' : 'Doctors'}
					</Text>
					{isLoading && doctors.length > 0 && (
						<ActivityIndicator size="small" className="text-brand-secondary ml-2" />
					)}
				</View>
				<View className="flex-row items-center">
					<TouchableOpacity
						onPress={() => setShowSortModal(true)}
						activeOpacity={0.8}
						className="flex-row items-center bg-white border border-gray-200 rounded-lg px-3 py-2 mr-2"
					>
						<Ionicons name="swap-vertical" size={16} color="#374151" />
						<Text className="text-xs text-gray-700 ml-1 font-medium">Sort</Text>
					</TouchableOpacity>
					{!isLoading && (
						<Text className="text-xs text-gray-500">
							{totalCount} doctors found
						</Text>
					)}
				</View>
			</View>

			<View className="mt-2">
				{!isLoading && (
					<Text className="text-xs text-gray-500">
						Tap a profile to view details.
					</Text>
				)}
			</View>

			<View className="mt-4">
				{isLoading && doctors.length === 0 ? (
					<SkeletonLoader variant="card" count={3} />
				) : errorDetails ? (
					<EmptyState
						type="error"
						title={errorDetails.title}
						message={errorDetails.message}
						onRetry={refresh}
					/>
				) : doctors.length === 0 ? (
					<EmptyState
						type={showSearchResults && hasActiveFilters ? 'no-combined-results' : showSearchResults ? 'no-search-results' : hasActiveFilters ? 'no-filter-results' : 'no-data'}
						icon="people-outline"
						title="No candidates found"
						message={
							showSearchResults && hasActiveFilters
								? 'No candidates match your search and filter criteria'
								: showSearchResults
									? 'Try a different search term'
									: hasActiveFilters
										? 'Try adjusting your filters'
										: 'No doctors are currently registered'
						}
						showSearchButton={showSearchResults}
						showFilterButton={hasActiveFilters}
						onClearSearch={showSearchResults ? handleClearSearch : undefined}
						onClearFilters={hasActiveFilters ? handleClearFilters : undefined}
					/>
				) : (
					doctors.map((doctor) => (
						<CandidateCard
							key={doctor.id}
							candidate={{
								id: doctor.id,
								name: doctor.name,
								role: doctor.role,
								location: doctor.location,
								experienceYears: doctor.experienceYears,
								avatarUri: doctor.avatarUri || undefined,
							}}
							onViewProfile={(id) =>
								router.push({ pathname: '/(hospital)/candidateDetails/[id]', params: { id, mode: 'search' } })
							}
							onInvite={(id) =>
								router.push({
									pathname: '/(hospital)/candidateDetails/[id]',
									params: { id, mode: 'search', initialAction: 'invite' }
								})
							}
						/>
					))
				)}
			</View>

			{/* Sort Modal */}
			<Modal
				visible={showSortModal}
				transparent={true}
				animationType="fade"
				onRequestClose={() => setShowSortModal(false)}
			>
				<TouchableOpacity
					activeOpacity={1}
					onPress={() => setShowSortModal(false)}
					className="flex-1 bg-black/50 justify-end"
				>
					<TouchableOpacity activeOpacity={1} className="bg-white rounded-t-3xl">
						<View className="px-4 py-5 border-b border-gray-100">
							<View className="flex-row items-center justify-between">
								<Text className="text-lg font-bold text-gray-900">Sort By</Text>
								<TouchableOpacity onPress={() => setShowSortModal(false)}>
									<Ionicons name="close" size={24} color="#6B7280" />
								</TouchableOpacity>
							</View>
						</View>

						<View className="px-4 py-3">
							{/* Experience */}
							<TouchableOpacity
								onPress={() => {
									if (sortBy === 'doctorProfile.yearsOfExperience') {
										setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
									} else {
										setSortBy('doctorProfile.yearsOfExperience');
										setSortOrder('desc');
									}
								}}
								className="flex-row items-center justify-between py-4 border-b border-gray-100"
							>
								<View className="flex-row items-center">
									<Ionicons name="briefcase-outline" size={20} color="#6B7280" />
									<Text className="text-base text-gray-900 ml-3">Experience</Text>
								</View>
								<View className="flex-row items-center">
									{sortBy === 'doctorProfile.yearsOfExperience' && (
										<>
											<Text className="text-sm text-blue-600 mr-2">
												{sortOrder === 'desc' ? 'Most First' : 'Least First'}
											</Text>
											<Ionicons
												name={sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'}
												size={18}
												className="text-brand-tertiary"
											/>
										</>
									)}
								</View>
							</TouchableOpacity>

							{/* Date Registered */}
							<TouchableOpacity
								onPress={() => {
									if (sortBy === 'createdAt') {
										setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
									} else {
										setSortBy('createdAt');
										setSortOrder('desc');
									}
								}}
								className="flex-row items-center justify-between py-4 border-b border-gray-100"
							>
								<View className="flex-row items-center">
									<Ionicons name="calendar-outline" size={20} color="#6B7280" />
									<Text className="text-base text-gray-900 ml-3">Date Registered</Text>
								</View>
								<View className="flex-row items-center">
									{sortBy === 'createdAt' && (
										<>
											<Text className="text-sm text-blue-600 mr-2">
												{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
											</Text>
											<Ionicons
												name={sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'}
												size={18}
												className="text-brand-tertiary"
											/>
										</>
									)}
								</View>
							</TouchableOpacity>

							{/* Availability */}
							<TouchableOpacity
								onPress={() => {
									if (sortBy === 'doctorProfile.isAvailable') {
										setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
									} else {
										setSortBy('doctorProfile.isAvailable');
										setSortOrder('desc');
									}
								}}
								className="flex-row items-center justify-between py-4"
							>
								<View className="flex-row items-center">
									<Ionicons name="checkmark-circle-outline" size={20} color="#6B7280" />
									<Text className="text-base text-gray-900 ml-3">Availability</Text>
								</View>
								<View className="flex-row items-center">
									{sortBy === 'doctorProfile.isAvailable' && (
										<>
											<Text className="text-sm text-blue-600 mr-2">
												{sortOrder === 'desc' ? 'Available First' : 'Unavailable First'}
											</Text>
											<Ionicons
												name={sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'}
												size={18}
												className="text-brand-tertiary"
											/>
										</>
									)}
								</View>
							</TouchableOpacity>
						</View>

						<View className="px-4 py-4 border-t border-gray-100">
							<TouchableOpacity
								onPress={() => setShowSortModal(false)}
								className="bg-brand-primary rounded-lg py-3 items-center"
							>
								<Text className="text-white font-semibold text-base">Apply</Text>
							</TouchableOpacity>
						</View>
					</TouchableOpacity>
				</TouchableOpacity>
			</Modal>
		</ScrollView>
	);
}

