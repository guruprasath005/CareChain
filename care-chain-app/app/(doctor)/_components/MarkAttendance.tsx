import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MarkAttendanceData } from '../../../data/activeJobs';

export type MarkAttendanceProps = {
  data: MarkAttendanceData;
  onPressNotifications?: () => void;
  onPressSettings?: () => void;
  onPressCheckOut?: () => void;
  onPressViewAll?: () => void;
};

const MarkAttendance: React.FC<MarkAttendanceProps> = ({
  data,
  onPressCheckOut,
  onPressViewAll,
}) => {
  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ paddingBottom: 16 }}>
      {/* Header */}
      <View className="px-5 pt-8">
        <View className="w-full max-w-2xl self-center">
          <View>
            <Text className="text-gray-900 text-xl font-bold">{data.doctorName}</Text>
            <Text className="text-gray-600 text-sm font-medium mt-1">{data.doctorRole}</Text>
          </View>

          {/* Active assignment card */}
          <View className="mt-7 bg-white rounded-xl border border-gray-300 p-4">
            <Text className="text-gray-500 text-sm font-medium">ACTIVE ASSIGNMENT</Text>

            <View className="flex-row items-center justify-between mt-2">
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 rounded-lg bg-gray-100 items-center justify-center">
                  <Ionicons name="business" size={18} color="#4b5563" />
                </View>

                <View className="ml-3 flex-1">
                  <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>
                    {data.clinicName}
                  </Text>
                  <Text className="text-gray-500 text-sm mt-1">Shift: {data.shiftRange}</Text>
                </View>
              </View>

              <View className="px-3 py-1 rounded-full bg-emerald-100">
                <Text className="text-emerald-700 text-xs font-bold">{data.assignmentStatus}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Checked-in card */}
      <View className="px-5 mt-6">
        <View className="w-full max-w-2xl self-center">
          <View className="bg-white rounded-xl border border-gray-300 p-5 items-center">
            <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center">
              <View className="w-14 h-14 rounded-full bg-gray-200 items-center justify-center">
                <Ionicons name="time" size={24} color="#4b5563" />
              </View>
              <View className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 items-center justify-center border-2 border-white">
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              </View>
            </View>

            <Text className="text-2xl font-bold text-gray-900 mt-4">{data.attendanceState}</Text>

            <View className="mt-2 px-3 py-1 rounded-full bg-gray-100">
              <Text className="text-gray-700 text-sm font-medium">at {data.checkedInLabel}</Text>
            </View>

            <TouchableOpacity
              onPress={onPressCheckOut}
              activeOpacity={0.9}
              className="mt-5 w-full max-w-md bg-blue-600 rounded-lg py-3 flex-row items-center justify-center"
            >
              <Ionicons name="exit-outline" size={18} color="#FFFFFF" />
              <Text className="text-white text-base font-bold ml-2">CHECK OUT</Text>
            </TouchableOpacity>

            <Text className="text-gray-500 mt-4 text-center text-sm">Tap to end your shift at {data.clinicName}</Text>
          </View>

          {/* Recent Activity */}
          <View className="mt-8 flex-row items-center justify-between">
            <Text className="text-xl font-bold text-gray-900">Recent Activity</Text>
            <TouchableOpacity onPress={onPressViewAll} activeOpacity={0.85}>
              <Text className="text-blue-600 text-sm font-medium">View All</Text>
            </TouchableOpacity>
          </View>

          <View className="mt-4 bg-white rounded-xl border border-gray-300 overflow-hidden">
            {data.recentActivity.map((item) => (
              <View key={item.id} className="px-4 py-4 border-b border-gray-200 flex-row items-center">
                <View className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center">
                  <Text className="text-gray-500 text-xs">{item.day}</Text>
                  <Text className="text-gray-900 text-lg font-bold -mt-1">{item.date}</Text>
                </View>

                <View className="flex-1 ml-3">
                  <Text className="text-lg font-bold text-gray-900">{item.title}</Text>
                  <Text className="text-gray-500 text-sm mt-1">{item.duration}</Text>
                </View>

                <View>
                  <View className="flex-row items-center justify-end">
                    <Ionicons name="enter-outline" size={14} color="#16A34A" />
                    <Text className="text-green-600 text-xs font-bold ml-1">{item.inTime}</Text>
                  </View>
                  <View className="flex-row items-center justify-end mt-1">
                    <Ionicons name="exit-outline" size={14} color="#F97316" />
                    <Text className="text-orange-500 text-xs font-bold ml-1">{item.outTime}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

export default MarkAttendance;