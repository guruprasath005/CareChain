import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function EmployeeProfileChooserScreen() {
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id?: string }>();
	const assignmentId = id ? String(id) : '';

	if (!assignmentId) {
		return (
			<View className="flex-1 bg-white items-center justify-center px-6">
				<Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
				<Text className="mt-3 text-gray-900 font-semibold">Missing employee id</Text>
				<TouchableOpacity className="mt-4" onPress={() => router.back()}>
					<Text className="text-indigo-700 font-semibold">Go Back</Text>
				</TouchableOpacity>
			</View>
		);
	}

	return (
		<View className="flex-1 bg-white">
			{/* Header */}
			<View className="px-5 pt-4 pb-4 border-b border-gray-100 flex-row items-center">
				<TouchableOpacity onPress={() => router.back()} className="mr-3">
					<Ionicons name="arrow-back" size={24} color="#111827" />
				</TouchableOpacity>
				<Text className="text-lg font-bold text-gray-900">Employee</Text>
			</View>

			<View className="px-5 pt-6" style={{ gap: 12 }}>
				<TouchableOpacity
					activeOpacity={0.85}
					onPress={() =>
						router.push({
							pathname: '/(hospital)/(tabs)/markEmployeeAttendance' as any,
							params: { id: assignmentId },
						})
					}
					className="bg-white border border-gray-200 rounded-2xl p-5 flex-row items-center"
				>
					<View className="w-12 h-12 rounded-xl bg-indigo-50 items-center justify-center">
						<Ionicons name="finger-print" size={22} color="#1A1464" />
					</View>
					<View className="ml-4 flex-1">
						<Text className="text-base font-bold text-gray-900">Mark Attendance</Text>
						<Text className="text-sm text-gray-500 mt-0.5">Check in / check out</Text>
					</View>
					<Ionicons name="chevron-forward" size={22} color="#9CA3AF" />
				</TouchableOpacity>

				<TouchableOpacity
					activeOpacity={0.85}
					onPress={() =>
						router.push({
							pathname: '/(hospital)/(tabs)/employeeViewProfile' as any,
							params: { id: assignmentId },
						})
					}
					className="bg-white border border-gray-200 rounded-2xl p-5 flex-row items-center"
				>
					<View className="w-12 h-12 rounded-xl bg-gray-100 items-center justify-center">
						<Ionicons name="person-outline" size={22} color="#111827" />
					</View>
					<View className="ml-4 flex-1">
						<Text className="text-base font-bold text-gray-900">View Profile</Text>
						<Text className="text-sm text-gray-500 mt-0.5">Employment + contact details</Text>
					</View>
					<Ionicons name="chevron-forward" size={22} color="#9CA3AF" />
				</TouchableOpacity>
			</View>
		</View>
	);
}
