import React, { useRef, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  PanResponder,
  Animated,
  ScrollView,
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// HospitalPublicProfile type definition
type HospitalPublicProfile = {
  id: string;
  name: string;
  type?: string | null;
  description?: string | null;
  website?: string | null;
  logo?: string | null;
  coverPhoto?: string | null;
  location?: {
    city?: string | null;
    state?: string | null;
    fullAddress?: string | null;
  };
  specialties?: string[];
  departments?: string[];
  facilities?: {
    emergency24x7?: boolean;
    icuFacilities?: boolean;
    diagnosticLab?: boolean;
    pharmacy?: boolean;
    ambulanceService?: boolean;
    bloodBank?: boolean;
    parking?: boolean;
    canteen?: boolean;
    opFacility?: boolean;
    ipFacility?: boolean;
    radiologyDepartment?: boolean;
  };
  infrastructure?: {
    totalBeds?: number;
    icuBeds?: number;
    operationTheaters?: number;
    emergencyBeds?: number;
  };
  stats?: {
    rating?: number;
    totalEmployees?: number;
    activeJobs?: number;
  };
  staffing?: {
    totalDoctors?: number;
    totalNurses?: number;
  };
  isVerified?: boolean;
  isOpen24Hours?: boolean;
};

// Capability tag type definition
type CapabilityTag = {
  label: string;
  icon: string;
  enabled: boolean;
};

// Props interface for EmployerBottomSheet component
interface EmployerBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onViewFullProfile: () => void;
  hospitalProfile: HospitalPublicProfile | null;
  isLoading?: boolean;
  jobId?: string;
}

// Custom hook for debounced interactions to prevent rapid taps
function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number = 300
): [(...args: Parameters<T>) => void, boolean] {
  const [isProcessing, setIsProcessing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      // If already processing, ignore the call
      if (isProcessing) {
        return;
      }

      // Set processing state to true
      setIsProcessing(true);

      // Execute the callback
      callback(...args);

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Reset processing state after delay
      timeoutRef.current = setTimeout(() => {
        setIsProcessing(false);
      }, delay);
    },
    [callback, delay, isProcessing]
  );

  return [debouncedCallback, isProcessing];
}

// Function to map facility data to capability tags
function mapCapabilityTags(facilities?: HospitalPublicProfile['facilities']): CapabilityTag[] {
  if (!facilities) return [];
  
  return [
    {
      label: 'OP/IP',
      icon: 'medical',
      enabled: facilities.opFacility || facilities.ipFacility || false
    },
    {
      label: 'Emergency',
      icon: 'alert-circle',
      enabled: facilities.emergency24x7 || false
    },
    {
      label: 'ICU',
      icon: 'heart',
      enabled: facilities.icuFacilities || false
    },
    {
      label: 'Radiology',
      icon: 'scan',
      enabled: facilities.radiologyDepartment || false
    },
    {
      label: 'Lab',
      icon: 'flask',
      enabled: facilities.diagnosticLab || false
    }
  ].filter(tag => tag.enabled);
}

