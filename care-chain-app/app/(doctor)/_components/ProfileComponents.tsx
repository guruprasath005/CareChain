import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * ProfileSectionStatic - A reusable wrapper component for profile sections
 * 
 * @param icon - Ionicons icon name
 * @param title - Section title
 * @param children - Section content
 */
interface ProfileSectionStaticProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: React.ReactNode;
}

export function ProfileSectionStatic({ icon, title, children }: ProfileSectionStaticProps) {
  return (
    <View className="mt-4 rounded-2xl bg-white border border-gray-100 overflow-hidden">
      <View className="px-4 py-4 flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <View className="h-10 w-10 rounded-xl bg-blue-50 items-center justify-center">
            <Ionicons name={icon} size={20} color="#1e3a8a" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-gray-900 font-semibold">{title}</Text>
          </View>
        </View>
      </View>
      <View className="px-4 pb-4 border-t border-gray-100">{children}</View>
    </View>
  );
}

/**
 * DetailRow - A reusable component for displaying label-value pairs
 * 
 * @param label - The label text
 * @param value - The value to display (shows "Not available" if null/undefined)
 */
interface DetailRowProps {
  label: string;
  value?: string | null;
}

export function DetailRow({ label, value }: DetailRowProps) {
  return (
    <View className="mt-3">
      <Text className="text-gray-500 text-xs">{label}</Text>
      <View className="mt-1 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
        <Text className="text-gray-900 font-medium">{value || 'Not available'}</Text>
      </View>
    </View>
  );
}

/**
 * CapabilityChip - A reusable component for displaying capability tags
 * 
 * @param label - The capability label
 * @param variant - Color variant (default: gray, danger: red)
 */
interface CapabilityChipProps {
  label: string;
  variant?: 'default' | 'danger';
}

export function CapabilityChip({ label, variant = 'default' }: CapabilityChipProps) {
  const bgClass = variant === 'danger' ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100';
  const textClass = variant === 'danger' ? 'text-red-600' : 'text-gray-700';

  return (
    <View className={`rounded-full border px-3 py-1.5 ${bgClass}`}>
      <Text className={`text-xs font-medium ${textClass}`}>{label}</Text>
    </View>
  );
}

/**
 * InfrastructureTag - A reusable component for displaying infrastructure items
 * Only renders when value is non-null and non-zero
 * 
 * @param label - The infrastructure item label
 * @param value - The numeric value
 * @param unit - The unit of measurement
 */
interface InfrastructureTagProps {
  label: string;
  value: string | number;
  unit: string;
}

export function InfrastructureTag({ label, value, unit }: InfrastructureTagProps) {
  if (!value || value === 0) return null;
  
  return (
    <View className="bg-purple-50 px-4 py-2 rounded-lg">
      <Text className="text-purple-900 font-semibold">
        {label} — {value} {unit}
      </Text>
    </View>
  );
}

/**
 * StaffingCard - A reusable component for displaying staffing statistics
 * 
 * @param icon - Ionicons icon name
 * @param iconColor - Icon color
 * @param iconBg - Icon background color class
 * @param value - The numeric value to display
 * @param label - The label text
 */
interface StaffingCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  value: string;
  label: string;
}

export function StaffingCard({ icon, iconColor, iconBg, value, label }: StaffingCardProps) {
  return (
    <View className="items-center">
      <View className={`h-14 w-14 rounded-2xl ${iconBg} items-center justify-center`}>
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>
      <Text className="mt-2 text-2xl font-bold text-gray-900">{value}</Text>
      <Text className="text-gray-500 text-xs">{label}</Text>
    </View>
  );
}

/**
 * VerifiedDocRow - A reusable component for displaying verified documents
 * Only renders when hasDocument is true
 * 
 * @param label - The document name
 * @param verified - Whether the document is verified
 * @param hasDocument - Whether the document exists
 */
interface VerifiedDocRowProps {
  label: string;
  verified?: boolean;
  hasDocument?: boolean;
}

export function VerifiedDocRow({ label, verified, hasDocument }: VerifiedDocRowProps) {
  if (!hasDocument) return null;

  return (
    <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
      <View className="flex-row items-center">
        <View className="h-8 w-8 rounded-lg bg-gray-50 items-center justify-center">
          <Ionicons name="document-text" size={16} color="#6b7280" />
        </View>
        <Text className="ml-3 text-gray-900 font-medium">{label}</Text>
      </View>
      <Ionicons
        name={verified ? 'checkmark-circle' : 'time-outline'}
        size={20}
        color={verified ? '#16a34a' : '#f59e0b'}
      />
    </View>
  );
}

