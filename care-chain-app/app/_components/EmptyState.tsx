import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type EmptyStateType =
  | 'no-search-results'
  | 'no-filter-results'
  | 'no-combined-results'
  | 'no-data'
  | 'error';

export interface EmptyStateProps {
  type: EmptyStateType;
  icon?: keyof typeof Ionicons.glyphMap;
  title?: string;
  message?: string;
  onClearSearch?: () => void;
  onClearFilters?: () => void;
  onRetry?: () => void;
  showSearchButton?: boolean;
  showFilterButton?: boolean;
  customAction?: {
    label: string;
    onPress: () => void;
  };
}

/**
 * Reusable empty state component for search and filter functionality
 * Provides consistent UI for various empty/error states across the app
 * 
 * Requirements: 1.4, 3.4, 4.4, 5.4, 8.1, 8.2, 8.3, 8.4
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  type,
  icon,
  title,
  message,
  onClearSearch,
  onClearFilters,
  onRetry,
  showSearchButton = false,
  showFilterButton = false,
  customAction,
}) => {
  // Default configurations based on type
  const getDefaultConfig = () => {
    switch (type) {
      case 'no-search-results':
        return {
          icon: icon || 'search-outline',
          title: title || 'No results found',
          message: message || 'Try a different search term or adjust your filters',
        };
      case 'no-filter-results':
        return {
          icon: icon || 'options-outline',
          title: title || 'No matches found',
          message: message || 'Try adjusting your filter criteria',
        };
      case 'no-combined-results':
        return {
          icon: icon || 'funnel-outline',
          title: title || 'No matches found',
          message: message || 'Try adjusting your search or filter criteria',
        };
      case 'no-data':
        return {
          icon: icon || 'document-outline',
          title: title || 'No data available',
          message: message || 'Check back later',
        };
      case 'error':
        return {
          icon: icon || 'alert-circle-outline',
          title: title || 'Something went wrong',
          message: message || 'Please try again',
        };
      default:
        return {
          icon: icon || 'information-circle-outline',
          title: title || 'No results',
          message: message || '',
        };
    }
  };

  const config = getDefaultConfig();

  return (
    <View className="bg-white rounded-2xl border border-gray-200 p-6 items-center">
      <Ionicons
        name={config.icon as keyof typeof Ionicons.glyphMap}
        size={40}
        color={type === 'error' ? '#EF4444' : '#9CA3AF'}
      />
      <Text className="text-gray-700 font-semibold mt-3 text-center">
        {config.title}
      </Text>
      <Text className="text-gray-500 text-xs mt-1 text-center">
        {config.message}
      </Text>

      {/* Action Buttons */}
      <View className="mt-4 flex-row gap-2 flex-wrap justify-center">
        {/* Clear Search Button */}
        {showSearchButton && onClearSearch && (
          <TouchableOpacity
            onPress={onClearSearch}
            className="bg-brand-primary px-4 py-2 rounded-lg"
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-sm">Clear Search</Text>
          </TouchableOpacity>
        )}

        {/* Clear Filters Button */}
        {showFilterButton && onClearFilters && (
          <TouchableOpacity
            onPress={onClearFilters}
            className="bg-brand-primary px-4 py-2 rounded-lg"
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-sm">Clear Filters</Text>
          </TouchableOpacity>
        )}

        {/* Retry Button (for errors) */}
        {type === 'error' && onRetry && (
          <TouchableOpacity
            onPress={onRetry}
            className="bg-brand-primary px-4 py-2 rounded-lg"
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-sm">Retry</Text>
          </TouchableOpacity>
        )}

        {/* Custom Action Button */}
        {customAction && (
          <TouchableOpacity
            onPress={customAction.onPress}
            className="bg-gray-600 px-4 py-2 rounded-lg"
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-sm">{customAction.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
