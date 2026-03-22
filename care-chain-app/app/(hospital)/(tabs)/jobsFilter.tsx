import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useFilterPersistence } from '../../../hooks';

type JobsFilterModalProps = {
  visible: boolean;
  onClose: () => void;
};

// Filter state interface for hospital posted jobs
interface HospitalJobsFilterState {
  status?: string;
  datePosted?: string;
  minApplicants?: number;
  maxApplicants?: number;
}

const JobsFilterModal: React.FC<JobsFilterModalProps> = ({ visible, onClose }) => {
  // Use filter persistence hook
  const { filters, saveFilters, clearFilters } = useFilterPersistence<HospitalJobsFilterState>('hospital_jobs_filters');

  // Local state for UI selections
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedDatePosted, setSelectedDatePosted] = useState<string>('');
  const [minApplicants, setMinApplicants] = useState<string>('');
  const [maxApplicants, setMaxApplicants] = useState<string>('');

  // Load existing filters when modal opens
  useEffect(() => {
    if (visible && filters) {
      if (filters.status) {
        setSelectedStatus(filters.status);
      }
      if (filters.datePosted) {
        setSelectedDatePosted(filters.datePosted);
      }
      if (filters.minApplicants !== undefined) {
        setMinApplicants(String(filters.minApplicants));
      }
      if (filters.maxApplicants !== undefined) {
        setMaxApplicants(String(filters.maxApplicants));
      }
    }
  }, [visible, filters]);

  const handleApply = async () => {
    try {
      // Parse applicant count values
      const parsedMinApplicants = minApplicants.trim() ? parseInt(minApplicants) : undefined;
      const parsedMaxApplicants = maxApplicants.trim() ? parseInt(maxApplicants) : undefined;

      // Validate applicant count range
      if (parsedMinApplicants !== undefined && parsedMaxApplicants !== undefined && parsedMinApplicants > parsedMaxApplicants) {
        Alert.alert('Invalid Range', 'Minimum applicants cannot be greater than maximum applicants.');
        return;
      }

      // Build filter state
      const filterState: HospitalJobsFilterState = {
        status: selectedStatus || undefined,
        datePosted: selectedDatePosted || undefined,
        minApplicants: parsedMinApplicants,
        maxApplicants: parsedMaxApplicants,
      };

      // Remove undefined values
      Object.keys(filterState).forEach(key => {
        if (filterState[key as keyof HospitalJobsFilterState] === undefined || filterState[key as keyof HospitalJobsFilterState] === '') {
          delete filterState[key as keyof HospitalJobsFilterState];
        }
      });

      // Save filters to AsyncStorage
      await saveFilters(filterState);
      onClose();
    } catch (error) {
      console.error('Error saving filters:', error);
      Alert.alert('Error', 'Failed to save filters. Please try again.');
    }
  };

  const handleClearAll = async () => {
    try {
      await clearFilters();
      // Reset local state
      setSelectedStatus('');
      setSelectedDatePosted('');
      setMinApplicants('');
      setMaxApplicants('');
    } catch (error) {
      console.error('Error clearing filters:', error);
      Alert.alert('Error', 'Failed to clear filters. Please try again.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl max-h-[90%]">
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-200">
            <Text className="text-lg font-bold text-gray-900">Filter Jobs</Text>
            <TouchableOpacity onPress={onClose} className="w-8 h-8 items-center justify-center">
              <Text className="text-gray-600 text-2xl">×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="px-5 py-4" contentContainerStyle={{ paddingBottom: 16 }}>
            {/* Status */}
            <View className="mb-5">
              <Text className="text-sm font-bold text-gray-900 mb-3">Status</Text>
              <View className="flex-row flex-wrap">
                {['open', 'paused', 'draft', 'expired', 'closed', 'filled'].map((status) => (
                  <TouchableOpacity
                    key={status}
                    onPress={() => setSelectedStatus(selectedStatus === status ? '' : status)}
                    className={`px-4 py-2.5 rounded-lg mr-2 mb-2 ${selectedStatus === status ? 'bg-brand-primary' : 'bg-white border border-gray-300'
                      }`}
                  >
                    <Text
                      className={`text-sm font-semibold capitalize ${selectedStatus === status ? 'text-white' : 'text-gray-700'
                        }`}
                    >
                      {status}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Date Posted */}
            <View className="mb-5">
              <Text className="text-sm font-bold text-gray-900 mb-3">Date Posted</Text>
              <View className="flex-row flex-wrap">
                {[
                  { label: 'Last 24 hours', value: 'last_24h' },
                  { label: 'Last 7 days', value: 'last_7d' },
                  { label: 'Last 30 days', value: 'last_30d' },
                  { label: 'Last 3 months', value: 'last_3m' },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setSelectedDatePosted(selectedDatePosted === option.value ? '' : option.value)}
                    className={`px-4 py-2.5 rounded-lg mr-2 mb-2 ${selectedDatePosted === option.value ? 'bg-brand-primary' : 'bg-white border border-gray-300'
                      }`}
                  >
                    <Text
                      className={`text-sm font-semibold ${selectedDatePosted === option.value ? 'text-white' : 'text-gray-700'
                        }`}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Applicant Count Range */}
            <View className="mb-5">
              <Text className="text-sm font-bold text-gray-900 mb-3">Applicant Count</Text>
              <View className="flex-row items-center space-x-3">
                <View className="flex-1">
                  <Text className="text-xs text-gray-600 mb-2">Minimum</Text>
                  <View className="bg-gray-50 rounded-lg px-4 py-3">
                    <TextInput
                      placeholder="Min"
                      value={minApplicants}
                      onChangeText={setMinApplicants}
                      keyboardType="numeric"
                      className="text-sm text-gray-700"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>
                <Text className="text-gray-400 mt-6">-</Text>
                <View className="flex-1">
                  <Text className="text-xs text-gray-600 mb-2">Maximum</Text>
                  <View className="bg-gray-50 rounded-lg px-4 py-3">
                    <TextInput
                      placeholder="Max"
                      value={maxApplicants}
                      onChangeText={setMaxApplicants}
                      keyboardType="numeric"
                      className="text-sm text-gray-700"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Clear All Button */}
            <View className="mb-4">
              <TouchableOpacity
                onPress={handleClearAll}
                className="bg-red-500 rounded-lg py-3 items-center"
              >
                <Text className="text-sm font-bold text-white">Clear All Filters</Text>
              </TouchableOpacity>
            </View>

            {/* Actions */}
            <View className="flex-row mb-2">
              <TouchableOpacity
                onPress={onClose}
                className="flex-1 bg-white border-2 border-gray-300 rounded-lg py-3.5 items-center mr-2"
              >
                <Text className="text-sm font-bold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleApply}
                className="flex-1 bg-brand-primary rounded-lg py-3.5 items-center"
              >
                <Text className="text-sm font-bold text-white">Apply</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const JobsFilterScreen: React.FC = () => {
  const router = useRouter();
  return <JobsFilterModal visible onClose={() => router.back()} />;
};

export default JobsFilterScreen;
