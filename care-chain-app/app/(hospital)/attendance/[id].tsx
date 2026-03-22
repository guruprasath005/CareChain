import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Alert,
    Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEmployeeAttendance, useMarkAttendance } from '@/hooks';
import { attendanceApi } from '@/services/api';

// Extended status types for approval workflow
type AttendanceStatus = 
    | 'present' 
    | 'checked_in' 
    | 'checked_out' 
    | 'absent' 
    | 'half_day' 
    | 'not_marked'
    | 'checkin_pending'
    | 'checkout_pending'
    | 'checkin_confirmed'
    | 'checkout_confirmed'
    | 'cancelled';

export default function MarkAttendanceScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { todayStatus, isLoading: loadingStatus, refreshTodayStatus } = useEmployeeAttendance(id);
    const { markAttendance, isLoading: marking } = useMarkAttendance();
    const [processingAction, setProcessingAction] = useState<string | null>(null);
    const defaultAvatar = require('../../assets/images/logo.png');

    // Handle approval actions
    const handleConfirmCheckIn = async () => {
        if (!todayStatus?.attendance?.id) return;
        setProcessingAction('confirm');
        try {
            const result = await attendanceApi.confirmCheckIn(todayStatus.attendance.id);
            if (result.success) {
                Alert.alert('Success', 'Check-in confirmed');
                refreshTodayStatus();
            } else {
                Alert.alert('Error', result.error || 'Failed to confirm check-in');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to confirm check-in');
        } finally {
            setProcessingAction(null);
        }
    };

    const handleConfirmCheckOut = async () => {
        if (!todayStatus?.attendance?.id) return;
        setProcessingAction('confirm');
        try {
            const result = await attendanceApi.confirmCheckOut(todayStatus.attendance.id);
            if (result.success) {
                Alert.alert('Success', 'Check-out confirmed');
                refreshTodayStatus();
                router.back();
            } else {
                Alert.alert('Error', result.error || 'Failed to confirm check-out');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to confirm check-out');
        } finally {
            setProcessingAction(null);
        }
    };

    const handleCancelAttendance = async () => {
        if (!todayStatus?.attendance?.id) return;
        Alert.alert(
            'Cancel Attendance',
            'Are you sure you want to cancel this attendance request?',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: async () => {
                        setProcessingAction('cancel');
                        try {
                            const result = await attendanceApi.cancelAttendance(todayStatus.attendance.id);
                            if (result.success) {
                                Alert.alert('Success', 'Attendance cancelled');
                                refreshTodayStatus();
                                router.back();
                            }
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to cancel');
                        } finally {
                            setProcessingAction(null);
                        }
                    },
                },
            ]
        );
    };

    const handleMarkAbsent = async () => {
        Alert.alert(
            'Mark Absent',
            'Are you sure you want to mark this employee as absent?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Mark Absent',
                    style: 'destructive',
                    onPress: async () => {
                        setProcessingAction('absent');
                        try {
                            let result;
                            if (todayStatus?.attendance?.id) {
                                result = await attendanceApi.markAbsent(todayStatus.attendance.id);
                            } else {
                                result = await attendanceApi.createAbsentRecord(id!);
                            }
                            if (result.success) {
                                Alert.alert('Success', 'Marked as absent');
                                refreshTodayStatus();
                                router.back();
                            }
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to mark absent');
                        } finally {
                            setProcessingAction(null);
                        }
                    },
                },
            ]
        );
    };

    if (loadingStatus || !todayStatus) {
        return (
            <View className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#1A1464" />
                <Text className="mt-4 text-gray-500">Loading details...</Text>
            </View>
        );
    }

    const { employee, status, attendance } = todayStatus;

    // Map status to display
    const getStatusBadge = () => {
        switch (status) {
            case 'checkin_pending':
                return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'CHECK-IN PENDING' };
            case 'checkout_pending':
                return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'CHECK-OUT PENDING' };
            case 'checkin_confirmed':
            case 'present':
            case 'checked_in':
                return { bg: 'bg-green-100', text: 'text-green-700', label: 'PRESENT' };
            case 'checkout_confirmed':
            case 'checked_out':
                return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'CHECKED OUT' };
            case 'absent':
                return { bg: 'bg-red-100', text: 'text-red-700', label: 'ABSENT' };
            case 'cancelled':
                return { bg: 'bg-red-100', text: 'text-red-700', label: 'CANCELLED' };
            default:
                return { bg: 'bg-gray-100', text: 'text-gray-600', label: 'NOT MARKED' };
        }
    };

    const badge = getStatusBadge();
    const isPending = status === 'checkin_pending' || status === 'checkout_pending';
    const isProcessing = processingAction !== null || marking;

    return (
        <View className="flex-1 bg-gray-50">
            {/* Header */}
            <View className="bg-white px-5 pt-12 pb-4 border-b border-gray-100 flex-row items-center">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="h-10 w-10 items-center justify-center -ml-2 rounded-full active:bg-gray-100"
                >
                    <Ionicons name="arrow-back" size={24} color="black" />
                </TouchableOpacity>
                <Text className="text-lg font-bold text-gray-900 ml-2">Mark Attendance</Text>
            </View>

            <ScrollView className="flex-1 px-5 pt-6">
                {/* Employee Card */}
                <View className={`rounded-2xl p-5 shadow-sm border mb-6 ${
                    isPending ? 'bg-amber-50 border-amber-200' :
                    status === 'checkin_confirmed' || status === 'present' ? 'bg-green-50 border-green-200' :
                    status === 'checkout_confirmed' || status === 'checked_out' ? 'bg-green-50 border-green-200' :
                    'bg-white border-gray-100'
                }`}>
                    <View className="flex-row items-center mb-4">
                        <Image
                            source={employee.avatar ? { uri: employee.avatar } : defaultAvatar}
                            className="w-16 h-16 rounded-full bg-gray-100"
                            defaultSource={defaultAvatar}
                        />
                        <View className="ml-4 flex-1">
                            <Text className="text-lg font-bold text-gray-900">{employee.doctorName}</Text>
                            <Text className="text-gray-500">{employee.role}</Text>
                        </View>
                        <View className={`px-3 py-1.5 rounded-full ${badge.bg}`}>
                            <Text className={`text-xs font-bold ${badge.text}`}>{badge.label}</Text>
                        </View>
                    </View>

                    <View className="flex-row items-center bg-gray-50 p-3 rounded-xl">
                        <Ionicons name="time-outline" size={20} color="#6b7280" />
                        <Text className="ml-2 text-gray-600 font-medium">Shift: {employee.shift || 'Regular'}</Text>
                    </View>
                </View>

                {/* Current Status Details */}
                {attendance && (
                    <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
                        <Text className="text-gray-900 font-bold mb-4">Today's Activity</Text>

                        <View className="flex-row items-center justify-between mb-3">
                            <View className="flex-row items-center">
                                <View className="w-8 h-8 rounded-full bg-green-100 items-center justify-center mr-3">
                                    <Ionicons name="log-in-outline" size={18} color="#15803d" />
                                </View>
                                <Text className="text-gray-600">Check In</Text>
                            </View>
                            <Text className="font-semibold text-gray-900">
                                {attendance.checkInTime || attendance.checkIn?.time
                                    ? new Date(attendance.checkInTime || attendance.checkIn?.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                    : '--:--'}
                            </Text>
                        </View>

                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center mr-3">
                                    <Ionicons name="log-out-outline" size={18} color="#1d4ed8" />
                                </View>
                                <Text className="text-gray-600">Check Out</Text>
                            </View>
                            <Text className="font-semibold text-gray-900">
                                {attendance.checkOutTime || attendance.checkOut?.time
                                    ? new Date(attendance.checkOutTime || attendance.checkOut?.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                    : '--:--'}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Pending Approval Notice */}
                {isPending && (
                    <View className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                        <View className="flex-row items-center">
                            <Ionicons name="hourglass-outline" size={24} color="#f59e0b" />
                            <View className="ml-3 flex-1">
                                <Text className="text-amber-800 font-bold">
                                    {status === 'checkin_pending' ? 'Check-in Awaiting Approval' : 'Check-out Awaiting Approval'}
                                </Text>
                                <Text className="text-amber-600 text-sm">
                                    The doctor is waiting for your confirmation
                                </Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Action Buttons */}
                <Text className="text-gray-500 font-semibold mb-3 ml-1">ACTIONS</Text>

                <View className="gap-3">
                    {/* Pending approval actions */}
                    {isPending && (
                        <>
                            <TouchableOpacity
                                onPress={status === 'checkin_pending' ? handleConfirmCheckIn : handleConfirmCheckOut}
                                disabled={isProcessing}
                                className="bg-green-600 py-4 rounded-xl flex-row items-center justify-center shadow-sm active:bg-green-700"
                            >
                                {processingAction === 'confirm' ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-circle" size={24} color="white" />
                                        <Text className="text-white font-bold text-lg ml-2">
                                            Confirm {status === 'checkin_pending' ? 'Check-in' : 'Check-out'}
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleCancelAttendance}
                                disabled={isProcessing}
                                className="bg-gray-200 py-4 rounded-xl flex-row items-center justify-center active:bg-gray-300"
                            >
                                <Ionicons name="close-circle-outline" size={24} color="#374151" />
                                <Text className="text-gray-700 font-bold text-lg ml-2">Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleMarkAbsent}
                                disabled={isProcessing}
                                className="bg-white border-2 border-red-100 py-4 rounded-xl flex-row items-center justify-center active:bg-red-50"
                            >
                                <Ionicons name="alert-circle-outline" size={24} color="#dc2626" />
                                <Text className="text-red-600 font-bold text-lg ml-2">Mark Absent</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {/* Not marked actions */}
                    {(status === 'not_marked') && (
                        <TouchableOpacity
                            onPress={handleMarkAbsent}
                            disabled={isProcessing}
                            className="bg-white border-2 border-red-100 py-4 rounded-xl flex-row items-center justify-center active:bg-red-50"
                        >
                            {processingAction === 'absent' ? (
                                <ActivityIndicator color="#dc2626" />
                            ) : (
                                <>
                                    <Ionicons name="close-circle-outline" size={24} color="#dc2626" />
                                    <Text className="text-red-600 font-bold text-lg ml-2">Mark Absent</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}

                    {/* Confirmed check-in - waiting for checkout */}
                    {(status === 'checkin_confirmed' || status === 'present' || status === 'checked_in') && !attendance?.checkOut && (
                        <View className="bg-green-50 border border-green-200 rounded-xl p-4 items-center">
                            <Ionicons name="checkmark-circle" size={32} color="#059669" />
                            <Text className="text-green-700 font-medium mt-2">Check-in Confirmed</Text>
                            <Text className="text-green-600 text-sm">Waiting for doctor to check out</Text>
                        </View>
                    )}

                    {/* Completed */}
                    {(status === 'checkout_confirmed' || status === 'checked_out') && (
                        <View className="p-4 bg-green-100 rounded-xl items-center">
                            <Ionicons name="checkmark-done-circle" size={32} color="#059669" />
                            <Text className="text-green-700 font-bold mt-2">Attendance Completed for Today</Text>
                        </View>
                    )}

                    {/* Cancelled or Absent */}
                    {(status === 'cancelled' || status === 'absent') && (
                        <View className="p-4 bg-red-50 border border-red-200 rounded-xl items-center">
                            <Ionicons name={status === 'cancelled' ? "close-circle" : "alert-circle"} size={32} color="#dc2626" />
                            <Text className="text-red-700 font-bold mt-2">
                                {status === 'cancelled' ? 'Attendance Cancelled' : 'Marked as Absent'}
                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}