// ============================================================================
// Data Mapping Utility Functions
// ============================================================================

/**
 * Type definition for hospital facilities
 */
type HospitalFacilities = {
  emergency24x7?: boolean;
  icuFacilities?: boolean;
  diagnosticLab?: boolean;
  pharmacy?: boolean;
  ambulanceService?: boolean;
  bloodBank?: boolean;
  parking?: boolean;
  canteen?: boolean;
  wifi?: boolean;
  atm?: boolean;
  wheelchairAccess?: boolean;
  cafeteria?: boolean;
  opFacility?: boolean;
  ipFacility?: boolean;
  ipBeds?: number;
  radiologyDepartment?: boolean;
};

/**
 * Type definition for hospital infrastructure
 */
type HospitalInfrastructure = {
  totalBeds?: number;
  icuBeds?: number;
  operationTheaters?: number;
  emergencyBeds?: number;
  photos?: Array<{ url: string; caption?: string }>;
};

/**
 * Type definition for phone number (can be object or string)
 */
type PhoneNumber = { countryCode: string; number: string } | string | null | undefined;

/**
 * mapCapabilityTags - Maps facility data to capability tags
 * 
 * @param facilities - The hospital facilities object
 * @returns Array of capability tags with labels and optional variants
 * 
 * Requirements: 9.1 - Map facility data to capability tags
 */
export function mapCapabilityTags(facilities?: HospitalFacilities | null): Array<{
  label: string;
  variant?: 'default' | 'danger';
}> {
  // Null safety check
  if (!facilities) return [];
  
  const tags: Array<{ label: string; variant?: 'default' | 'danger' }> = [];
  
  // Map each facility flag to a capability tag
  if (facilities.opFacility) {
    tags.push({ label: 'OP' });
  }
  if (facilities.ipFacility) {
    tags.push({ label: 'IP' });
  }
  if (facilities.emergency24x7) {
    tags.push({ label: 'Emergency', variant: 'danger' });
  }
  if (facilities.icuFacilities) {
    tags.push({ label: 'ICU' });
  }
  if (facilities.radiologyDepartment) {
    tags.push({ label: 'Radiology' });
  }
  
  return tags;
}

/**
 * mapInfrastructureTags - Maps infrastructure data to display tags
 * 
 * @param infrastructure - The hospital infrastructure object
 * @returns Array of infrastructure tags with label, value, and unit
 * 
 * Requirements: 9.2 - Map infrastructure data to tags
 */
export function mapInfrastructureTags(infrastructure?: HospitalInfrastructure | null): Array<{
  label: string;
  value: number;
  unit: string;
}> {
  // Null safety check
  if (!infrastructure) return [];
  
  const tags: Array<{ label: string; value: number; unit: string }> = [];
  
  // Map each infrastructure field to a tag (only if non-null and non-zero)
  if (infrastructure.totalBeds) {
    tags.push({ label: 'Total Beds', value: infrastructure.totalBeds, unit: 'beds' });
  }
  if (infrastructure.icuBeds) {
    tags.push({ label: 'ICU', value: infrastructure.icuBeds, unit: 'beds' });
  }
  if (infrastructure.operationTheaters) {
    tags.push({ label: 'Operation Theaters', value: infrastructure.operationTheaters, unit: 'units' });
  }
  if (infrastructure.emergencyBeds) {
    tags.push({ label: 'Emergency', value: infrastructure.emergencyBeds, unit: 'beds' });
  }
  
  return tags;
}

/**
 * formatPhoneNumber - Formats phone number from object or string format
 * 
 * @param phone - The phone number (can be object with countryCode and number, or string)
 * @returns Formatted phone number string or "Not available"
 * 
 * Requirements: 9.3 - Handle both object and string formats for phone numbers
 */
export function formatPhoneNumber(phone?: PhoneNumber): string {
  // Null safety check
  if (!phone) return 'Not available';
  
  // Handle string format
  if (typeof phone === 'string') {
    return phone;
  }
  
  // Handle object format with countryCode and number
  if (typeof phone === 'object' && phone.countryCode && phone.number) {
    return `${phone.countryCode} ${phone.number}`;
  }
  
  // Fallback for unexpected formats
  return 'Not available';
}
