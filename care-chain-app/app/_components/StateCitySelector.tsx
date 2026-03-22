import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  Modal,
  KeyboardAvoidingView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { INDIAN_STATES, getCitiesByState } from '@/constants/indianStatesAndCities';

interface StateCitySelectorProps {
  state: string;
  city: string;
  onStateChange: (state: string) => void;
  onCityChange: (city: string) => void;
  containerStyle?: object;
  disabled?: boolean;
}

export const StateCitySelector: React.FC<StateCitySelectorProps> = ({
  state,
  city,
  onStateChange,
  onCityChange,
  containerStyle,
  disabled = false,
}) => {
  const [showStateModal, setShowStateModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [stateSearchQuery, setStateSearchQuery] = useState('');
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [filteredStates, setFilteredStates] = useState<string[]>(INDIAN_STATES);
  const [filteredCities, setFilteredCities] = useState<string[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);

  const stateInputRef = useRef<TextInput>(null);
  const cityInputRef = useRef<TextInput>(null);

  // Update available cities when state changes
  useEffect(() => {
    const cities = state ? getCitiesByState(state) : [];
    setAvailableCities(cities);
    setFilteredCities(cities);
  }, [state]);

  const handleStateSearch = (text: string) => {
    setStateSearchQuery(text);
    if (text.length > 0) {
      const filtered = INDIAN_STATES.filter(s =>
        s.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredStates(filtered);
    } else {
      setFilteredStates(INDIAN_STATES);
    }
  };

  const handleCitySearch = (text: string) => {
    setCitySearchQuery(text);
    if (text.length > 0) {
      const filtered = availableCities.filter(c =>
        c.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredCities(filtered);
    } else {
      setFilteredCities(availableCities);
    }
  };

  const selectState = (selectedState: string) => {
    setShowStateModal(false);
    setStateSearchQuery('');
    setFilteredStates(INDIAN_STATES);
    // Call parent callbacks after closing modal
    setTimeout(() => {
      onStateChange(selectedState);
    }, 0);
  };

  const selectCity = (selectedCity: string) => {
    setShowCityModal(false);
    setCitySearchQuery('');
    // Call parent callback after closing modal
    setTimeout(() => {
      onCityChange(selectedCity);
    }, 0);
  };

  const openStateModal = () => {
    if (disabled) return;
    setStateSearchQuery('');
    setFilteredStates(INDIAN_STATES);
    setShowStateModal(true);
  };

  const openCityModal = () => {
    if (disabled) return;
    if (!state) return;
    setCitySearchQuery('');
    setFilteredCities(availableCities);
    setShowCityModal(true);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {/* State Selector */}
      <View style={styles.selectorWrapper}>
        <Text style={styles.label}>State</Text>
        <Pressable
          onPress={openStateModal}
          disabled={disabled}
          style={[styles.selector, disabled && styles.selectorDisabled]}
        >
          <Text style={state ? styles.selectorText : styles.selectorPlaceholder} numberOfLines={1}>
            {state || "Select State"}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#9ca3af" />
        </Pressable>
      </View>

      {/* City Selector */}
      <View style={styles.selectorWrapper}>
        <Text style={styles.label}>City</Text>
        <Pressable
          onPress={openCityModal}
          disabled={disabled || !state}
          style={[styles.selector, (disabled || !state) && styles.selectorDisabled]}
        >
          <Text style={city ? styles.selectorText : styles.selectorPlaceholder} numberOfLines={1}>
            {city || (state ? "Select City" : "Select State first")}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#9ca3af" />
        </Pressable>
      </View>

      {/* State Modal */}
      <Modal
        visible={showStateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowStateModal(false)}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalContainer}
          >
            <View style={styles.modalContent}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select State</Text>
                <Pressable onPress={() => setShowStateModal(false)} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#6b7280" />
                </Pressable>
              </View>

              {/* Search Input */}
              <View style={styles.searchContainer}>
                <View style={styles.searchInputWrapper}>
                  <Ionicons name="search" size={18} color="#9ca3af" />
                  <TextInput
                    ref={stateInputRef}
                    value={stateSearchQuery}
                    onChangeText={handleStateSearch}
                    placeholder="Search states..."
                    style={styles.searchInput}
                    placeholderTextColor="#9ca3af"
                    autoFocus
                    autoCapitalize="words"
                    returnKeyType="search"
                  />
                  {stateSearchQuery.length > 0 && (
                    <Pressable onPress={() => handleStateSearch('')}>
                      <Ionicons name="close-circle" size={18} color="#9ca3af" />
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Items List */}
              <ScrollView
                style={styles.itemsList}
                keyboardShouldPersistTaps="always"
                showsVerticalScrollIndicator={true}
              >
                {filteredStates.length > 0 ? (
                  filteredStates.map((item, index) => (
                    <TouchableOpacity
                      key={`state-${index}`}
                      style={styles.listItem}
                      activeOpacity={0.6}
                      onPress={() => selectState(item)}
                    >
                      <Text style={styles.listItemText}>{item}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.emptyState}>
                    <Ionicons name="search-outline" size={32} color="#d1d5db" />
                    <Text style={styles.emptyStateText}>No results found</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* City Modal */}
      <Modal
        visible={showCityModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowCityModal(false)}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalContainer}
          >
            <View style={styles.modalContent}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select City</Text>
                <Pressable onPress={() => setShowCityModal(false)} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#6b7280" />
                </Pressable>
              </View>

              {/* Search Input */}
              <View style={styles.searchContainer}>
                <View style={styles.searchInputWrapper}>
                  <Ionicons name="search" size={18} color="#9ca3af" />
                  <TextInput
                    ref={cityInputRef}
                    value={citySearchQuery}
                    onChangeText={handleCitySearch}
                    placeholder="Search cities..."
                    style={styles.searchInput}
                    placeholderTextColor="#9ca3af"
                    autoFocus
                    autoCapitalize="words"
                    returnKeyType="search"
                  />
                  {citySearchQuery.length > 0 && (
                    <Pressable onPress={() => handleCitySearch('')}>
                      <Ionicons name="close-circle" size={18} color="#9ca3af" />
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Items List */}
              <ScrollView
                style={styles.itemsList}
                keyboardShouldPersistTaps="always"
                showsVerticalScrollIndicator={true}
              >
                {filteredCities.length > 0 ? (
                  filteredCities.map((item, index) => (
                    <TouchableOpacity
                      key={`city-${index}`}
                      style={styles.listItem}
                      activeOpacity={0.6}
                      onPress={() => selectCity(item)}
                    >
                      <Text style={styles.listItemText}>{item}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.emptyState}>
                    <Ionicons name="search-outline" size={32} color="#d1d5db" />
                    <Text style={styles.emptyStateText}>No results found</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
  },
  selectorWrapper: {
    flex: 1,
  },
  label: {
    color: '#6b7280',
    fontSize: 12,
    marginBottom: 8,
  },
  selector: {
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorDisabled: {
    opacity: 0.6,
  },
  selectorText: {
    color: '#111827',
    flex: 1,
  },
  selectorPlaceholder: {
    color: '#9ca3af',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    width: '100%',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: '#111827',
    fontSize: 16,
  },
  itemsList: {
    maxHeight: 320,
  },
  listItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  listItemText: {
    color: '#111827',
    fontSize: 16,
  },
  emptyState: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#9ca3af',
    marginTop: 8,
  },
});

export default StateCitySelector;
