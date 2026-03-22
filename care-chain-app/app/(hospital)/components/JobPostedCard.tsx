import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';

// Local type for job data used by this card component
type JobCardData = {
  id: string;
  title: string;
  specialization: string;
  status: string;
  views: number;
  applicants: number;
  shiftTime: string;
  salary: string;
  dates: string;
  location: string;
};

type Props = {
  job: JobCardData;
  variant: 'open' | 'expired' | 'draft' | 'trash';
  rejections: number;
  onPressTitle?: (jobId: string) => void;
  onShortlist?: (jobId: string) => void;
  onEdit?: (jobId: string) => void;
  onDelete?: (jobId: string) => void;
  onRestore?: (jobId: string) => void;
  onDeleteForever?: (jobId: string) => void;
  onMenuPress?: (jobId: string) => void;
};

function Metric({
  icon,
  value,
  label,
  helper,
  bgColor,
  iconColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  helper: string;
  bgColor: string;
  iconColor: string;
}) {
  return (
    <View className="items-center flex-1">
      <View style={{ height: 48, width: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: bgColor }}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={{ color: '#111827', fontWeight: '800', marginTop: 8, fontFamily: 'DMSans-Bold' }}>{value}</Text>
      <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 12, marginTop: 2, fontFamily: 'DMSans-SemiBold' }}>{label}</Text>
      <Text style={{ color: '#9CA3AF', fontSize: 10, marginTop: 2, fontFamily: 'DMSans-Regular' }}>{helper}</Text>
    </View>
  );
}

export default function JobPostedCard({
  job,
  variant,
  rejections,
  onPressTitle,
  onShortlist,
  onEdit,
  onDelete,
  onRestore,
  onDeleteForever,
  onMenuPress,
}: Props) {
  let pillBgColor = '#E5E7EB';
  let pillText = 'Draft';

  if (variant === 'open') {
    pillBgColor = 'rgba(55, 255, 0, 0.55)'; // #37FF00 with 55% opacity (45% opaque)
    pillText = 'Open';
  } else if (variant === 'expired') {
    pillBgColor = '#FEE2E2';
    pillText = 'Expired';
  } else if (variant === 'draft') {
    pillBgColor = '#E5E7EB';
    pillText = 'Draft';
  } else if (variant === 'trash') {
    pillBgColor = '#FEE2E2';
    pillText = 'Trash';
  }

  return (
    <View
      className="bg-white rounded-2xl p-5 mb-5 border border-gray-100"
      style={{
        shadowColor: '#64748B',
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      }}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <View 
            style={{ 
              backgroundColor: pillBgColor, 
              alignSelf: 'flex-start', 
              borderRadius: 9999, 
              paddingHorizontal: 16, 
              paddingVertical: 8,
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#000000', fontFamily: 'DMSans-Bold' }}>{pillText}</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onPressTitle?.(job.id)}
            accessibilityRole="button"
            accessibilityLabel="Open job details"
          >
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827', marginTop: 12, fontFamily: 'DMSans-Bold' }} numberOfLines={1}>
              {job.title}
            </Text>
          </TouchableOpacity>

          <Text style={{ color: '#1C3D9D', fontWeight: '600', marginTop: 4, fontFamily: 'DMSans-SemiBold' }} numberOfLines={1}>
            Specialization: {job.specialization}
          </Text>

          <View className="mt-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                <Text style={{ color: '#6B7280', marginLeft: 8, fontFamily: 'DMSans-Regular' }}>{job.dates}</Text>
              </View>

              <View className="flex-row items-center">
                <Ionicons name="people-outline" size={16} color="#6B7280" />
                <Text style={{ color: '#6B7280', marginLeft: 8, fontFamily: 'DMSans-Regular' }}>{job.applicants} applicants</Text>
              </View>
            </View>

            <View className="flex-row items-center mt-2 justify-between">
              <View className="flex-row items-center">
                <FontAwesome name="rupee" size={16} color="#6B7280" />
                <Text style={{ color: '#6B7280', marginLeft: 8, fontFamily: 'DMSans-Regular' }}>{job.salary.replace('₹', '')}</Text>
              </View>

              <View className="flex-row items-center">
                <Ionicons name="location-outline" size={16} color="#6B7280" />
                <Text style={{ color: '#6B7280', marginLeft: 8, maxWidth: 100, fontFamily: 'DMSans-Regular' }} numberOfLines={1}>
                  {job.location}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          className="h-10 w-10 items-center justify-center"
          onPress={() => onMenuPress?.(job.id)}
          accessibilityRole="button"
          accessibilityLabel="Open job menu"
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <View className="mt-5 flex-row justify-between">
        <Metric
          icon="eye-outline"
          value={job.views}
          label="Views"
          helper="viewed details"
          bgColor="rgba(191, 219, 254, 0.5)"
          iconColor="#130160"
        />
        <Metric
          icon="person-add-outline"
          value={job.applicants}
          label="Applicants"
          helper="applied"
          bgColor="rgba(159, 255, 133, 0.5)"
          iconColor="#15B981"
        />
        <Metric
          icon="person-remove-outline"
          value={rejections}
          label="Rejections"
          helper="declined offer"
          bgColor="rgba(255, 159, 159, 0.5)"
          iconColor="#DC2626"
        />
      </View>

      <View className="mt-5 flex-row items-center">
        {variant === 'trash' ? (
          <>
            <TouchableOpacity
              activeOpacity={0.85}
              className="flex-1 rounded-xl py-4 items-center justify-center"
              style={{ backgroundColor: '#16A34A' }}
              onPress={() => onRestore?.(job.id)}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontFamily: 'DMSans-Bold' }}>Restore Job</Text>
            </TouchableOpacity>

            <View className="w-3" />

            <TouchableOpacity
              activeOpacity={0.85}
              className="bg-blue-100 rounded-xl h-14 w-14 items-center justify-center"
              onPress={() => onEdit?.(job.id)}
            >
              <Ionicons name="create-outline" size={22} color="#1e3a8a" />
            </TouchableOpacity>

            <View className="w-3" />

            <TouchableOpacity
              activeOpacity={0.85}
              className="bg-red-100 rounded-xl h-14 w-14 items-center justify-center"
              onPress={() => onDeleteForever?.(job.id)}
            >
              <Ionicons name="trash-outline" size={24} color="#DC2626" />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              activeOpacity={0.85}
              className="flex-1 rounded-xl py-4 items-center justify-center"
              style={{ backgroundColor: '#130160' }}
              onPress={() => onShortlist?.(job.id)}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontFamily: 'DMSans-Bold' }}>Shortlist Applicants</Text>
            </TouchableOpacity>

            <View className="w-3" />

            <TouchableOpacity
              activeOpacity={0.85}
              className="bg-blue-100 rounded-xl h-14 w-14 items-center justify-center"
              onPress={() => onEdit?.(job.id)}
            >
              <Ionicons name="create-outline" size={22} color="#1e3a8a" />
            </TouchableOpacity>

            <View className="w-3" />

            <TouchableOpacity
              activeOpacity={0.85}
              className="bg-red-100 rounded-xl h-14 w-14 items-center justify-center"
              onPress={() => onDelete?.(job.id)}
            >
              <Ionicons name="close" size={24} color="#DC2626" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}
