import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
	View,
	Text,
	ScrollView,
	TouchableOpacity,
	Image,
	ActivityIndicator,
	Alert,
	RefreshControl,
	TextInput,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEmployeeAttendance, useEmployees } from '@/hooks';
import EmployerFeedbackForm from '@/app/_components/feedback/EmployerFeedbackForm';

export default function EmployeeViewProfileScreen() {
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id?: string }>();
	const { employees, isLoading, error, refetch, terminate, updateEmployee, updateStatus } = useEmployees();
	const [refreshing, setRefreshing] = useState(false);
	const [actionLoading, setActionLoading] = useState(false);
	const [isEditModalVisible, setIsEditModalVisible] = useState(false);
	const [editForm, setEditForm] = useState({
		jobTitle: '',
		department: '',
		shift: '',
		salary: '',
	});
	const [isFeedbackVisible, setIsFeedbackVisible] = useState(false);
	const [feedbackType, setFeedbackType] = useState<'completed' | 'terminated'>('completed');

	const employee = useMemo(() => {
		const key = String(id);
		return employees.find((e) => e.assignmentId === key || e.id === key);
	}, [employees, id]);

	const { todayStatus, refreshTodayStatus } = useEmployeeAttendance(employee?.assignmentId);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await refetch();
		await refreshTodayStatus();
		setRefreshing(false);
	}, [refetch, refreshTodayStatus]);

	useEffect(() => {
		if (!employee) return;
		setEditForm({
			jobTitle: employee.job?.title || '',
			department: employee.department || '',
			shift: employee.shift || '',
			salary: employee.salary !== undefined && employee.salary !== null ? String(employee.salary) : '',
		});
	}, [employee]);

	const attendanceStatus = useMemo(() => {
		const status = todayStatus?.status;
		const isOnDuty = status === 'checked_in' || status === 'present';
		const shiftText = todayStatus?.employee?.shift || employee?.shift || '';
		const shiftEnd = shiftText.includes('-') ? shiftText.split('-')[1]?.trim() : '';
		return {
			isOnDuty,
			shiftEnd: shiftEnd || '—',
			checkInTime: todayStatus?.attendance?.checkInTime ? new Date(todayStatus.attendance.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
		};
	}, [todayStatus, employee?.shift]);

	const formatPhone = (phone: any): string => {
		if (!phone) return '—';
		if (typeof phone === 'string') return phone;
		if (typeof phone === 'object') {
			const code = phone.countryCode || '';
			const num = phone.number || '';
			return num ? `${code}${num}`.trim() : '—';
		}
		return '—';
	};

	const handleMarkAttendance = () => {
		router.push({ pathname: '/(hospital)/(tabs)/markEmployeeAttendance' as any, params: { id: employee?.assignmentId } });
	};

	const handleManageLeave = () => {
		router.push({ pathname: '/(hospital)/(tabs)/employeeLeave' as any, params: { id: employee?.assignmentId } });
	};

	const handleSchedule = () => {
		router.push({ pathname: '/(hospital)/(tabs)/employeeSchedule' as any, params: { id: employee?.assignmentId } });
	};

	const handleMessage = () => {
		router.push({ pathname: '/(hospital)/(tabs)/messages' as any });
	};

	const handleMarkCompleted = () => {
		setFeedbackType('completed');
		setIsFeedbackVisible(true);
	};

	const onFeedbackSuccess = async () => {
		if (!employee?.assignmentId) return;
		setIsFeedbackVisible(false);
		setActionLoading(true);
		const result = await updateStatus(employee.assignmentId, 'completed');
		setActionLoading(false);
		if (result.success) {
			Alert.alert('Success', 'Employment marked as completed', [
				{ text: 'OK', onPress: () => router.back() },
			]);
		} else {
			Alert.alert('Error', result.error || 'Failed to mark as completed');
		}
	};

	const handleSaveEmploymentEdits = async () => {
		if (!employee?.assignmentId) return;
		setActionLoading(true);
		const payload = {
			jobTitle: editForm.jobTitle,
			department: editForm.department,
			shift: editForm.shift,
			salary: editForm.salary ? Number(editForm.salary) : undefined,
		};
		const result = await updateEmployee(employee.assignmentId, payload);
		setActionLoading(false);
		if (result.success) {
			setIsEditModalVisible(false);
			Alert.alert('Saved', 'Employment details updated');
		} else {
			Alert.alert('Error', result.error || 'Failed to update employee');
		}
	};

	const handleEndEmployment = () => {
		setFeedbackType('terminated');
		setIsFeedbackVisible(true);
	};

	const onTerminationFeedbackSuccess = async () => {
		if (!employee?.assignmentId) return;
		setIsFeedbackVisible(false);
		setActionLoading(true);
		const result = await terminate(employee.assignmentId, 'Terminated by hospital');
		setActionLoading(false);
		if (result.success) {
			Alert.alert('Success', 'Employment terminated', [
				{ text: 'OK', onPress: () => router.back() },
			]);
		} else {
			Alert.alert('Error', result.error || 'Failed to terminate');
		}
	};

	if (isLoading && !employee) {
		return (
			<View className="flex-1 bg-white items-center justify-center">
				<ActivityIndicator size="large" color="#1A1464" />
				<Text className="mt-3 text-gray-500">Loading employee...</Text>
			</View>
		);
	}

	if (error) {
		return (
			<View className="flex-1 bg-white items-center justify-center px-6">
				<Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
				<Text className="mt-3 text-gray-600 text-center">{error}</Text>
				<TouchableOpacity
					className="mt-4 bg-indigo-900 px-4 py-2 rounded-lg"
					onPress={() => refetch()}
				>
					<Text className="text-white font-semibold">Retry</Text>
				</TouchableOpacity>
			</View>
		);
	}

	if (!employee) {
		return (
			<View className="flex-1 bg-white items-center justify-center px-6">
				<Ionicons name="person-outline" size={48} color="#9CA3AF" />
				<Text className="mt-3 text-gray-900 font-semibold">Employee not found</Text>
				<TouchableOpacity className="mt-4" onPress={() => router.back()}>
					<Text className="text-indigo-700 font-semibold">Go Back</Text>
				</TouchableOpacity>
			</View>
		);
	}

	const defaultAvatar = require('../../assets/images/logo.png');
	const startDate = employee.startDate
		? new Date(employee.startDate).toLocaleDateString('en-GB', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
		})
		: '—';

	return (
		<ScrollView
			className="flex-1 bg-gray-50"
			showsVerticalScrollIndicator={false}
			refreshControl={
				<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1A1464']} />
			}
		>
			{/* Header */}
			<View className="bg-white px-5 pt-4 pb-6 border-b border-gray-100">
				{/* Back + Title */}
				<View className="flex-row items-center mb-4">
					<TouchableOpacity onPress={() => router.back()} className="mr-3">
						<Ionicons name="arrow-back" size={24} color="#111827" />
					</TouchableOpacity>
					<Text className="text-lg font-bold text-gray-900">View Profile</Text>
				</View>

				{/* Profile Card */}
				<View className="flex-row items-center">
					<View className="relative">
						<Image
							source={employee.doctor.avatar ? { uri: employee.doctor.avatar } : defaultAvatar}
							className="w-16 h-16 rounded-full border-2 border-gray-200"
						/>
						{employee.status === 'active' && (
							<View className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
						)}
					</View>
					<View className="ml-4 flex-1">
						<Text className="text-xl font-bold text-gray-900">{employee.doctor.fullName}</Text>
						<Text className="text-gray-500">{employee.doctor.specialization || 'Specialist'}</Text>
						<View className="flex-row items-center mt-1">
							<View
								className={`px-2 py-0.5 rounded-full ${employee.status === 'active' ? 'bg-green-100' : 'bg-gray-100'}`}
							>
								<Text
									className={`text-xs font-semibold ${employee.status === 'active' ? 'text-green-700' : 'text-gray-600'}`}
								>
									{employee.status === 'active' ? 'Active' : employee.status}
								</Text>
							</View>
						</View>
					</View>
				</View>

				{/* Current Status */}
				<View className="mt-4 bg-gray-50 rounded-xl p-4 flex-row justify-between items-center border border-gray-100">
					<View>
						<Text className="text-gray-500 text-xs font-medium">Current Status</Text>
						<View className="flex-row items-center mt-1">
							<View
								className={`w-2 h-2 rounded-full ${attendanceStatus.isOnDuty ? 'bg-green-500' : 'bg-gray-400'} mr-2`}
							/>
							<Text
								className={`font-bold ${attendanceStatus.isOnDuty ? 'text-green-600' : 'text-gray-600'}`}
							>
								{attendanceStatus.isOnDuty ? 'On Duty' : 'Off Duty'}
							</Text>
						</View>
					</View>
					<View className="items-end">
						<Text className="text-gray-500 text-xs font-medium">SHIFT ENDS</Text>
						<Text className="text-gray-900 font-bold text-lg mt-1">{attendanceStatus.shiftEnd}</Text>
					</View>
				</View>
			</View>

			{/* Action Buttons */}
			<View className="px-5 py-4">
				<View className="flex-row" style={{ gap: 10 }}>
					<TouchableOpacity onPress={handleMarkAttendance} className="flex-1 bg-indigo-900 rounded-xl py-4 items-center">
						<MaterialCommunityIcons name="fingerprint" size={24} color="white" />
						<Text className="text-white text-xs font-semibold mt-1">Mark Attendance</Text>
					</TouchableOpacity>

					<TouchableOpacity onPress={handleManageLeave} className="flex-1 bg-white rounded-xl py-4 items-center border border-gray-200">
						<Feather name="calendar" size={22} color="#4B5563" />
						<Text className="text-gray-700 text-xs font-semibold mt-1">Manage Leave</Text>
					</TouchableOpacity>

					<TouchableOpacity onPress={handleMessage} className="flex-1 bg-white rounded-xl py-4 items-center border border-gray-200">
						<Ionicons name="chatbubble-outline" size={22} color="#4B5563" />
						<Text className="text-gray-700 text-xs font-semibold mt-1">Message</Text>
					</TouchableOpacity>
				</View>
			</View>

			{/* Employment Details */}
			<View className="px-5">
				<View className="flex-row items-center justify-between mb-3">
					<Text className="text-base font-bold text-gray-900">Employment Details</Text>
					<TouchableOpacity onPress={() => setIsEditModalVisible(true)}>
						<Text className="text-indigo-600 font-semibold text-sm">Edit</Text>
					</TouchableOpacity>
				</View>

				<View className="bg-white rounded-xl border border-gray-200">
					{/* Job Type / Joined */}
					<View className="flex-row p-4 border-b border-gray-100">
						<View className="flex-row items-center flex-1">
							<View className="w-10 h-10 rounded-lg bg-blue-50 items-center justify-center">
								<Ionicons name="briefcase-outline" size={20} color="#3B82F6" />
							</View>
							<View className="ml-3">
								<Text className="text-gray-500 text-xs">Job Type</Text>
								<Text className="text-gray-900 font-semibold">{employee.jobType || '—'}</Text>
							</View>
						</View>
						<View className="items-end justify-center">
							<Text className="text-gray-500 text-xs">Joined</Text>
							<Text className="text-gray-900 font-semibold">{startDate}</Text>
						</View>
					</View>

					{/* Work Schedule / Timings */}
					<TouchableOpacity onPress={handleSchedule} className="flex-row p-4 border-b border-gray-100">
						<View className="flex-row items-center flex-1">
							<View className="w-10 h-10 rounded-lg bg-purple-50 items-center justify-center">
								<Ionicons name="time-outline" size={20} color="#8B5CF6" />
							</View>
							<View className="ml-3">
								<Text className="text-gray-500 text-xs">Work Schedule</Text>
								<Text className="text-gray-900 font-semibold">{employee.shift || 'Regular Shift'}</Text>
							</View>
						</View>
						<View className="items-end justify-center">
							<Text className="text-gray-500 text-xs">Department</Text>
							<Text className="text-gray-900 font-semibold">{employee.department || '—'}</Text>
						</View>
					</TouchableOpacity>

					{/* Salary */}
					<View className="flex-row p-4">
						<View className="flex-row items-center flex-1">
							<View className="w-10 h-10 rounded-lg bg-green-50 items-center justify-center">
								<MaterialCommunityIcons name="currency-inr" size={20} color="#22C55E" />
							</View>
							<View className="ml-3">
								<Text className="text-gray-500 text-xs">Salary</Text>
								<Text className="text-gray-900 font-semibold">
									{employee.salary !== undefined && employee.salary !== null
										? `₹${employee.salary.toLocaleString('en-IN')}${employee.salaryType ? ` / ${employee.salaryType}` : ''}`
										: '—'}
								</Text>
							</View>
						</View>
					</View>
				</View>
			</View>

			{/* Quick Actions */}
			<View className="px-5 mt-4">
				<View className="bg-white rounded-xl border border-gray-200">
					<TouchableOpacity
						onPress={handleMarkCompleted}
						disabled={actionLoading}
						className="flex-row items-center justify-between p-4 border-b border-gray-100"
					>
						<Text className="text-green-600 font-semibold">Mark As Completed</Text>
						<Ionicons name="checkmark-done" size={20} color="#22C55E" />
					</TouchableOpacity>

					<TouchableOpacity
						onPress={handleEndEmployment}
						disabled={actionLoading}
						className="flex-row items-center justify-between p-4"
					>
						<Text className="text-red-500 font-semibold">End Employment</Text>
						<Ionicons name="close" size={20} color="#EF4444" />
					</TouchableOpacity>
				</View>
			</View>

			{/* Contact Details */}
			<View className="px-5 mt-4 mb-8">
				<Text className="text-base font-bold text-gray-900 mb-3">Contact Details</Text>
				<View className="bg-white rounded-xl border border-gray-200 p-4" style={{ gap: 12 }}>
					<View className="flex-row items-center">
						<Ionicons name="mail-outline" size={18} color="#6B7280" />
						<Text className="ml-3 text-gray-700">{employee.doctor.email || '—'}</Text>
					</View>
					<View className="flex-row items-center">
						<Ionicons name="call-outline" size={18} color="#6B7280" />
						<Text className="ml-3 text-gray-700">{formatPhone(employee.doctor.phone)}</Text>
					</View>
				</View>
			</View>
			{/* Edit Employment Modal */}
			{isEditModalVisible && (
				<View className="absolute inset-0 z-50 bg-black/50 justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
					<View className="bg-white rounded-3xl p-6 shadow-xl">
						<View className="flex-row justify-between items-center mb-6">
							<Text className="text-xl font-bold">Edit Employment</Text>
							<TouchableOpacity onPress={() => setIsEditModalVisible(false)} className="bg-gray-100 p-2 rounded-full">
								<Ionicons name="close" size={20} />
							</TouchableOpacity>
						</View>

						<View style={{ gap: 12 }}>
							<View>
								<Text className="text-xs text-gray-500 mb-1 ml-1">Job Title</Text>
								<TextInput
									value={editForm.jobTitle}
									onChangeText={(t) => setEditForm((prev) => ({ ...prev, jobTitle: t }))}
									className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200"
									placeholder="Job Title"
								/>
							</View>

							<View>
								<Text className="text-xs text-gray-500 mb-1 ml-1">Department</Text>
								<TextInput
									value={editForm.department}
									onChangeText={(t) => setEditForm((prev) => ({ ...prev, department: t }))}
									className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200"
									placeholder="Department"
								/>
							</View>

							<View>
								<Text className="text-xs text-gray-500 mb-1 ml-1">Shift (e.g. 09:00 - 17:00)</Text>
								<TextInput
									value={editForm.shift}
									onChangeText={(t) => setEditForm((prev) => ({ ...prev, shift: t }))}
									className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200"
									placeholder="09:00 - 17:00"
								/>
							</View>

							<View>
								<Text className="text-xs text-gray-500 mb-1 ml-1">Salary</Text>
								<TextInput
									value={editForm.salary}
									onChangeText={(t) => setEditForm((prev) => ({ ...prev, salary: t }))}
									keyboardType="numeric"
									className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200"
									placeholder="e.g. 50000"
								/>
							</View>

							<View className="flex-row" style={{ gap: 10, marginTop: 6 }}>
								<TouchableOpacity
									activeOpacity={0.85}
									className="flex-1 bg-gray-100 rounded-xl py-3"
									onPress={() => setIsEditModalVisible(false)}
									disabled={actionLoading}
								>
									<Text className="text-gray-900 text-center font-semibold">Cancel</Text>
								</TouchableOpacity>
								<TouchableOpacity
									activeOpacity={0.85}
									className="flex-1 bg-indigo-900 rounded-xl py-3"
									onPress={handleSaveEmploymentEdits}
									disabled={actionLoading}
								>
									<Text className="text-white text-center font-semibold">Save</Text>
								</TouchableOpacity>
							</View>
						</View>
					</View>
				</View>
			)}

			<EmployerFeedbackForm
				isVisible={isFeedbackVisible}
				onClose={() => setIsFeedbackVisible(false)}
				onSubmitSuccess={feedbackType === 'completed' ? onFeedbackSuccess : onTerminationFeedbackSuccess}
				assignmentId={employee.assignmentId}
				doctorName={employee.doctor.fullName}
				doctorRole={employee.doctor.specialization || 'Specialist'}
				completionType={feedbackType}
			/>
		</ScrollView>
	);
}