export default function EmployerBottomSheet({
  visible,
  onClose,
  onViewFullProfile,
  hospitalProfile,
  isLoading = false,
  jobId,
}: EmployerBottomSheetProps) {
  // Get safe area insets for devices with notches
  const insets = useSafeAreaInsets();
  
  // Create a ref for tracking swipe gesture
  const panY = useRef(new Animated.Value(0)).current;
  const [sheetHeight, setSheetHeight] = useState(0.5); // Start at 50%

  // Debounced callbacks to prevent rapid taps
  const [debouncedClose] = useDebouncedCallback(onClose, 300);
  const [debouncedViewFullProfile] = useDebouncedCallback(onViewFullProfile, 300);

  // PanResponder for swipe gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to vertical swipes
        return Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        panY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dy, vy } = gestureState;
        
        // If swiped down significantly, close the sheet
        if (dy > 100 || vy > 0.5) {
          debouncedClose();
        } 
        // If swiped up significantly, expand to full screen
        else if (dy < -100 || vy < -0.5) {
          setSheetHeight(0.95);
        }
        // If swiped down from expanded state, collapse to 50%
        else if (sheetHeight > 0.5 && dy > 50) {
          setSheetHeight(0.5);
        }
        
        // Reset position
        Animated.spring(panY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Backdrop - semi-transparent background */}
      <View className="flex-1 bg-black/50 justify-end">
        {/* Bottom Sheet Container with gesture handling */}
        <Animated.View
          {...panResponder.panHandlers}
          style={{
            transform: [{ translateY: panY }],
            height: `${sheetHeight * 100}%`,
          }}
          className="bg-white rounded-t-3xl"
        >
          {/* Drag Handle */}
          <View className="items-center pt-3 pb-2">
            <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
          </View>

          {/* Content Area */}
          <ScrollView 
            className="flex-1 px-6 py-4"
            showsVerticalScrollIndicator={false}
            bounces={true}
            scrollEventThrottle={16}
            onScroll={(event) => {
              const offsetY = event.nativeEvent.contentOffset.y;
              // Expand to full screen when scrolling up from the top
              if (offsetY < -50 && sheetHeight < 0.95) {
                setSheetHeight(0.95);
              }
            }}
          >
            {isLoading ? (
              <View className="items-center justify-center py-12">
                <ActivityIndicator size="large" color="#312e81" />
                <Text className="text-gray-500 mt-4 text-sm">Loading hospital profile...</Text>
              </View>
            ) : !hospitalProfile ? (
              <View className="items-center justify-center py-12">
                <Ionicons name="alert-circle-outline" size={52} color="#9ca3af" />
                <Text className="text-gray-500 mt-4 text-center text-sm">
                  Hospital profile unavailable
                </Text>
              </View>
            ) : (
              <View>
                {/* Header Section with Hospital Identity */}
                <View className="items-center mb-5">
                  {/* Hospital Avatar */}
                  <View className="w-24 h-24 rounded-2xl border-2 border-gray-200 items-center justify-center bg-gray-50 mb-4 overflow-hidden">
                    {hospitalProfile.logo ? (
                      <Image
                        source={{ uri: hospitalProfile.logo }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <FontAwesome5 name="hospital" size={36} color="#6b7280" />
                    )}
                  </View>

                  {/* Hospital Name */}
                  <Text className="text-2xl font-bold text-gray-900 text-center px-4 mb-1">
                    {hospitalProfile.name}
                  </Text>

                  {/* Hospital Type (Subtitle) */}
                  {hospitalProfile.type && (
                    <Text className="text-sm text-gray-500 mb-2">
                      {hospitalProfile.type.replace(/_/g, ' ')}
                    </Text>
                  )}

                  {/* Location */}
                  {hospitalProfile.location && (
                    hospitalProfile.location.city ||
                    hospitalProfile.location.state ||
                    hospitalProfile.location.fullAddress
                  ) && (
                    <View className="flex-row items-center">
                      <Ionicons name="location-outline" size={16} color="#6b7280" />
                      <Text className="text-sm text-gray-600 ml-1.5">
                        {hospitalProfile.location.fullAddress ||
                          [
                            hospitalProfile.location.city,
                            hospitalProfile.location.state,
                          ]
                            .filter(Boolean)
                            .join(', ')}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Rating and Verification Row */}
                <View className="flex-row items-center justify-center bg-gray-50 rounded-2xl py-4 px-6 mb-5">
                  {/* Star Rating Display */}
                  <View className="flex-row items-center flex-1 justify-center border-r border-gray-300">
                    <Text className="text-3xl font-bold text-gray-900 mr-2">
                      {(hospitalProfile.stats?.rating ?? 0).toFixed(1)}
                    </Text>
                    <Ionicons name="star" size={20} color="#fbbf24" />
                  </View>

                  {/* Reviews Count */}
                  <View className="flex-1 items-center justify-center border-r border-gray-300">
                    <Text className="text-gray-900 font-semibold text-base">
                      120 +
                    </Text>
                    <Text className="text-gray-500 text-xs">Reviews</Text>
                  </View>

                  {/* Verification Badge */}
                  <View className="flex-1 items-center justify-center">
                    {hospitalProfile.isVerified ? (
                      <>
                        <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
                        <Text className="text-gray-900 font-semibold text-xs mt-1">
                          Verified
                        </Text>
                        <Text className="text-gray-500 text-xs">Employer</Text>
                      </>
                    ) : (
                      <Text className="text-gray-500 text-xs">Not Verified</Text>
                    )}
                  </View>
                </View>

                {/* Key Capabilities Section */}
                {(() => {
                  const capabilityTags = mapCapabilityTags(hospitalProfile.facilities);
                  return capabilityTags.length > 0 ? (
                    <View className="mb-5">
                      <Text className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">
                        Key Capabilities
                      </Text>
                      <View className="flex-row flex-wrap gap-2.5">
                        {capabilityTags.map((tag, index) => (
                          <CapabilityChip
                            key={`${tag.label}-${index}`}
                            label={tag.label}
                            icon={tag.icon}
                          />
                        ))}
                      </View>
                    </View>
                  ) : null;
                })()}

                {/* Staffing Statistics Section */}
                {(() => {
                  const hasDoctors =
                    hospitalProfile.staffing?.totalDoctors !== undefined &&
                    hospitalProfile.staffing?.totalDoctors !== null;
                  const hasNurses =
                    hospitalProfile.staffing?.totalNurses !== undefined &&
                    hospitalProfile.staffing?.totalNurses !== null;
                  const hasBeds =
                    hospitalProfile.infrastructure?.totalBeds !== undefined &&
                    hospitalProfile.infrastructure?.totalBeds !== null;

                  return hasDoctors || hasNurses || hasBeds ? (
                    <View className="mb-5">
                      <View className="flex-row justify-around gap-3">
                        {hasDoctors && (
                          <View className="flex-1 bg-gray-50 rounded-2xl p-4 items-center border border-gray-200">
                            <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center mb-2">
                              <Ionicons name="medical-outline" size={24} color="#312e81" />
                            </View>
                            <Text className="text-xl font-black text-gray-900">
                              {hospitalProfile.staffing!.totalDoctors}+
                            </Text>
                            <Text className="text-xs text-gray-500 font-semibold uppercase tracking-wide mt-1">
                              Doctors
                            </Text>
                          </View>
                        )}
                        {hasNurses && (
                          <View className="flex-1 bg-gray-50 rounded-2xl p-4 items-center border border-gray-200">
                            <View className="w-12 h-12 rounded-full bg-green-100 items-center justify-center mb-2">
                              <Ionicons name="people-outline" size={24} color="#16a34a" />
                            </View>
                            <Text className="text-xl font-black text-gray-900">
                              {hospitalProfile.staffing!.totalNurses}
                            </Text>
                            <Text className="text-xs text-gray-500 font-semibold uppercase tracking-wide mt-1">
                              Nurses
                            </Text>
                          </View>
                        )}
                        {hasBeds && (
                          <View className="flex-1 bg-gray-50 rounded-2xl p-4 items-center border border-gray-200">
                            <View className="w-12 h-12 rounded-full bg-red-100 items-center justify-center mb-2">
                              <Ionicons name="bed-outline" size={24} color="#dc2626" />
                            </View>
                            <Text className="text-xl font-black text-gray-900">
                              {hospitalProfile.infrastructure!.totalBeds}+
                            </Text>
                            <Text className="text-xs text-gray-500 font-semibold uppercase tracking-wide mt-1">
                              Total Beds
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ) : null;
                })()}

                {/* Gallery Section */}
                {hospitalProfile.infrastructure?.photos && hospitalProfile.infrastructure.photos.length > 0 && (
                  <View className="mb-5">
                    <Text className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">
                      Gallery
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 12 }}
                    >
                      {hospitalProfile.infrastructure.photos.map((photo, index) => (
                        <View key={index} className="w-40">
                          <Image
                            source={{ uri: photo.url }}
                            className="w-full h-28 rounded-xl"
                            resizeMode="cover"
                          />
                          {photo.caption && (
                            <Text className="text-gray-600 text-xs mt-2" numberOfLines={2}>
                              {photo.caption}
                            </Text>
                          )}
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Ratings and Reviews Summary */}
                {hospitalProfile.stats?.rating !== undefined && hospitalProfile.stats?.rating > 0 && (
                  <View className="mb-5">
                    <Text className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">
                      Ratings & Reviews
                    </Text>
                    <View className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <View className="flex-row items-center justify-between">
                        <View>
                          <Text className="text-3xl font-bold text-gray-900">
                            {hospitalProfile.stats.rating.toFixed(1)}
                          </Text>
                          <View className="flex-row items-center mt-1">
                            {renderStarRating(hospitalProfile.stats.rating)}
                          </View>
                        </View>
                        <TouchableOpacity
                          onPress={debouncedViewFullProfile}
                          className="bg-indigo-100 px-4 py-2 rounded-lg"
                        >
                          <Text className="text-indigo-900 text-xs font-semibold">
                            View All Reviews
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}

              </View>
            )}
          </ScrollView>

          {/* Action Footer with CTA Button */}
          {!isLoading && hospitalProfile && (
            <View 
              className="px-6 pt-4 pb-6 border-t border-gray-200"
              style={{ paddingBottom: Math.max(24, insets.bottom) }}
            >
              {/* View Full Employee Profile Button */}
              <TouchableOpacity
                onPress={debouncedViewFullProfile}
                disabled={!hospitalProfile.id}
                className={`rounded-2xl py-4 items-center flex-row justify-center mb-4 ${
                  hospitalProfile.id
                    ? 'bg-indigo-900'
                    : 'bg-gray-300'
                }`}
                activeOpacity={0.8}
              >
                <Text
                  className={`font-bold text-base ${
                    hospitalProfile.id ? 'text-white' : 'text-gray-500'
                  }`}
                >
                  View Full Employee Profile
                </Text>
                <Ionicons 
                  name="arrow-forward" 
                  size={20} 
                  color={hospitalProfile.id ? '#ffffff' : '#6b7280'} 
                  style={{ marginLeft: 8 }}
                />
              </TouchableOpacity>

              {/* Dismiss Link */}
              <TouchableOpacity
                onPress={debouncedClose}
                className="items-center py-2"
                activeOpacity={0.7}
              >
                <Text className="text-gray-400 text-base font-medium">
                  Dismiss
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// Helper function to render star rating
function renderStarRating(rating: number) {
  const stars = [];
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  // Render full stars
  for (let i = 0; i < fullStars; i++) {
    stars.push(
      <Ionicons key={`full-${i}`} name="star" size={16} color="#fbbf24" />
    );
  }

  // Render half star
  if (hasHalfStar) {
    stars.push(
      <Ionicons key="half" name="star-half" size={16} color="#fbbf24" />
    );
  }

  // Render empty stars
  for (let i = 0; i < emptyStars; i++) {
    stars.push(
      <Ionicons key={`empty-${i}`} name="star-outline" size={16} color="#fbbf24" />
    );
  }

  return stars;
}

// CapabilityChip component for displaying capability tags
interface CapabilityChipProps {
  label: string;
  icon: string;
}

function CapabilityChip({ label, icon }: CapabilityChipProps) {
  // Define colors based on label
  const getChipColors = () => {
    switch (label.toLowerCase()) {
      case 'op/ip':
        return { bg: '#d1fae5', text: '#065f46' }; // Green
      case 'emergency':
        return { bg: '#fecaca', text: '#991b1b' }; // Red
      case 'icu':
        return { bg: '#dbeafe', text: '#1e40af' }; // Blue
      case 'radiology':
        return { bg: '#e9d5ff', text: '#6b21a8' }; // Purple
      case 'lab':
        return { bg: '#fef3c7', text: '#92400e' }; // Yellow
      default:
        return { bg: '#f3f4f6', text: '#374151' }; // Gray
    }
  };

  const colors = getChipColors();

  return (
    <View 
      style={{ 
        backgroundColor: colors.bg,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
      }}
    >
      <Text 
        style={{ 
          color: colors.text,
          fontSize: 13,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// StatCard component for displaying metrics
interface StatCardProps {
  icon: string;
  value: number;
  label: string;
}

function StatCard({ icon, value, label }: StatCardProps) {
  return (
    <View className="items-center">
      <View className="w-14 h-14 rounded-full bg-indigo-100 items-center justify-center mb-2">
        <Ionicons name={icon as any} size={26} color="#312e81" />
      </View>
      <Text className="text-lg font-bold text-gray-900">{value}</Text>
      <Text className="text-xs text-gray-500 mt-1">{label}</Text>
    </View>
  );
}
