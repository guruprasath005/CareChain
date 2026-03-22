import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, TextInput } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEmployees, useEmployeeSchedule } from '@/hooks';
import { attendanceApi } from '@/services/api';

interface AttendanceLog {
	id: string;
	checkIn: string;
	checkOut?: string;
	duration?: string;
	status: 'present' | 'absent' | 'late' | 'half-day';
	date: string;
	notes?: string;
}

export default function EmployeeDetailsScreen() {
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id?: string }>();
	const { employees, isLoading, error, refetch } = useEmployees();

	const employee = useMemo(() => {
		const key = String(id);
		return employees.find((e) => e.assignmentId === key || e.id === key);
	}, [employees, id]);

	const [attendanceHistory, setAttendanceHistory] = useState<AttendanceLog[]>([]);
	const [attendanceLoading, setAttendanceLoading] = useState(false);

	// Fetch schedule data
	const { schedule, isLoading: scheduleLoading, fetchSchedule } = useEmployeeSchedule(employee?.assignmentId || '');

	React.useEffect(() => {
		if (employee?.assignmentId) {
			fetchSchedule();
		}
	}, [employee?.assignmentId, fetchSchedule]);

	const fetchAttendance = React.useCallback(async () => {
		if (!employee?.assignmentId) return;
		setAttendanceLoading(true);
		try {
			const response = await attendanceApi.getHistory(employee.assignmentId);
			if (response.success && response.data) {
				const logs = Array.isArray(response.data) ? response.data :
					Array.isArray((response.data as any).history) ? (response.data as any).history : [];

				setAttendanceHistory(logs.map((log: any) => ({
					id: log._id || log.id,
					checkIn: log.checkInTime ? new Date(log.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
					checkOut: log.checkOutTime ? new Date(log.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
					duration: log.duration ? `${Math.floor(log.duration / 60)}h ${log.duration % 60}m` : undefined,
					status: log.status || 'present',
					date: log.date ? new Date(log.date).toLocaleDateString() : 'Unknown Date',
					notes: log.notes
				})));
			}
		} catch (error) {
			console.error('Failed to fetch attendance:', error);
		} finally {
			setAttendanceLoading(false);
		}
	}, [employee?.assignmentId]);

	React.useEffect(() => {
		if (employee) {
			fetchAttendance();
		}
	}, [employee, fetchAttendance]);

	const [isEditModalVisible, setIsEditModalVisible] = useState(false);
	const [editForm, setEditForm] = useState({
		jobTitle: '',
		department: '',
		shift: '',
		salary: '',
	});
	const { updateEmployee } = useEmployees();
	const [isUpdating, setIsUpdating] = useState(false);

	// Pre-fill form when employee data is loaded or modal opens
	React.useEffect(() => {
		if (employee) {
			setEditForm({
				jobTitle: employee.job.title,
				department: employee.department || '',
				shift: employee.shift || '',
				salary: employee.salary ? String(employee.salary) : '',
			});
		}
	}, [employee]);

	const handleUpdate = async () => {
		if (!employee?.assignmentId) return;
		setIsUpdating(true);
		try {
			const result = await updateEmployee(employee.assignmentId, {
				jobTitle: editForm.jobTitle,
				department: editForm.department,
				shift: editForm.shift, // Backend upgrade handles string or object, passing string for now if backend supports flexible parsing or update backend to handle string
				salary: Number(editForm.salary),
			});

			if (result.success) {
				setIsEditModalVisible(false);
				// ideally wait or Refetch happens automatically via context/hook if set up right, 
				// but useEmployees might need manual trigger if not sharing SWR cache
				await refetch();
			} else {
				alert(result.error);
			}
		} catch (e) {
			console.error(e);
		} finally {
			setIsUpdating(false);
		}
	};


	if (isLoading) {
		return (
			<View className="flex-1 bg-white items-center justify-center px-6">
				<ActivityIndicator size="large" color="#000" />
				<Text className="mt-3 text-gray-500">Loading profile...</Text>
			</View>
		);
	}

	if (error || !employee) {
		return (
			<View className="flex-1 bg-white items-center justify-center px-6">
				<Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
				<Text className="mt-3 text-gray-600 text-center">{error || 'Employee not found'}</Text>
				<TouchableOpacity
					className="mt-4 bg-black px-6 py-2 rounded-full"
					onPress={() => refetch()}
				>
					<Text className="text-white font-medium">Retry</Text>
				</TouchableOpacity>
				<TouchableOpacity className="mt-3" onPress={() => router.back()}>
					<Text className="text-gray-900 font-medium">Go Back</Text>
				</TouchableOpacity>
			</View>
		);
	}

	const defaultAvatar = require('../../assets/images/logo.png');

	return (
		<View className="flex-1 bg-white">
			{/* Header */}
			<View className="flex-row items-center justify-between px-5 pt-12 pb-4 border-b border-gray-100">
				<TouchableOpacity onPress={() => router.back()} className="h-10 w-10 items-center justify-center -ml-2">
					<Ionicons name="arrow-back" size={24} color="black" />
				</TouchableOpacity>
				<Text className="text-lg font-bold text-black">Employee Profile</Text>
				<TouchableOpacity
					onPress={() => setIsEditModalVisible(true)}
					className="h-10 w-10 items-center justify-center"
				>
					<Ionicons name="create-outline" size={24} color="black" />
				</TouchableOpacity>
			</View>

			<ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
				{/* Profile Info */}
				<View className="items-center mb-6">
					<Image
						source={employee.doctor.avatar ? { uri: employee.doctor.avatar } : defaultAvatar}
						className="w-24 h-24 rounded-full bg-gray-100 mb-3"
						defaultSource={defaultAvatar}
					/>
					<Text className="text-xl font-bold text-black text-center">{employee.doctor.fullName}</Text>
					<Text className="text-gray-500 text-center">{employee.doctor.specialization || 'Doctor'}</Text>

					<View className="flex-row items-center mt-2 bg-gray-50 px-3 py-1 rounded-full">
						<Text className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{employee.status}</Text>
					</View>
				</View>

				{/* Info Grid */}
				<View className="flex-row flex-wrap justify-between bg-gray-50 rounded-2xl p-4 mb-6">
					<View className="w-[48%] mb-4">
						<Text className="text-xs text-gray-400 mb-1">Job Title</Text>
						<Text className="text-sm font-semibold text-gray-900">{employee.job.title}</Text>
					</View>
					<View className="w-[48%] mb-4">
						<Text className="text-xs text-gray-400 mb-1">In Department</Text>
						<Text className="text-sm font-semibold text-gray-900">{employee.department || 'General'}</Text>
					</View>
					<View className="w-[48%]">
						<Text className="text-xs text-gray-400 mb-1">Shift</Text>
						<Text className="text-sm font-semibold text-gray-900">{employee.shift || 'Regular'}</Text>
					</View>
					<View className="w-[48%]">
						<Text className="text-xs text-gray-400 mb-1">Salary</Text>
						<Text className="text-sm font-semibold text-gray-900">₹{employee.salary}</Text>
					</View>
				</View>

				{/* Contact Actions */}
				<View className="flex-row gap-3 mb-8">
					<TouchableOpacity className="flex-1 bg-black py-4 rounded-xl flex-row items-center justify-center gap-2">
						<Ionicons name="call" size={20} color="white" />
						<Text className="text-white font-semibold">Call</Text>
					</TouchableOpacity>
					<TouchableOpacity className="flex-1 bg-gray-100 py-4 rounded-xl flex-row items-center justify-center gap-2">
						<Ionicons name="mail" size={20} color="black" />
						<Text className="text-black font-semibold">Email</Text>
					</TouchableOpacity>
				</View>

				{/* Schedule Section */}
				<View className="mb-8">
					<View className="flex-row items-center justify-between mb-4">
						<Text className="text-lg font-bold text-black">Work Schedule</Text>
						<TouchableOpacity 
							onPress={() => router.push({
								pathname: '/(hospital)/(tabs)/employeeSchedule',
								params: { id: employee.assignmentId }
							})}
							className="flex-row items-center"
						>
							<Text className="text-sm font-semibold text-blue-600 mr-1">Manage Schedule</Text>
							<Ionicons name="chevron-forward" size={16} color="#2563EB" />
						</TouchableOpacity>
					</View>

					{scheduleLoading ? (
						<View className="py-6 items-center">
							<ActivityIndicator color="black" />
						</View>
					) : schedule.length === 0 ? (
						<View className="bg-gray-50 p-6 rounded-2xl items-center">
							<Feather name="calendar" size={32} color="#9CA3AF" />
							<Text className="text-gray-400 mt-2">No schedule entries yet</Text>
							<TouchableOpacity 
								onPress={() => router.push({
									pathname: '/(hospital)/(tabs)/employeeSchedule',
									params: { id: employee.assignmentId }
								})}
								className="mt-3 px-4 py-2 bg-black rounded-lg"
							>
								<Text className="text-white font-semibold text-sm">Add Schedule</Text>
							</TouchableOpacity>
						</View>
					) : (
						<View style={{ gap: 10 }}>
							{/* Show upcoming schedules (next 5) */}
							{schedule
								.filter(entry => new Date(entry.date) >= new Date(new Date().toDateString()))
								.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
								.slice(0, 5)
								.map(entry => (
									<View 
										key={entry.id} 
										className={`bg-white border p-4 rounded-2xl shadow-sm ${entry.isWorkDay ? 'border-indigo-100' : 'border-red-100'}`}
									>
										<View className="flex-row items-center justify-between">
											<View className="flex-row items-center flex-1">
												<View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${entry.isWorkDay ? 'bg-indigo-100' : 'bg-red-100'}`}>
													<Text className={`text-sm font-bold ${entry.isWorkDay ? 'text-indigo-700' : 'text-red-700'}`}>
														{new Date(entry.date).getDate()}
													</Text>
												</View>
												<View>
													<Text className="font-semibold text-gray-900">
														{new Date(entry.date).toLocaleDateString('en-US', { 
															weekday: 'long', 
															month: 'short', 
															day: 'numeric' 
														})}
													</Text>
													{entry.isWorkDay && (
														<Text className="text-xs text-gray-500 mt-0.5">
															{entry.startTime} – {entry.endTime}
														</Text>
													)}
												</View>
											</View>
											<View className={`px-2.5 py-1 rounded-full ${entry.isWorkDay ? 'bg-indigo-600' : 'bg-red-500'}`}>
												<Text className="text-xs font-bold text-white">
													{entry.isWorkDay ? 'WORK' : 'OFF'}
												</Text>
											</View>
										</View>
									</View>
								))}
							
							{schedule.filter(entry => new Date(entry.date) >= new Date(new Date().toDateString())).length > 5 && (
								<TouchableOpacity 
									onPress={() => router.push({
										pathname: '/(hospital)/(tabs)/employeeSchedule',
										params: { id: employee.assignmentId }
									})}
									className="py-3 items-center"
								>
									<Text className="text-blue-600 font-semibold text-sm">
										View All ({schedule.filter(entry => new Date(entry.date) >= new Date(new Date().toDateString())).length} entries)
									</Text>
								</TouchableOpacity>
							)}
						</View>
					)}
				</View>

				{/* Attendance Section */}
				<View className="mb-8">
					<View className="flex-row items-center justify-between mb-4">
						<Text className="text-lg font-bold text-black">Attendance History</Text>
						<TouchableOpacity onPress={fetchAttendance}>
							<Text className="text-sm font-semibold text-blue-600">Refresh</Text>
						</TouchableOpacity>
					</View>

					{attendanceLoading ? (
						<ActivityIndicator color="black" />
					) : attendanceHistory.length === 0 ? (
						<View className="bg-gray-50 p-6 rounded-2xl items-center">
							<Text className="text-gray-400">No records found</Text>
						</View>
					) : (
						<View style={{ gap: 10 }}>
							{attendanceHistory.map(log => (
								<View key={log.id} className="bg-white border border-gray-100 p-4 rounded-2xl flex-row justify-between items-center shadow-sm">
									<View>
										<Text className="font-semibold text-gray-900">{log.date}</Text>
										<Text className="text-xs text-gray-500 mt-1">{log.checkIn} - {log.checkOut || 'Active'}</Text>
									</View>
									<View className={`px-3 py-1 rounded-full ${log.status === 'present' ? 'bg-green-100' : 'bg-red-100'}`}>
										<Text className={`text-xs font-bold ${log.status === 'present' ? 'text-green-700' : 'text-red-700'}`}>
											{log.status.toUpperCase()}
										</Text>
									</View>
								</View>
							))}
						</View>
					)}
				</View>
			</ScrollView>

			{/* Edit Modal */}
			{isEditModalVisible && (
				<View className="absolute inset-0 z-50 bg-black/50 justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
					<View className="bg-white rounded-3xl p-6 shadow-xl">
						<View className="flex-row justify-between items-center mb-6">
							<Text className="text-xl font-bold">Edit Details</Text>
							<TouchableOpacity onPress={() => setIsEditModalVisible(false)} className="bg-gray-100 p-2 rounded-full">
								<Ionicons name="close" size={20} />
							</TouchableOpacity>
						</View>

						<View className="gap-4">
							<View>
								<Text className="text-xs text-gray-500 mb-1 ml-1">Job Title</Text>
								<TextInput
									value={editForm.jobTitle}
									onChangeText={t => setEditForm(prev => ({ ...prev, jobTitle: t }))}
									className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200"
									placeholder="Job Title"
								/>
							</View>
							<View>
								<Text className="text-xs text-gray-500 mb-1 ml-1">Department</Text>
								<TextInput
									value={editForm.department}
									onChangeText={t => setEditForm(prev => ({ ...prev, department: t }))}
									className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200"
									placeholder="Department"
								/>
							</View>
							<View>
								<Text className="text-xs text-gray-500 mb-1 ml-1">Shift</Text>
								<TextInput
									value={editForm.shift}
									onChangeText={t => setEditForm(prev => ({ ...prev, shift: t }))}
									className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200"
									placeholder="e.g. 09:00 - 17:00"
								/>
							</View>
							<View>
								<Text className="text-xs text-gray-500 mb-1 ml-1">Salary</Text>
								<TextInput
									value={editForm.salary}
									onChangeText={t => setEditForm(prev => ({ ...prev, salary: t.replace(/[^0-9]/g, '') }))}
									className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200"
									placeholder="Amount"
									keyboardType="numeric"
								/>
							</View>

							<TouchableOpacity
								onPress={handleUpdate}
								disabled={isUpdating}
								className={`mt-4 py-4 rounded-xl flex-row justify-center items-center ${isUpdating ? 'bg-gray-200' : 'bg-black'}`}
							>
								{isUpdating ? <ActivityIndicator color="gray" /> : <Text className="text-white font-bold text-center">Save Changes</Text>}
							</TouchableOpacity>
						</View>
					</View>
				</View>
			)}
		</View>
	);
}
