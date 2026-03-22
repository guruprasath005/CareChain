import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Alert, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import JobCard from '../_components/JobCard';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useJobs, Job, useJobApplication, useDebounce, useFilterPersistence, useApplications } from '../../../hooks';
import { useRouter } from 'expo-router';
import type { FilterState } from '../../../hooks/types/searchFilter.types';
import { EmptyState } from '../../_components/EmptyState';
import { SkeletonLoader } from '../../_components/SkeletonLoader';
import { Colors } from '@/constants/Colors';

const JobSearchHomeScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Use debounce hook for search query
  const debouncedSearchQuery = useDebounce(searchQuery, { delay: 500 });

  // Use filter persistence hook
  const { 
    filters, 
    saveFilters, 
    clearFilters: clearPersistedFilters, 
    loadFilters,
    error: filterError,
    clearError: clearFilterError
  } = useFilterPersistence('doctor_job_filters');

  const router = useRouter();

  // Search history management
  const SEARCH_HISTORY_KEY = 'search_history';
  const MAX_HISTORY_ITEMS = 10;

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

  const removeFromSearchHistory = async (query: string) => {
    try {
      const updatedHistory = searchHistory.filter(item => item !== query);
      setSearchHistory(updatedHistory);
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updatedHistory));
    } catch (error) {
      console.error('Error removing from search history:', error);
    }
  };

  const clearSearchHistory = async () => {
    try {
      setSearchHistory([]);
      // Hide suggestions when history becomes empty
      setShowSuggestions(false);
      await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (error) {
      console.error('Error clearing search history:', error);
    }
  };

  // Load search history on component mount
  useEffect(() => {
    loadSearchHistory();
  }, []);

  // Reload filters when screen comes into focus (returning from filter screen)
  useFocusEffect(
    React.useCallback(() => {
      loadFilters();
    }, [loadFilters])
  );

  // Debounce search to avoid too many API calls
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(value.length === 0 && searchHistory.length > 0); // Show only if history exists
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: string) => {
    // populate search box and run the search
    setSearchQuery(suggestion);
    // save the selected suggestion to history
    saveSearchHistory(suggestion);
    // hide suggestions since searching
    setShowSuggestions(false);
  };

  // Handle input focus
  const handleInputFocus = () => {
    if (!searchQuery.trim() && searchHistory.length > 0) {
      setShowSuggestions(true);
    }
  };

  // Handle input blur
  const handleInputBlur = () => {
    // Don't hide suggestions if there is history - keep them visible by default
    if (searchHistory.length === 0) {
      setTimeout(() => setShowSuggestions(false), 200);
    }
  };

  // Fetch jobs from API with search query and filters combined using AND logic (Requirement 7.1)
  // - Search query: maintained in component state, debounced for performance
  // - Filters: persisted in AsyncStorage, loaded on screen focus
  // - Both are independent: clearing one preserves the other (Requirements 7.4, 7.5)
  const {
    jobs,
    isLoading,
    error: apiError,
    refresh,
    totalCount,
    loadMore,
    hasMore
  } = useJobs({
    search: debouncedSearchQuery || undefined,
    specialization: filters.specialization || undefined,
    location: filters.location || undefined,
    jobType: filters.jobType || undefined,
    salaryMin: filters.salaryMin,
    salaryMax: filters.salaryMax,
    sortBy: sortOrder === 'desc' ? `-${sortBy}` : sortBy,
    limit: 20,
  });

  const { apply } = useJobApplication();
  const { applications } = useApplications();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Refresh jobs when screen becomes active again
  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Check if any filters are active
  const hasActiveFilters = Object.values(filters).some(value =>
    value !== '' && value !== undefined && value !== null
  );

  const showSearchResults = debouncedSearchQuery.trim().length > 0;
  
  // Clear search handler - maintains active filters (Requirement 7.5)
  const handleClearSearch = () => {
    setSearchQuery('');
    // Filters remain active in AsyncStorage and will continue to be applied
  };

  // Clear filters handler - maintains active search query (Requirement 7.4)
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
      style={{ flex: 1, backgroundColor: Colors.ui.backgroundGray }}
      contentContainerStyle={{ paddingBottom: 120 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand.primary]} />
      }
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        {showSearchResults ? (
          <TouchableOpacity
            activeOpacity={0.8}
            style={{ marginBottom: 12 }}
            onPress={handleClearSearch}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.ui.textPrimary} />
          </TouchableOpacity>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.ui.background, borderWidth: 1, borderColor: Colors.ui.inputBorder, borderRadius: 24, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingHorizontal: 16 }}>
            <Ionicons name="search" size={18} color={Colors.ui.placeholder} />
            <TextInput
              placeholder="Search jobs by title, specialization..."
              value={searchQuery}
              onChangeText={handleSearchChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onSubmitEditing={() => {
                if (searchQuery.trim()) {
                  saveSearchHistory(searchQuery.trim());
                }
              }}
              style={{ flex: 1, marginLeft: 8, paddingVertical: 12, fontSize: 14, color: Colors.ui.textPrimary }}
              placeholderTextColor={Colors.ui.placeholder}
            />
            {searchQuery.trim().length > 0 ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleClearSearch}
                style={{ paddingHorizontal: 8, paddingVertical: 8 }}
              >
                <Ionicons name="close" size={18} color={Colors.ui.placeholder} />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            onPress={() => router.push('./fillter')}
            activeOpacity={0.9}
            style={{ backgroundColor: Colors.brand.primary, paddingHorizontal: 20, paddingVertical: 12, position: 'relative' }}
          >
            <Ionicons name="options-outline" size={20} color={Colors.ui.background} />
            {hasActiveFilters && (
              <View style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, backgroundColor: '#EF4444', borderRadius: 8, borderWidth: 2, borderColor: Colors.ui.background, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: Colors.ui.background, fontSize: 8, fontWeight: 'bold' }}>
                  {Object.values(filters).filter(v => v !== '' && v !== undefined && v !== null).length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          {hasActiveFilters && (
            <TouchableOpacity
              onPress={handleClearFilters}
              activeOpacity={0.8}
              style={{ backgroundColor: '#EF4444', paddingHorizontal: 16, paddingVertical: 12, borderTopLeftRadius: 8, flexDirection: 'row', alignItems: 'center' }}
            >
              {isLoading && jobs.length > 0 ? (
                <ActivityIndicator size="small" color={Colors.ui.background} />
              ) : (
                <Text style={{ color: Colors.ui.background, fontSize: 12, fontWeight: '600' }}>Clear</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Error Notification */}
        {filterError && (
          <View style={{ marginTop: 12, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FDBA74', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'flex-start' }}>
            <Ionicons name="warning-outline" size={20} color="#F97316" />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={{ color: '#7C2D12', fontWeight: '600', fontSize: 14 }}>Filter Storage Issue</Text>
              <Text style={{ color: '#C2410C', fontSize: 12, marginTop: 4 }}>
                {filterError}. Your filters are active but may not persist after closing the app.
              </Text>
            </View>
            <TouchableOpacity onPress={clearFilterError} style={{ marginLeft: 8 }}>
              <Ionicons name="close" size={18} color="#F97316" />
            </TouchableOpacity>
          </View>
        )}

        {/* Search Suggestions */}
        {showSuggestions && searchHistory.length > 0 && (
          <View style={{ backgroundColor: Colors.ui.background, borderWidth: 1, borderColor: Colors.ui.inputBorder, borderRadius: 8, marginTop: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.ui.inputBorder }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.ui.textPrimary }}>Recent Searches</Text>
              {searchHistory.length > 0 && (
                <TouchableOpacity
                  onPress={clearSearchHistory}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 12, color: '#EF4444', fontWeight: '500' }}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>
            {searchHistory.length > 0 ? (
              searchHistory.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleSuggestionSelect(item)}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: index < searchHistory.length - 1 ? 1 : 0, borderBottomColor: Colors.ui.backgroundGray }}
                >
                  <Ionicons name="time-outline" size={16} color={Colors.ui.placeholder} />
                  <Text style={{ fontSize: 14, color: Colors.ui.textPrimary, marginLeft: 12, flex: 1 }}>{item}</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.ui.placeholder} />
                </TouchableOpacity>
              ))
            ) : (
              <View style={{ paddingHorizontal: 16, paddingVertical: 24, alignItems: 'center' }}>
                <Ionicons name="time-outline" size={24} color={Colors.ui.placeholder} />
                <Text style={{ fontSize: 14, color: Colors.ui.textSecondary, marginTop: 8 }}>No recent searches</Text>
              </View>
            )}
          </View>
        )}

        {/* Jobs Header */}
        <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: Colors.ui.textPrimary }}>
              {showSearchResults ? 'Search Results' : 'Available Jobs'}
            </Text>
            {isLoading && jobs.length > 0 && (
              <ActivityIndicator size="small" color={Colors.brand.primary} style={{ marginLeft: 8 }} />
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => setShowSortModal(true)}
              activeOpacity={0.8}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.ui.background, borderWidth: 1, borderColor: Colors.ui.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 }}
            >
              <Ionicons name="swap-vertical" size={16} color={Colors.ui.textPrimary} />
              <Text style={{ fontSize: 12, color: Colors.ui.textPrimary, marginLeft: 4, fontWeight: '500' }}>Sort</Text>
            </TouchableOpacity>
            {!isLoading && (
              <Text style={{ fontSize: 12, color: Colors.ui.textSecondary, marginRight: 12 }}>
                {totalCount} jobs
              </Text>
            )}
            {hasMore && !isLoading && (
              <TouchableOpacity onPress={loadMore} activeOpacity={0.8}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.brand.tertiary }}>Load More</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Jobs List */}
        <View style={{ marginTop: 16 }}>
          {isLoading && jobs.length === 0 ? (
            <SkeletonLoader variant="card" count={3} />
          ) : errorDetails ? (
            <EmptyState
              type="error"
              title={errorDetails.title}
              message={errorDetails.message}
              onRetry={refresh}
            />
          ) : jobs.length === 0 ? (
            <EmptyState
              type={showSearchResults && hasActiveFilters ? 'no-combined-results' : showSearchResults ? 'no-search-results' : hasActiveFilters ? 'no-filter-results' : 'no-data'}
              icon="briefcase-outline"
              title="No jobs found"
              message={
                showSearchResults && hasActiveFilters
                  ? 'No jobs match your search and filter criteria'
                  : showSearchResults
                  ? 'Try a different search term'
                  : hasActiveFilters
                  ? 'Try adjusting your filters'
                  : 'Check back later for new opportunities'
              }
              showSearchButton={showSearchResults}
              showFilterButton={hasActiveFilters}
              onClearSearch={showSearchResults ? handleClearSearch : undefined}
              onClearFilters={hasActiveFilters ? handleClearFilters : undefined}
            />
          ) : (
            jobs.map((job: Job) => {
              // Find if user has applied to this job
              const applicationForJob = applications.find(app => app.jobId === job.id);
              const applicationStatus = applicationForJob?.status || null;
              
              return (
                <View key={job.id} style={{ marginBottom: 12 }}>
                  <JobCard
                    title={job.title}
                    hospital={job.hospital}
                    location={job.location}
                    experience={job.experience}
                    salary={job.salary}
                    avatar={job.avatar || `https://api.dicebear.com/7.x/shapes/png?seed=${job.id}`}
                    applicationStatus={applicationStatus}
                    onViewProfile={() =>
                      router.push({
                        pathname: '/(doctor)/(tabs)/jobDetails',
                        params: { id: job.id },
                      })
                    }
                    onInvite={() => {
                      Alert.alert(
                        'Apply for Job',
                        `Apply for "${job.title}" at ${job.hospital}?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Apply',
                            onPress: async () => {
                              const result = await apply(job.id);
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
                    }}
                  />
                </View>
              );
            })
          )}
        </View>
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
          style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' }}
        >
          <TouchableOpacity activeOpacity={1} style={{ backgroundColor: Colors.ui.background, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <View style={{ paddingHorizontal: 16, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: Colors.ui.inputBorder }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: Colors.ui.textPrimary }}>Sort By</Text>
                <TouchableOpacity onPress={() => setShowSortModal(false)}>
                  <Ionicons name="close" size={24} color={Colors.ui.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
              {/* Date Posted */}
              <TouchableOpacity
                onPress={() => {
                  if (sortBy === 'createdAt') {
                    setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                  } else {
                    setSortBy('createdAt');
                    setSortOrder('desc');
                  }
                }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.ui.inputBorder }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="calendar-outline" size={20} color={Colors.ui.textSecondary} />
                  <Text style={{ fontSize: 16, color: Colors.ui.textPrimary, marginLeft: 12 }}>Date Posted</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {sortBy === 'createdAt' && (
                    <>
                      <Text style={{ fontSize: 14, color: Colors.brand.tertiary, marginRight: 8 }}>
                        {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
                      </Text>
                      <Ionicons
                        name={sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'}
                        size={18}
                        color={Colors.brand.tertiary}
                      />
                    </>
                  )}
                </View>
              </TouchableOpacity>

              {/* Salary */}
              <TouchableOpacity
                onPress={() => {
                  if (sortBy === 'compensation.amount') {
                    setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                  } else {
                    setSortBy('compensation.amount');
                    setSortOrder('desc');
                  }
                }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.ui.inputBorder }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="cash-outline" size={20} color={Colors.ui.textSecondary} />
                  <Text style={{ fontSize: 16, color: Colors.ui.textPrimary, marginLeft: 12 }}>Salary</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {sortBy === 'compensation.amount' && (
                    <>
                      <Text style={{ fontSize: 14, color: Colors.brand.tertiary, marginRight: 8 }}>
                        {sortOrder === 'desc' ? 'Highest First' : 'Lowest First'}
                      </Text>
                      <Ionicons
                        name={sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'}
                        size={18}
                        color={Colors.brand.tertiary}
                      />
                    </>
                  )}
                </View>
              </TouchableOpacity>

              {/* Experience Required */}
              <TouchableOpacity
                onPress={() => {
                  if (sortBy === 'requirements.minimumExperience') {
                    setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                  } else {
                    setSortBy('requirements.minimumExperience');
                    setSortOrder('desc');
                  }
                }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="briefcase-outline" size={20} color={Colors.ui.textSecondary} />
                  <Text style={{ fontSize: 16, color: Colors.ui.textPrimary, marginLeft: 12 }}>Experience Required</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {sortBy === 'requirements.minimumExperience' && (
                    <>
                      <Text style={{ fontSize: 14, color: Colors.brand.tertiary, marginRight: 8 }}>
                        {sortOrder === 'desc' ? 'Most First' : 'Least First'}
                      </Text>
                      <Ionicons
                        name={sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'}
                        size={18}
                        color={Colors.brand.tertiary}
                      />
                    </>
                  )}
                </View>
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 1, borderTopColor: Colors.ui.inputBorder }}>
              <TouchableOpacity
                onPress={() => setShowSortModal(false)}
                style={{ backgroundColor: Colors.brand.tertiary, borderRadius: 8, paddingVertical: 12, alignItems: 'center' }}
              >
                <Text style={{ color: Colors.ui.background, fontWeight: '600', fontSize: 16 }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
};

export default JobSearchHomeScreen;