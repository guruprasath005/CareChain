import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MyScheduleData } from '../../../data/activeJobs';

export type MyScheduleProps = {
  data: MyScheduleData;
  onPressNotifications?: () => void;
  onPressSettings?: () => void;
};

const MySchedule: React.FC<MyScheduleProps> = ({ data, onPressNotifications, onPressSettings }) => {
  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ paddingBottom: 16 }}>
      {/* Header */}
      <View className="px-5 pt-8">
        <View className="w-full max-w-2xl self-center">
          <View>
            <Text className="text-gray-900 text-xl font-bold">{data.doctorName}</Text>
            <Text className="text-gray-600 text-sm font-medium mt-1">{data.doctorRole}</Text>
          </View>

          <Text className="text-gray-900 text-2xl font-bold mt-6">My Schedule</Text>
          <Text className="text-gray-600 text-sm font-medium mt-2">Manage your active duty timings</Text>
        </View>
      </View>

      {/* Today's Timing */}
      <View className="px-5 mt-6">
        <View className="w-full max-w-2xl self-center">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-gray-900">Today's Timing</Text>
            <View className="px-3 py-1 rounded-full bg-gray-100">
              <Text className="text-gray-700 text-sm font-medium">{data.todayDateLabel}</Text>
            </View>
          </View>

          {/* Today's card */}
          {data.today ? (
            <View className="mt-4 bg-white rounded-xl border border-gray-300 overflow-hidden">
              <View className="flex-row">
                <View className="w-1 bg-emerald-500" />
                <View className="flex-1 p-4">
                  <View className="flex-row">
                    <View className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden">
                      {data.today.imageUri ? (
                        <Image source={{ uri: data.today.imageUri }} className="w-full h-full" />
                      ) : (
                        <View className="w-full h-full items-center justify-center">
                          <Ionicons name="image" size={18} color="#9CA3AF" />
                        </View>
                      )}
                    </View>

                    <View className="flex-1 ml-3">
                      <Text className="text-lg font-bold text-gray-900">{data.today.title}</Text>

                      <View className="flex-row items-center mt-1">
                        <Ionicons name="document-text-outline" size={14} color="#6B7280" />
                        <Text className="text-gray-500 text-sm ml-1 font-medium">{data.today.clinicName}</Text>
                      </View>

                      <View className="flex-row items-center mt-1">
                        <Ionicons name="location-outline" size={14} color="#6B7280" />
                        <Text className="text-gray-500 text-sm ml-1 font-medium">{data.today.location}</Text>
                      </View>
                    </View>
                  </View>

                  <View className="mt-4 bg-gray-50 rounded-lg border border-gray-200 p-3 flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-gray-500 text-xs font-medium">START</Text>
                      <Text className="text-2xl font-bold text-gray-900 mt-1">
                        {data.today.startTime}
                        <Text className="text-sm font-medium text-gray-500"> {data.today.startMeridiem}</Text>
                      </Text>
                    </View>

                    <View className="w-px bg-gray-200 mx-3" />

                    <View className="flex-1">
                      <Text className="text-gray-500 text-xs font-medium text-right">END</Text>
                      <Text className="text-2xl font-bold text-gray-900 mt-1 text-right">
                        {data.today.endTime}
                        <Text className="text-sm font-medium text-gray-500"> {data.today.endMeridiem}</Text>
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center mt-3" style={{ gap: 10 }}>
                    <View className="px-3 py-1 rounded-full bg-emerald-100">
                      <Text className="text-emerald-700 text-xs font-bold">{data.today.statusLabel}</Text>
                    </View>
                    <View className="px-3 py-1 rounded-full bg-gray-100">
                      <Text className="text-gray-600 text-xs font-medium">{data.today.shiftDurationLabel}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View className="mt-4 bg-white rounded-xl border border-gray-300 p-6 items-center">
              <Ionicons name="calendar-outline" size={48} color="#9CA3AF" />
              <Text className="text-gray-500 font-medium mt-2">No shifts scheduled for today</Text>
            </View>
          )}

          {/* Upcoming schedule */}
          <Text className="text-lg font-bold text-gray-900 mt-8">Upcoming Schedule</Text>

          {data.upcoming && data.upcoming.length > 0 ? (
            <View className="mt-4 bg-white rounded-xl border border-gray-300 overflow-hidden">
              {data.upcoming.map((item, idx) => (
                <View
                  key={item.id}
                  className={`px-4 py-4 ${idx === data.upcoming.length - 1 ? '' : 'border-b border-gray-200'} flex-row items-center`}
                >
                  <View
                    className={`w-14 h-14 rounded-full ${item.isOff ? 'bg-gray-100' : 'bg-indigo-100'} items-center justify-center`}
                  >
                    <Text className={`${item.isOff ? 'text-gray-400' : 'text-indigo-900'} text-xs font-bold`}>
                      {item.dayShort}
                    </Text>
                    <Text className={`${item.isOff ? 'text-gray-600' : 'text-indigo-900'} text-xl font-bold -mt-1`}>
                      {item.dayNumber}
                    </Text>
                  </View>

                  <View className="flex-1 ml-3">
                    <Text className={`text-base font-bold ${item.isOff ? 'text-gray-400' : 'text-gray-900'}`}>
                      {item.title}
                    </Text>
                    <Text className={`${item.isOff ? 'text-gray-400' : 'text-gray-500'} text-sm mt-1 font-medium`}>
                      {item.subtitle}
                    </Text>
                  </View>

                  {!item.isOff ? (
                    <View>
                      <Text className="text-gray-900 text-sm font-bold text-right">{item.startLabel}</Text>
                      <Text className="text-gray-500 text-xs font-medium text-right mt-1">{item.endLabel}</Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <View className="mt-4 bg-white rounded-xl border border-gray-300 p-6 items-center">
              <Text className="text-gray-500 font-medium">No upcoming shifts scheduled</Text>
            </View>
          )}

          <View className="mt-6 flex-row items-center justify-center">
            <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
            <Text className="text-gray-500 text-sm font-medium ml-2">
              Schedule changes are locked by administration.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

export default MySchedule;