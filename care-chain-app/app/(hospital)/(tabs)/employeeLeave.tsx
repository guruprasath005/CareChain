import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useHospitalLeaveRequests } from '@/hooks';
import { Colors } from '@/constants/Colors';

type LeaveStatus = 'pending' | 'approved' | 'rejected';

type StatusBadge = {
  bg: string;
  text: string;
  label: string;
};

export default function EmployeeLeaveScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const assignmentId = id ? String(id) : '';

  const { requests, isLoading, error, refresh, processRequest } =
    useHospitalLeaveRequests(undefined, assignmentId);

  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return requests;
    const q = searchQuery.toLowerCase();
    return requests.filter(
      (req) =>
        req.doctorName.toLowerCase().includes(q) ||
        req.doctorRole.toLowerCase().includes(q)
    );
  }, [requests, searchQuery]);

  const pendingCount = requests.filter((req) => req.status === 'pending').length;
  const approvedCount = requests.filter((req) => req.status === 'approved').length;
  const rejectedCount = requests.filter((req) => req.status === 'rejected').length;

  const todayLabel = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });

  const onLeaveToday = useMemo(() => {
    const now = new Date();
    return requests.filter((req) => {
      if (req.status !== 'approved') return false;
      const start = new Date(req.startDate);
      const end = new Date(req.endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
      return start <= now && end >= now;
    }).length;
  }, [requests]);

  const getStatusBadge = (status: LeaveStatus): StatusBadge => {
    switch (status) {
      case 'approved':
        return { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' };
      case 'rejected':
        return { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' };
      default:
        return { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Pending' };
    }
  };

  const confirmAndProcess = (requestId: string, action: 'approve' | 'reject') => {
    const title = action === 'approve' ? 'Approve Leave' : 'Reject Leave';
    const msg =
      action === 'approve'
        ? 'Are you sure you want to approve this leave request?'
        : 'Are you sure you want to reject this leave request?';

    Alert.alert(title, msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action === 'approve' ? 'Approve' : 'Reject',
        style: action === 'approve' ? 'default' : 'destructive',
        onPress: async () => {
          const result = await processRequest(requestId, action);
          if (result.success) {
            Alert.alert('Success', action === 'approve' ? 'Leave approved' : 'Leave rejected');
          } else {
            Alert.alert('Error', result.error || 'Something went wrong');
          }
        },
      },
    ]);
  };

  const defaultAvatar = require('../../assets/images/logo.png');

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-5 pt-4 pb-4 border-b border-gray-100">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="p-2 rounded-full">
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-900 ml-2">Leave Management</Text>
        </View>

        <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3 mt-4">
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            placeholder="Search doctors..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 ml-2 text-gray-900"
          />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand.primary]} />
        }
      >
        {isLoading ? (
          <View className="items-center py-10">
            <ActivityIndicator className="text-brand-primary" size="large" />
            <Text className="text-gray-500 mt-3">Loading leave requests...</Text>
          </View>
        ) : error ? (
          <View className="items-center py-10 px-6">
            <Text className="text-gray-600 text-center">{error}</Text>
            <TouchableOpacity
              className="mt-4 bg-brand-primary px-4 py-2 rounded-lg"
              onPress={onRefresh}
            >
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View className="flex-row px-5 pt-4" style={{ gap: 12 }}>
              <View className="flex-1 bg-white rounded-xl border border-gray-200 p-4 items-center">
                <View className="flex-row items-center">
                  <View className="w-2 h-2 rounded-full bg-orange-500 mr-2" />
                  <Text className="text-gray-500 text-sm">Pending</Text>
                </View>
                <Text className="text-3xl font-bold text-gray-900 mt-2">{pendingCount}</Text>
              </View>
              <View className="flex-1 bg-white rounded-xl border border-gray-200 p-4 items-center">
                <View className="flex-row items-center">
                  <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                  <Text className="text-gray-500 text-sm">On Leave Today</Text>
                </View>
                <Text className="text-3xl font-bold text-gray-900 mt-2">{onLeaveToday}</Text>
              </View>
            </View>

            <View className="flex-row px-5 pt-3" style={{ gap: 12 }}>
              <View className="flex-1 bg-white rounded-xl border border-gray-200 p-4 items-center">
                <View className="flex-row items-center">
                  <View className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
                  <Text className="text-gray-500 text-sm">Approved</Text>
                </View>
                <Text className="text-3xl font-bold text-gray-900 mt-2">{approvedCount}</Text>
              </View>
              <View className="flex-1 bg-white rounded-xl border border-gray-200 p-4 items-center">
                <View className="flex-row items-center">
                  <View className="w-2 h-2 rounded-full bg-rose-500 mr-2" />
                  <Text className="text-gray-500 text-sm">Rejected</Text>
                </View>
                <Text className="text-3xl font-bold text-gray-900 mt-2">{rejectedCount}</Text>
              </View>
            </View>

            <View className="flex-row items-center justify-between px-5 mt-6 mb-3">
              <Text className="text-xl font-bold text-gray-900">Today, {todayLabel}</Text>
              <TouchableOpacity disabled>
                <Text className="text-brand-primary font-semibold opacity-70">View Calendar</Text>
              </TouchableOpacity>
            </View>

            <View className="px-5">
              {filteredRequests.length === 0 ? (
                <View className="items-center py-10">
                  <Feather name="calendar" size={48} color="#9CA3AF" />
                  <Text className="text-gray-500 mt-3">No leave requests</Text>
                </View>
              ) : (
                filteredRequests.map((req) => {
                  const badge = getStatusBadge(req.status as LeaveStatus);
                  const startLabel = new Date(req.startDate).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                  });
                  const endLabel = new Date(req.endDate).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                  });

                  return (
                    <View
                      key={req.id}
                      className="bg-white rounded-xl border border-gray-200 p-4 mb-3"
                    >
                      <View className="flex-row items-center">
                        <Image
                          source={req.doctorAvatar ? { uri: req.doctorAvatar } : defaultAvatar}
                          className="w-12 h-12 rounded-full"
                        />
                        <View className="flex-1 ml-3">
                          <Text className="font-bold text-gray-900">{req.doctorName}</Text>
                          <Text className="text-gray-500 text-sm">{req.doctorRole}</Text>
                        </View>
                        <View className={`px-3 py-1 rounded-full ${badge.bg}`}>
                          <Text className={`text-xs font-semibold ${badge.text}`}>{badge.label}</Text>
                        </View>
                      </View>

                      <View className="flex-row items-center mt-3">
                        <Feather name="calendar" size={16} color="#6B7280" />
                        <Text className="ml-2 text-gray-700 text-sm">
                          {startLabel} – {endLabel}
                        </Text>
                        <View className="ml-2 px-2 py-0.5 bg-gray-100 rounded">
                          <Text className="text-gray-500 text-xs">{req.totalDays} Days</Text>
                        </View>
                      </View>

                      <View className="flex-row items-start mt-2">
                        <Feather name="file-text" size={16} color="#6B7280" className="mt-0.5" />
                        <Text className="ml-2 text-gray-600 text-sm flex-1" numberOfLines={2}>
                          {req.reason}
                        </Text>
                      </View>

                      {req.status === 'pending' && (
                        <View className="flex-row justify-end mt-4" style={{ gap: 10 }}>
                          <TouchableOpacity
                            onPress={() => confirmAndProcess(req.id, 'reject')}
                            className="px-5 py-2 rounded-lg border border-gray-300"
                          >
                            <Text className="text-gray-700 font-semibold">Reject</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => confirmAndProcess(req.id, 'approve')}
                            className="px-5 py-2 rounded-lg bg-brand-primary"
                          >
                            <Text className="text-white font-semibold">Approve</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}

        <View className="h-6" />
      </ScrollView>
    </View>
  );
}
