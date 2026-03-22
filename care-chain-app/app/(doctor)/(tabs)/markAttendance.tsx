import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAttendance } from '@/hooks';

// Helper to get status display info
const getStatusDisplayInfo = (status: string, approvalStatus: string) => {
  switch (status) {
    case 'checkin_pending':
      return {
        icon: 'hourglass-outline' as const,
        color: '#f59e0b',
        bgColor: 'bg-amber-100',
        text: 'Check-in Pending',
        subtext: 'Waiting for hospital confirmation',
      };
    case 'checked_in':
      return {
        icon: 'checkmark-circle' as const,
        color: '#059669',
        bgColor: 'bg-green-100',
        text: 'Checked In',
        subtext: approvalStatus === 'confirmed' ? 'Confirmed by hospital' : 'Active shift',
      };
    case 'checkout_pending':
      return {
        icon: 'hourglass-outline' as const,
        color: '#f59e0b',
        bgColor: 'bg-amber-100',
        text: 'Check-out Pending',
        subtext: 'Waiting for hospital confirmation',
      };
    case 'checked_out':
      return {
        icon: 'checkmark-done-circle' as const,
        color: '#059669',
        bgColor: 'bg-green-100',
        text: 'Checked Out',
        subtext: 'Shift completed for today',
      };
    case 'cancelled':
      return {
        icon: 'close-circle' as const,
        color: '#dc2626',
        bgColor: 'bg-red-100',
        text: 'Cancelled',
        subtext: 'Attendance was cancelled by hospital',
      };
    case 'absent':
      return {
        icon: 'alert-circle' as const,
        color: '#dc2626',
        bgColor: 'bg-red-100',
        text: 'Marked Absent',
        subtext: 'You were marked absent by hospital',
      };
    default:
      return {
        icon: 'finger-print' as const,
        color: '#1A1464',
        bgColor: 'bg-blue-100',
        text: 'Not Checked In',
        subtext: 'Tap to start your shift',
      };
  }
};

