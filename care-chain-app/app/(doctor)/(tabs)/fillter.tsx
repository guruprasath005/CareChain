import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFilterPersistence } from '../../../hooks';
import type { FilterState } from '../../../hooks/types/searchFilter.types';
import { Colors } from '@/constants/Colors';
import ENV from '@/config/env';

type JobFilterModalProps = {
  visible: boolean;
  onClose: () => void;
};

const JobFilterModal: React.FC<JobFilterModalProps> = ({ visible, onClose }) => {
  // Use filter persistence hook
  const { filters, saveFilters, clearFilters } = useFilterPersistence('doctor_job_filters');
  
  // Local state for UI selections
  const [selectedJobType, setSelectedJobType] = useState<string>('');
  const [selectedPaymentType, setSelectedPaymentType] = useState<string>('');
  const [selectedSalaryRange, setSelectedSalaryRange] = useState<string>('');
  const [minSalary, setMinSalary] = useState<number>(5);
  const [maxSalary, setMaxSalary] = useState<number>(40);
  const [locationSearch, setLocationSearch] = useState<string>('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedShift, setSelectedShift] = useState<string>('');
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [loadingLocations, setLoadingLocations] = useState<boolean>(false);

  // Fetch available locations from jobs
  useEffect(() => {
    const fetchLocations = async () => {
      if (!visible) return;
      
      setLoadingLocations(true);
      try {
        // Fetch jobs to get unique locations
        const response = await fetch(`${ENV.API_URL}/jobs?limit=1000`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.jobs) {
            // Extract unique locations from jobs
            const locations = [...new Set(
              data.data.jobs
                .map((job: any) => job.location)
                .filter((loc: string) => loc && loc.trim())
            )].sort();
            setAvailableLocations(locations);
          }
        }
      } catch (error) {
        console.error('Error fetching locations:', error);
        // Fallback to empty array if fetch fails
        setAvailableLocations([]);
      } finally {
        setLoadingLocations(false);
      }
    };

    fetchLocations();
  }, [visible]);

  // Filter locations based on search
  const filteredLocations = availableLocations.filter(loc =>
    loc.toLowerCase().includes(locationSearch.toLowerCase())
  );

  // Load existing filters when modal opens
  useEffect(() => {
    if (visible && filters) {
      // Map backend job types to frontend
      if (filters.jobType === 'full_time') {
        setSelectedJobType('Long Term');
      } else if (filters.jobType === 'part_time') {
        setSelectedJobType('Short Time');
      }
      
      // Set location
      if (filters.location) {
        setSelectedLocations([filters.location]);
      }
      
      // Set salary range
      if (filters.salaryMin !== undefined) {
        setMinSalary(filters.salaryMin);
      }
      if (filters.salaryMax !== undefined) {
        setMaxSalary(filters.salaryMax);
      }
    }
  }, [visible, filters]);

  const toggleLocation = (location: string) => {
    if (selectedLocations.includes(location)) {
      setSelectedLocations(selectedLocations.filter(loc => loc !== location));
    } else {
      setSelectedLocations([...selectedLocations, location]);
    }
  };

  const handleApply = async () => {
    try {
      // Map frontend job types to backend
      let backendJobType = '';
      if (selectedJobType === 'Long Term') backendJobType = 'full_time';
      else if (selectedJobType === 'Short Time') backendJobType = 'part_time';

      // Validate salary range
      if (minSalary > maxSalary) {
        Alert.alert('Invalid Range', 'Minimum salary cannot be greater than maximum salary.');
        return;
      }

      // Build filter state
      const filterState: FilterState = {
        jobType: backendJobType || undefined,
        location: selectedLocations.length > 0 ? selectedLocations.join(', ') : undefined,
        salaryMin: minSalary || undefined,
        salaryMax: maxSalary || undefined,
      };
      
      // Remove undefined values
      Object.keys(filterState).forEach(key => {
        const value = filterState[key as keyof FilterState];
        if (value === undefined || value === '' || value === null) {
          delete filterState[key as keyof FilterState];
        }
      });

      console.log('Applying filters:', filterState); // Debug log
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
      setSelectedJobType('');
      setSelectedPaymentType('');
      setSelectedSalaryRange('');
      setMinSalary(5);
      setMaxSalary(40);
      setLocationSearch('');
      setSelectedLocations([]);
      setSelectedShift('');
    } catch (error) {
      console.error('Error clearing filters:', error);
      Alert.alert('Error', 'Failed to clear filters. Please try again.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' }}>
        <View style={{ 
          backgroundColor: Colors.ui.backgroundGray, 
          borderTopLeftRadius: 24, 
          borderTopRightRadius: 24, 
          maxHeight: '90%' 
        }}>
          {/* Header */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            paddingHorizontal: 20, 
            paddingVertical: 16, 
            borderBottomWidth: 1, 
            borderBottomColor: Colors.ui.inputBorder 
          }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.ui.textPrimary }}>Filter</Text>
            <TouchableOpacity onPress={onClose} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={24} color={Colors.ui.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ paddingHorizontal: 20, paddingVertical: 20 }} contentContainerStyle={{ paddingBottom: 16 }}>
            {/* Job Type */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.ui.textPrimary, marginBottom: 12 }}>Job Type</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {['Long Term', 'Short Time'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setSelectedJobType(selectedJobType === type ? '' : type)}
                    style={{ 
                      paddingHorizontal: 24, 
                      paddingVertical: 12, 
                      borderRadius: 12,
                      backgroundColor: selectedJobType === type ? Colors.brand.primary : Colors.ui.background,
                      borderWidth: selectedJobType === type ? 0 : 1,
                      borderColor: Colors.ui.inputBorder
                    }}
                  >
                    <Text style={{ 
                      fontSize: 14, 
                      fontWeight: '600',
                      color: selectedJobType === type ? Colors.ui.background : Colors.ui.textPrimary
                    }}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Payment Type */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.ui.textPrimary, marginBottom: 12 }}>Payment Type</Text>
              <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                {['Per Patient', 'Per Hour', 'Per Month'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setSelectedPaymentType(selectedPaymentType === type ? '' : type)}
                    style={{ 
                      paddingHorizontal: 24, 
                      paddingVertical: 12, 
                      borderRadius: 12,
                      backgroundColor: selectedPaymentType === type ? Colors.brand.primary : Colors.ui.background,
                      borderWidth: selectedPaymentType === type ? 0 : 1,
                      borderColor: Colors.ui.inputBorder
                    }}
                  >
                    <Text style={{ 
                      fontSize: 14, 
                      fontWeight: '600',
                      color: selectedPaymentType === type ? Colors.ui.background : Colors.ui.textPrimary
                    }}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Salary */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.ui.textPrimary, marginBottom: 12 }}>Salary</Text>
              
              {/* Salary Range Buttons */}
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                {['All', 'Under 15L', '15L - 25L'].map((range) => (
                  <TouchableOpacity
                    key={range}
                    onPress={() => {
                      setSelectedSalaryRange(selectedSalaryRange === range ? '' : range);
                      if (range === 'Under 15L') {
                        setMinSalary(5);
                        setMaxSalary(15);
                      } else if (range === '15L - 25L') {
                        setMinSalary(15);
                        setMaxSalary(25);
                      } else if (range === 'All') {
                        setMinSalary(5);
                        setMaxSalary(40);
                      }
                    }}
                    style={{ 
                      paddingHorizontal: 24, 
                      paddingVertical: 12, 
                      borderRadius: 12,
                      backgroundColor: selectedSalaryRange === range ? Colors.brand.primary : Colors.ui.background,
                      borderWidth: selectedSalaryRange === range ? 0 : 1,
                      borderColor: Colors.ui.inputBorder
                    }}
                  >
                    <Text style={{ 
                      fontSize: 14, 
                      fontWeight: '600',
                      color: selectedSalaryRange === range ? Colors.ui.background : Colors.ui.textPrimary
                    }}>
                      {range}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Salary Slider */}
              <View style={{ marginTop: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 12, color: Colors.ui.textSecondary, marginBottom: 4 }}>Min</Text>
                    <TextInput
                      value={String(minSalary)}
                      onChangeText={(text) => {
                        const num = parseInt(text) || 5;
                        setMinSalary(Math.max(5, Math.min(40, num)));
                      }}
                      keyboardType="numeric"
                      style={{ 
                        backgroundColor: Colors.ui.background,
                        borderWidth: 1,
                        borderColor: Colors.ui.inputBorder,
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        fontSize: 14,
                        fontWeight: '600',
                        color: Colors.ui.textPrimary
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: Colors.ui.textSecondary, marginBottom: 4 }}>Max</Text>
                    <TextInput
                      value={String(maxSalary)}
                      onChangeText={(text) => {
                        const num = parseInt(text) || 40;
                        setMaxSalary(Math.max(5, Math.min(40, num)));
                      }}
                      keyboardType="numeric"
                      style={{ 
                        backgroundColor: Colors.ui.background,
                        borderWidth: 1,
                        borderColor: Colors.ui.inputBorder,
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        fontSize: 14,
                        fontWeight: '600',
                        color: Colors.ui.textPrimary
                      }}
                    />
                  </View>
                </View>
                
                {/* Visual Range Indicator */}
                <View style={{ 
                  height: 4, 
                  backgroundColor: Colors.ui.inputBorder, 
                  borderRadius: 2,
                  position: 'relative'
                }}>
                  <View style={{ 
                    position: 'absolute',
                    left: `${((minSalary - 5) / 35) * 100}%`,
                    right: `${100 - ((maxSalary - 5) / 35) * 100}%`,
                    height: 4,
                    backgroundColor: Colors.brand.primary,
                    borderRadius: 2
                  }} />
                </View>
              </View>
            </View>

            {/* Location */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.ui.textPrimary, marginBottom: 12 }}>Location</Text>
              
              {/* Search Input */}
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                backgroundColor: Colors.ui.background, 
                borderRadius: 12, 
                paddingHorizontal: 16, 
                paddingVertical: 12,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: Colors.ui.inputBorder
              }}>
                <Ionicons name="search" size={18} color={Colors.ui.placeholder} />
                <TextInput
                  placeholder="Search city or hospital"
                  value={locationSearch}
                  onChangeText={setLocationSearch}
                  style={{ flex: 1, marginLeft: 8, fontSize: 14, color: Colors.ui.textPrimary }}
                  placeholderTextColor={Colors.ui.placeholder}
                />
              </View>

              {/* Location List - Scrollable with fixed height */}
              <ScrollView 
                style={{ 
                  maxHeight: 200,
                  borderRadius: 8,
                  backgroundColor: Colors.ui.background,
                  borderWidth: 1,
                  borderColor: Colors.ui.inputBorder
                }}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
              >
                {loadingLocations ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, color: Colors.ui.textSecondary }}>Loading locations...</Text>
                  </View>
                ) : filteredLocations.length === 0 ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <Ionicons name="location-outline" size={24} color={Colors.ui.placeholder} />
                    <Text style={{ fontSize: 14, color: Colors.ui.textSecondary, marginTop: 8 }}>
                      {locationSearch ? 'No locations found' : 'No locations available'}
                    </Text>
                  </View>
                ) : (
                  filteredLocations.map((location, index) => (
                    <TouchableOpacity
                      key={`${location}-${index}`}
                      onPress={() => toggleLocation(location)}
                      style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderBottomWidth: index < filteredLocations.length - 1 ? 1 : 0,
                        borderBottomColor: Colors.ui.backgroundGray
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <Ionicons name="location-outline" size={18} color={Colors.ui.placeholder} />
                        <Text style={{ 
                          fontSize: 14, 
                          color: Colors.ui.textPrimary, 
                          marginLeft: 8,
                          fontWeight: '500',
                          flex: 1
                        }}>
                          {location}
                        </Text>
                      </View>
                      <View style={{ 
                        width: 20, 
                        height: 20, 
                        borderRadius: 4,
                        borderWidth: 2,
                        borderColor: selectedLocations.includes(location) ? Colors.brand.primary : Colors.ui.inputBorder,
                        backgroundColor: selectedLocations.includes(location) ? Colors.brand.primary : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {selectedLocations.includes(location) && (
                          <Ionicons name="checkmark" size={14} color={Colors.ui.background} />
                        )}
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>

            {/* Shift Timing */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.ui.textPrimary, marginBottom: 12 }}>Shift Timing</Text>
              <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                {['All', 'Day Shift', 'Night Shift'].map((shift) => (
                  <TouchableOpacity
                    key={shift}
                    onPress={() => setSelectedShift(selectedShift === shift ? '' : shift)}
                    style={{ 
                      paddingHorizontal: 24, 
                      paddingVertical: 12, 
                      borderRadius: 12,
                      backgroundColor: selectedShift === shift ? Colors.brand.primary : Colors.ui.background,
                      borderWidth: selectedShift === shift ? 0 : 1,
                      borderColor: Colors.ui.inputBorder
                    }}
                  >
                    <Text style={{ 
                      fontSize: 14, 
                      fontWeight: '600',
                      color: selectedShift === shift ? Colors.ui.background : Colors.ui.textPrimary
                    }}>
                      {shift}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity
                onPress={handleClearAll}
                style={{ 
                  flex: 1, 
                  backgroundColor: Colors.ui.background, 
                  borderWidth: 2, 
                  borderColor: Colors.brand.primary,
                  borderRadius: 12, 
                  paddingVertical: 14, 
                  alignItems: 'center' 
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.brand.primary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleApply}
                style={{ 
                  flex: 1, 
                  backgroundColor: Colors.brand.primary, 
                  borderRadius: 12, 
                  paddingVertical: 14, 
                  alignItems: 'center' 
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.ui.background }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const JobFilterScreen: React.FC = () => {
  const router = useRouter();
  return <JobFilterModal visible onClose={() => router.back()} />;
};

export default JobFilterScreen;