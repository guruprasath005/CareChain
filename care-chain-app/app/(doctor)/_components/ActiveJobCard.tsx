import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

export type ActiveJobStatus = 'Active' | 'On Leave' | 'Paused';

export type ActiveJob = {
  id: string;
  title: string;
  hospital: string;
  jobType: string;
  timeRange: string;
  status: ActiveJobStatus;
};

export type ActiveJobCardProps = {
  job: ActiveJob;
  onViewDetails: (jobId: string) => void;
  primaryActionLabel: string;
  onPrimaryAction: (jobId: string) => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: (jobId: string) => void;
};

function statusStyles(status: ActiveJobStatus) {
  switch (status) {
    case 'Active':
      return { pill: 'bg-green-100', text: 'text-green-700' };
    case 'On Leave':
      return { pill: 'bg-red-100', text: 'text-red-700' };
    case 'Paused':
      return { pill: 'bg-gray-200', text: 'text-gray-700' };
    default:
      return { pill: 'bg-gray-200', text: 'text-gray-700' };
  }
}

const ActiveJobCard: React.FC<ActiveJobCardProps> = ({
  job,
  onViewDetails,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
}) => {
  const status = statusStyles(job.status);

  return (
    <View style={{ backgroundColor: Colors.ui.background, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.ui.inputBorder, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2, width: '100%' }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {/* Left icon */}
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name="briefcase" size={20} color={Colors.brand.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: Colors.ui.textPrimary }} numberOfLines={1}>
                {job.title}
              </Text>
              <Text style={{ fontSize: 14, color: Colors.ui.textSecondary }} numberOfLines={1}>
                {job.hospital}
              </Text>
            </View>

            <View className={`px-3 py-1 rounded-full ${status.pill}`}>
              <Text className={`text-xs font-semibold ${status.text}`}>{job.status}</Text>
            </View>
          </View>

          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="briefcase-outline" size={14} color={Colors.ui.textSecondary} />
              <Text style={{ fontSize: 12, color: Colors.ui.textSecondary, marginLeft: 8 }}>{job.jobType}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="time-outline" size={14} color={Colors.ui.textSecondary} />
              <Text style={{ fontSize: 12, color: Colors.ui.textSecondary, marginLeft: 8 }}>{job.timeRange}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', marginTop: 16, gap: 10 }}>
            {secondaryActionLabel && onSecondaryAction ? (
              <TouchableOpacity
                onPress={() => onSecondaryAction(job.id)}
                style={{ flex: 1, backgroundColor: Colors.ui.backgroundGray, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.ui.textPrimary }}>
                  {secondaryActionLabel}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => onViewDetails(job.id)}
                style={{ flex: 1, backgroundColor: Colors.ui.backgroundGray, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.ui.textPrimary }}>View Details</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => onPrimaryAction(job.id)}
              style={{ flex: 1, backgroundColor: Colors.brand.primary, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}
              activeOpacity={0.9}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.ui.background }}>{primaryActionLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

export default ActiveJobCard;