export default function MarkAttendanceScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    status,
    approvalStatus,
    todayRecord,
    history,
    isLoading,
    error,
    notification,
    checkIn,
    checkOut,
    clearNotification,
    refresh
  } = useAttendance(id!);

  // Show notification alerts
  useEffect(() => {
    if (notification) {
      Alert.alert('Attendance Update', notification, [
        { text: 'OK', onPress: clearNotification }
      ]);
    }
  }, [notification, clearNotification]);

  // Mock location for now - in real app would use expo-location
  const mockLocation = { latitude: 0, longitude: 0 };

  const handleAction = async () => {
    if (status === 'none' || status === 'cancelled' || status === 'absent') {
      const result = await checkIn(mockLocation);
      if (result.success) {
        Alert.alert('Check-in Submitted', result.message || 'Your check-in has been submitted and is awaiting hospital confirmation.');
      }
    } else if (status === 'checked_in') {
      const result = await checkOut(mockLocation);
      if (result.success) {
        Alert.alert('Check-out Submitted', result.message || 'Your check-out has been submitted and is awaiting hospital confirmation.');
      }
    }
  };

  if (!id) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>No Assignment ID provided</Text>
      </View>
    )
  }

  if (isLoading && !todayRecord) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#1A1464" />
      </View>
    )
  }

  const statusInfo = getStatusDisplayInfo(status, approvalStatus);
  const isPending = status === 'checkin_pending' || status === 'checkout_pending';
  const canCheckIn = status === 'none' || status === 'cancelled' || status === 'absent';
  const canCheckOut = status === 'checked_in';
  const isCompleted = status === 'checked_out';

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white p-6 pb-8 rounded-b-3xl shadow-sm">
        <View className="flex-row justify-between items-center mb-6">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900">Attendance</Text>
          <TouchableOpacity onPress={refresh} className="p-2">
            <Ionicons name="refresh" size={24} color="#1F2937" />
          </TouchableOpacity>
        </View>

        <View className="items-center">
          {/* Status Circle */}
          <View className={`w-32 h-32 rounded-full items-center justify-center mb-6 ${statusInfo.bgColor}`}>
            <Ionicons
              name={statusInfo.icon}
              size={64}
              color={statusInfo.color}
            />
          </View>

          <Text className="text-gray-500 text-base mb-1">Current Status</Text>
          <Text className="text-3xl font-bold text-gray-900 mb-2">{statusInfo.text}</Text>
          <Text className="text-gray-500 text-sm mb-6">{statusInfo.subtext}</Text>

          {/* Pending Indicator */}
          {isPending && (
            <View className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 w-full">
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="#f59e0b" />
                <Text className="ml-3 text-amber-800 font-medium">
                  Waiting for hospital to confirm...
                </Text>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          {canCheckIn && (
            <TouchableOpacity
              onPress={handleAction}
              disabled={isLoading}
              className="w-full py-4 rounded-xl flex-row items-center justify-center bg-blue-600"
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={24} color="white" style={{ marginRight: 8 }} />
                  <Text className="text-white text-lg font-bold">Check In</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {canCheckOut && !isPending && (
            <TouchableOpacity
              onPress={handleAction}
              disabled={isLoading}
              className="w-full py-4 rounded-xl flex-row items-center justify-center bg-red-500"
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={24} color="white" style={{ marginRight: 8 }} />
                  <Text className="text-white text-lg font-bold">Check Out</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {isCompleted && (
            <View className="bg-green-50 px-6 py-3 rounded-xl border border-green-200">
              <View className="flex-row items-center">
                <Ionicons name="checkmark-circle" size={24} color="#059669" />
                <Text className="text-green-700 font-medium ml-2">Shift Completed for Today</Text>
              </View>
            </View>
          )}

          {error && (
            <Text className="text-red-500 mt-4 text-center">{error}</Text>
          )}
        </View>
      </View>

      {/* Today's Record Details */}
      {todayRecord && (
        <View className="px-6 pt-6">
          <Text className="text-lg font-bold text-gray-900 mb-4">Today's Record</Text>
          <View className="bg-white rounded-xl p-4 shadow-sm">
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center">
                <Ionicons name="log-in-outline" size={20} color="#059669" />
                <Text className="ml-2 text-gray-600">Check In</Text>
              </View>
              <Text className="font-semibold text-gray-900">
                {todayRecord.checkIn?.time 
                  ? new Date(todayRecord.checkIn.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '--:--'}
              </Text>
            </View>
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center">
                <Ionicons name="log-out-outline" size={20} color="#dc2626" />
                <Text className="ml-2 text-gray-600">Check Out</Text>
              </View>
              <Text className="font-semibold text-gray-900">
                {todayRecord.checkOut?.time 
                  ? new Date(todayRecord.checkOut.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '--:--'}
              </Text>
            </View>
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center">
                <Ionicons name="checkmark-circle-outline" size={20} color={todayRecord.isApproved ? '#059669' : '#f59e0b'} />
                <Text className="ml-2 text-gray-600">Status</Text>
              </View>
              <View className={`px-3 py-1 rounded-full ${
                approvalStatus === 'confirmed' ? 'bg-green-100' :
                approvalStatus === 'pending' ? 'bg-amber-100' :
                approvalStatus === 'cancelled' ? 'bg-red-100' : 'bg-gray-100'
              }`}>
                <Text className={`text-xs font-semibold ${
                  approvalStatus === 'confirmed' ? 'text-green-700' :
                  approvalStatus === 'pending' ? 'text-amber-700' :
                  approvalStatus === 'cancelled' ? 'text-red-700' : 'text-gray-600'
                }`}>
                  {approvalStatus === 'confirmed' ? 'CONFIRMED' :
                   approvalStatus === 'pending' ? 'PENDING' :
                   approvalStatus === 'cancelled' ? 'CANCELLED' :
                   approvalStatus === 'absent' ? 'ABSENT' : todayRecord.status?.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* History */}
      <View className="p-6">
        <Text className="text-lg font-bold text-gray-900 mb-4">Recent Activity</Text>
        {history.length === 0 ? (
          <Text className="text-gray-500 text-center py-8">No attendance history yet</Text>
        ) : (
          history.map((record) => {
            const isConfirmed = record.status === 'checkin_confirmed' || 
                               record.status === 'checkout_confirmed' ||
                               record.status === 'present';
            const isPendingRecord = record.status === 'checkin_pending' || 
                                   record.status === 'checkout_pending';
            const isCancelled = record.status === 'cancelled';
            const isAbsent = record.status === 'absent';

            return (
              <View 
                key={record.id} 
                className={`p-4 rounded-xl mb-3 flex-row justify-between items-center shadow-sm border ${
                  isConfirmed ? 'bg-green-50 border-green-200' :
                  isPendingRecord ? 'bg-amber-50 border-amber-200' :
                  isCancelled ? 'bg-red-50 border-red-200' :
                  isAbsent ? 'bg-red-50 border-red-200' :
                  'bg-white border-gray-100'
                }`}
              >
                <View className="flex-row items-center">
                  <View className="bg-gray-100 p-3 rounded-lg mr-4">
                    <Text className="text-gray-600 font-bold text-center">
                      {new Date(record.date).getDate()}
                    </Text>
                    <Text className="text-xs text-gray-500 uppercase">
                      {new Date(record.date).toLocaleDateString('en-US', { month: 'short' })}
                    </Text>
                  </View>
                  <View>
                    <Text className="font-semibold text-gray-900">
                      {record.workDuration
                        ? `${record.workDuration.hours}h ${record.workDuration.minutes}m`
                        : isPendingRecord ? 'Pending' : 'In Progress'}
                    </Text>
                    <Text className="text-gray-500 text-sm">
                      {record.checkIn?.time ? new Date(record.checkIn.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'} -
                      {record.checkOut?.time ? new Date(record.checkOut.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ' ...'}
                    </Text>
                  </View>
                </View>
                <View className={`px-3 py-1 rounded-full ${
                  isConfirmed ? 'bg-green-100' :
                  isPendingRecord ? 'bg-amber-100' :
                  isCancelled || isAbsent ? 'bg-red-100' : 'bg-gray-100'
                }`}>
                  <Text className={`text-xs font-medium ${
                    isConfirmed ? 'text-green-700' :
                    isPendingRecord ? 'text-amber-700' :
                    isCancelled || isAbsent ? 'text-red-700' : 'text-gray-600'
                  }`}>
                    {record.status?.replace(/_/g, ' ').toUpperCase() || 'UNKNOWN'}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}
