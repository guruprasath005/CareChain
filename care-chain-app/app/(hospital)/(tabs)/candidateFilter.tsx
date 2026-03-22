import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useFilterPersistence } from '../../../hooks';

interface HospitalCandidateFilters {
  specialization?: string;
  city?: string;
  state?: string;
  minExperience?: number;
  maxExperience?: number;
  skills?: string[];
  isAvailable?: boolean;
}

type CandidateFilterModalProps = {
  visible: boolean;
  onClose: () => void;
};

const CandidateFilterModal: React.FC<CandidateFilterModalProps> = ({ visible, onClose }) => {
  // Use filter persistence hook with hospital candidate filters key
  const { filters, saveFilters, clearFilters } = useFilterPersistence('hospital_candidate_filters');

  // Local state for UI selections
  const [selectedSpecialization, setSelectedSpecialization] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [minExperience, setMinExperience] = useState<string>('');
  const [maxExperience, setMaxExperience] = useState<string>('');
  const [skills, setSkills] = useState('');
  const [isAvailable, setIsAvailable] = useState<boolean | undefined>(undefined);

  // Load existing filters when modal opens
  useEffect(() => {
    if (visible && filters) {
      // Set specialization
      if (filters.specialization) {
        setSelectedSpecialization(filters.specialization);
      }

      // Set location
      if (filters.city) {
        setCity(filters.city);
      }
      if (filters.state) {
        setState(filters.state);
      }

      // Set experience range
      if (filters.minExperience !== undefined) {
        setMinExperience(String(filters.minExperience));
      }
      if (filters.maxExperience !== undefined) {
        setMaxExperience(String(filters.maxExperience));
      }

      // Set skills
      if (filters.skills && Array.isArray(filters.skills)) {
        setSkills(filters.skills.join(', '));
      }

      // Set availability
      if (filters.isAvailable !== undefined) {
        setIsAvailable(filters.isAvailable);
      }
    }
  }, [visible, filters]);

  const handleApply = async () => {
    try {
      // Parse experience values
      const parsedMinExperience = minExperience.trim() ? parseInt(minExperience) : undefined;
      const parsedMaxExperience = maxExperience.trim() ? parseInt(maxExperience) : undefined;

      // Validate experience range
      if (parsedMinExperience !== undefined && parsedMaxExperience !== undefined && parsedMinExperience > parsedMaxExperience) {
        Alert.alert('Invalid Range', 'Minimum experience cannot be greater than maximum experience.');
        return;
      }

      // Validate experience values are non-negative
      if (parsedMinExperience !== undefined && parsedMinExperience < 0) {
        Alert.alert('Invalid Value', 'Minimum experience cannot be negative.');
        return;
      }
      if (parsedMaxExperience !== undefined && parsedMaxExperience < 0) {
        Alert.alert('Invalid Value', 'Maximum experience cannot be negative.');
        return;
      }

      // Parse skills (comma-separated)
      const skillsArray = skills.trim()
        ? skills.split(',').map(s => s.trim()).filter(s => s.length > 0)
        : undefined;

      // Build filter state
      const filterState: HospitalCandidateFilters = {
        specialization: selectedSpecialization.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        minExperience: parsedMinExperience,
        maxExperience: parsedMaxExperience,
        skills: skillsArray,
        isAvailable: isAvailable,
      };

      // Remove undefined values
      Object.keys(filterState).forEach(key => {
        if (filterState[key as keyof HospitalCandidateFilters] === undefined || filterState[key as keyof HospitalCandidateFilters] === '') {
          delete filterState[key as keyof HospitalCandidateFilters];
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
      setSelectedSpecialization('');
      setCity('');
      setState('');
      setMinExperience('');
      setMaxExperience('');
      setSkills('');
      setIsAvailable(undefined);
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
            <Text className="text-lg font-bold text-gray-900">Filter Candidates</Text>
            <TouchableOpacity onPress={onClose} className="w-8 h-8 items-center justify-center">
              <Text className="text-gray-600 text-2xl">×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="px-5 py-4" contentContainerStyle={{ paddingBottom: 16 }}>
            {/* Specialization */}
            <View className="mb-5">
              <Text className="text-sm font-bold text-gray-900 mb-3">Specialization</Text>
              <View className="flex-row items-center bg-gray-50 rounded-lg px-4 py-3">
                <TextInput
                  placeholder="e.g., Cardiology, Neurology"
                  value={selectedSpecialization}
                  onChangeText={setSelectedSpecialization}
                  className="flex-1 text-sm text-gray-700"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            {/* Location - City */}
            <View className="mb-5">
              <Text className="text-sm font-bold text-gray-900 mb-3">City</Text>
              <View className="flex-row items-center bg-gray-50 rounded-lg px-4 py-3">
                <Text className="text-gray-400 mr-2">📍</Text>
                <TextInput
                  placeholder="e.g., Mumbai, Delhi"
                  value={city}
                  onChangeText={setCity}
                  className="flex-1 text-sm text-gray-700"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            {/* Location - State */}
            <View className="mb-5">
              <Text className="text-sm font-bold text-gray-900 mb-3">State</Text>
              <View className="flex-row items-center bg-gray-50 rounded-lg px-4 py-3">
                <Text className="text-gray-400 mr-2">📍</Text>
                <TextInput
                  placeholder="e.g., Maharashtra, Delhi"
                  value={state}
                  onChangeText={setState}
                  className="flex-1 text-sm text-gray-700"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            {/* Experience Range */}
            <View className="mb-5">
              <Text className="text-sm font-bold text-gray-900 mb-3">Experience (in years)</Text>
              <View className="flex-row items-center space-x-3">
                <View className="flex-1">
                  <Text className="text-xs text-gray-600 mb-2">Minimum</Text>
                  <View className="bg-gray-50 rounded-lg px-4 py-3">
                    <TextInput
                      placeholder="Min"
                      value={minExperience}
                      onChangeText={setMinExperience}
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
                      value={maxExperience}
                      onChangeText={setMaxExperience}
                      keyboardType="numeric"
                      className="text-sm text-gray-700"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Skills */}
            <View className="mb-5">
              <Text className="text-sm font-bold text-gray-900 mb-3">Skills</Text>
              <View className="flex-row items-center bg-gray-50 rounded-lg px-4 py-3">
                <TextInput
                  placeholder="e.g., Surgery, Emergency Care (comma-separated)"
                  value={skills}
                  onChangeText={setSkills}
                  className="flex-1 text-sm text-gray-700"
                  placeholderTextColor="#9CA3AF"
                  multiline
                />
              </View>
              <Text className="text-xs text-gray-500 mt-1">Separate multiple skills with commas</Text>
            </View>

            {/* Availability */}
            <View className="mb-5">
              <Text className="text-sm font-bold text-gray-900 mb-3">Availability</Text>
              <View className="flex-row">
                <TouchableOpacity
                  onPress={() => setIsAvailable(true)}
                  className={`px-6 py-2.5 rounded-lg mr-2 ${isAvailable === true ? 'bg-brand-primary' : 'bg-white border border-gray-300'
                    }`}
                >
                  <Text
                    className={`text-sm font-semibold ${isAvailable === true ? 'text-white' : 'text-gray-700'
                      }`}
                  >
                    Available
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsAvailable(false)}
                  className={`px-6 py-2.5 rounded-lg mr-2 ${isAvailable === false ? 'bg-brand-primary' : 'bg-white border border-gray-300'
                    }`}
                >
                  <Text
                    className={`text-sm font-semibold ${isAvailable === false ? 'text-white' : 'text-gray-700'
                      }`}
                  >
                    Not Available
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsAvailable(undefined)}
                  className={`px-6 py-2.5 rounded-lg ${isAvailable === undefined ? 'bg-brand-primary' : 'bg-white border border-gray-300'
                    }`}
                >
                  <Text
                    className={`text-sm font-semibold ${isAvailable === undefined ? 'text-white' : 'text-gray-700'
                      }`}
                  >
                    Any
                  </Text>
                </TouchableOpacity>
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

const CandidateFilterScreen: React.FC = () => {
  const router = useRouter();
  return <CandidateFilterModal visible onClose={() => router.back()} />;
};

export default CandidateFilterScreen;
