import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActiveJobStatus } from './ActiveJobCard';
import { ActiveJobManagerData } from '@/data/activeJobs';

export type ActiveJobManagerProps = {
  data: ActiveJobManagerData;
  onPressNotification?: () => void;
  onPressSettings?: () => void;
  onPressEmployerProfile?: () => void;
  onPressMarkAttendance?: () => void;
  onPressRequestLeave?: () => void;
  onPressWorkSchedule?: () => void;
  onPressQuitJob?: () => void;
};

function statusPill(status: ActiveJobStatus) {
  switch (status) {
    case 'Active':
      return { container: 'border border-emerald-400/60 bg-emerald-500/20', text: 'text-emerald-600' };
    case 'On Leave':
      return { container: 'border border-red-400/60 bg-red-400/10', text: 'text-red-600' };
    case 'Paused':
      return { container: 'border border-gray-400/60 bg-gray-400/10', text: 'text-gray-600' };
    default:
      return { container: 'border border-gray-400/60 bg-gray-400/10', text: 'text-gray-600' };
  }
}

const ActiveJobManager: React.FC<ActiveJobManagerProps> = ({
  data,
  onPressEmployerProfile,
  onPressMarkAttendance,
  onPressRequestLeave,
  onPressWorkSchedule,
  onPressQuitJob,
}) => {
  const status = statusPill(data.status);

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ paddingBottom: 16 }}>
      {/* Header - Simple clean design */}
      <View className="pt-8 px-5">
        <View className="w-full max-w-2xl self-center">
          {/* Top row - Simplified without profile and icons */}
          <View>
            <Text className="text-gray-900 text-2xl font-bold">{data.doctorName}</Text>
            <Text className="text-gray-600 text-base font-medium mt-1">{data.doctorRole}</Text>
          </View>

          {/* Status + Job ID */}
          <View className="flex-row items-center justify-between mt-6">
            <View className={`px-5 py-2 rounded-full ${status.container}`}>
              <Text className={`text-sm font-semibold ${status.text}`}>{data.status}</Text>
            </View>
            <View className="px-4 py-2 rounded-lg border border-gray-300 bg-gray-50">
              <Text className="text-gray-700 text-sm font-medium">Job ID: {data.jobCode}</Text>
            </View>
          </View>

          {/* Title */}
          <Text className="text-gray-900 text-xl font-bold mt-6">{data.title}</Text>

          {/* Clinic + link */}
          <View className="flex-row items-center justify-between mt-4">
            <View>
              <View className="flex-row items-center">
                <Ionicons name="business-outline" size={20} color="#4b5563" />
                <Text className="text-gray-700 text-base font-medium ml-2">{data.clinicName}</Text>
              </View>
              {data.location && (
                <View className="flex-row items-center mt-1">
                  <Ionicons name="location-outline" size={20} color="#4b5563" />
                  <Text className="text-gray-500 text-sm ml-2">{data.location}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onPressEmployerProfile} activeOpacity={0.85}>
              <Text className="text-blue-600 text-sm font-medium">Visit Employer Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Today's shift */}
          <View className="mt-6 border border-gray-300 rounded-xl px-5 py-4 bg-gray-50">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-gray-600 text-base font-medium">TODAY'S SHIFT</Text>
                <Text className="text-gray-900 text-xl font-bold mt-1">{data.todayShift}</Text>
              </View>
              <View className="w-14 h-14 rounded-full border border-gray-300 items-center justify-center bg-white">
                <Ionicons name="time-outline" size={24} color="#4b5563" />
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Body - Starting from 3-up info card */}
      <View className="px-5 mt-6">
        <View className="w-full max-w-2xl self-center">
          {/* 3-up info card */}
          <View className="bg-white rounded-xl shadow-sm border border-gray-200 flex-row overflow-hidden">
            <View className="flex-1 p-4">
              <Text className="text-gray-600 text-sm">Shift Type</Text>
              <Text className="text-blue-900 text-lg font-bold mt-1">{data.shiftType}</Text>
            </View>
            <View className="w-px bg-gray-200" />
            <View className="flex-1 p-4">
              <Text className="text-gray-600 text-sm">On-Call</Text>
              <Text className="text-green-600 text-lg font-bold mt-1">{data.onCall}</Text>
            </View>
            <View className="w-px bg-gray-200" />
            <View className="flex-1 p-4">
              <Text className="text-gray-600 text-sm">Admin</Text>
              <Text className="text-blue-900 text-lg font-bold mt-1">{data.admin}</Text>
            </View>
          </View>

          {/* Quick actions */}
          <Text className="text-lg font-bold text-gray-900 mt-7 mb-4">Quick Actions</Text>

          <ActionRow
            iconName="finger-print"
            iconBg="bg-indigo-50"
            iconColor="#4F46E5"
            title="Mark Attendance"
            subtitle="Clock in/out for your shift"
            onPress={onPressMarkAttendance}
          />

          <ActionRow
            iconName="log-out-outline"
            iconBg="bg-orange-50"
            iconColor="#F97316"
            title="Request Leave"
            subtitle="Apply for time off or sick leave"
            onPress={onPressRequestLeave}
          />

          <ActionRow
            iconName="calendar-outline"
            iconBg="bg-violet-50"
            iconColor="#7C3AED"
            title="Work Schedule"
            subtitle="View your shifts and work timings"
            onPress={onPressWorkSchedule}
          />

          {/* Attendance overview */}
          <Text className="text-lg font-bold text-gray-900 mt-8 mb-4">Attendance Overview</Text>

          <View className="flex-row" style={{ gap: 14 }}>
            <StatCard
              iconName="person"
              iconBg="bg-violet-50"
              iconColor="#7C3AED"
              value={data.daysPresent}
              label="Days Present"
            />
            <StatCard
              iconName="person"
              iconBg="bg-red-50"
              iconColor="#EF4444"
              value={data.daysAbsent}
              label="Days Absent"
            />
          </View>

          {/* Quit */}
          <View className="items-center mt-8">
            <TouchableOpacity
              onPress={onPressQuitJob}
              activeOpacity={0.9}
              className="w-full max-w-md bg-red-50 border border-red-200 rounded-xl py-3 flex-row items-center justify-center"
            >
              <Text className="text-red-700 text-base font-bold mr-2">Quit Job</Text>
              <Ionicons name="close" size={18} color="#dc2626" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const ActionRow: React.FC<{
  iconName: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
}> = ({ iconName, iconBg, iconColor, title, subtitle, onPress }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-3 flex-row items-center"
    >
      <View className={`w-12 h-12 rounded-full items-center justify-center ${iconBg}`}>
        <Ionicons name={iconName} size={22} color={iconColor} />
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-base font-bold text-gray-900">{title}</Text>
        <Text className="text-gray-600 mt-0.5 text-xs">{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
    </TouchableOpacity>
  );
};

const StatCard: React.FC<{
  iconName: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  value: number;
  label: string;
}> = ({ iconName, iconBg, iconColor, value, label }) => {
  return (
    <View className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <View className={`w-12 h-12 rounded-full items-center justify-center ${iconBg}`}>
        <Ionicons name={iconName} size={22} color={iconColor} />
      </View>
      <Text className="text-2xl font-bold text-gray-900 mt-3">{value}</Text>
      <Text className="text-gray-600 mt-1 text-xs">{label}</Text>
    </View>
  );
};

export default ActiveJobManager;