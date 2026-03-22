import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEmployees, useMarkAttendance } from '@/hooks';
import { hospitalApi, attendanceApi } from '@/services/api';
import { Colors } from '@/constants/Colors';
import { setSocketEventHandlers, AttendanceNotification, joinAttendanceRoom } from '@/services/socket';

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
	| 'cancelled'
	| 'on_leave';

type TodayStatusState = {
	status: AttendanceStatus;
	loading: boolean;
	checkInTime?: string;
	checkOutTime?: string;
	attendanceId?: string;
};

interface AttendanceEmployee {
	id: string;
	assignmentId: string;
	name: string;
	specialization: string;
	avatar?: string;
	shift: string;
	status: AttendanceStatus;
	checkInTime?: string;
	checkOutTime?: string;
	attendanceId?: string;
	leaveReason?: string;
}

// Pending request interface
interface PendingRequest {
	id: string;
	assignmentId: string;
	doctorId: string;
	doctorName: string;
	doctorAvatar?: string;
	date: string;
	status: AttendanceStatus;
	checkIn?: { time: string };
	checkOut?: { time: string };
	workDuration?: { hours: number; minutes: number };
	shift?: string;
}

export default function MarkEmployeeAttendanceScreen() {
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id?: string }>();
	const focusAssignmentId = id ? String(id) : '';
	const { employees, isLoading, refetch } = useEmployees();
	const { markAttendance } = useMarkAttendance();
	const [searchQuery, setSearchQuery] = useState('');
	const [refreshing, setRefreshing] = useState(false);
	const [todayStatuses, setTodayStatuses] = useState<Record<string, TodayStatusState>>({});
	const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
	const [processingId, setProcessingId] = useState<string | null>(null);

	// Join attendance room for real-time notifications
	useEffect(() => {
		joinAttendanceRoom();
	}, []);

	// Handle real-time attendance notifications
	useEffect(() => {
		const handleCheckInRequest = (data: AttendanceNotification) => {
			// Add to pending requests
			setPendingRequests(prev => {
				const exists = prev.some(r => r.id === data.attendanceId);
				if (exists) return prev;
				return [{
					id: data.attendanceId,
					assignmentId: data.assignmentId,
					doctorId: data.doctorId || '',
					doctorName: data.doctorName || 'Doctor',
					date: data.date,
					status: 'checkin_pending' as AttendanceStatus,
					checkIn: data.checkInTime ? { time: data.checkInTime } : undefined,
				}, ...prev];
			});

			// Update status
			setTodayStatuses(prev => ({
				...prev,
				[data.assignmentId]: {
					status: 'checkin_pending',
					loading: false,
					checkInTime: data.checkInTime,
					attendanceId: data.attendanceId,
				},
			}));

		};

		const handleCheckOutRequest = (data: AttendanceNotification) => {
			// Update pending request
			setPendingRequests(prev =>
				prev.map(r =>
					r.id === data.attendanceId
						? { ...r, status: 'checkout_pending' as AttendanceStatus, checkOut: data.checkOutTime ? { time: data.checkOutTime } : undefined }
						: r
				)
			);

			// Update status
			setTodayStatuses(prev => ({
				...prev,
				[data.assignmentId]: {
					...prev[data.assignmentId],
					status: 'checkout_pending',
					loading: false,
					checkOutTime: data.checkOutTime,
				},
			}));


		};

		setSocketEventHandlers({
			onAttendanceCheckInRequest: handleCheckInRequest,
			onAttendanceCheckOutRequest: handleCheckOutRequest,
		});
	}, []);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await refetch();
		await loadPendingRequests();
		setRefreshing(false);
	}, [refetch]);

	// Load pending requests
	const loadPendingRequests = useCallback(async () => {
		try {
			const response = await attendanceApi.getPendingRequests();
			if (response.success && response.data) {
				setPendingRequests(response.data as PendingRequest[]);
			}
		} catch (error) {
			console.error('Failed to load pending requests:', error);
		}
	}, []);

	const loadTodayStatuses = useCallback(async (assignmentIds: string[]) => {
		if (assignmentIds.length === 0) return;

		setTodayStatuses((prev) => {
			const next = { ...prev };
			for (const assignmentId of assignmentIds) {
				next[assignmentId] = {
					status: prev[assignmentId]?.status || 'not_marked',
					loading: true,
					checkInTime: prev[assignmentId]?.checkInTime,
					checkOutTime: prev[assignmentId]?.checkOutTime,
					attendanceId: prev[assignmentId]?.attendanceId,
				};
			}
			return next;
		});

		try {
			const response = await hospitalApi.getEmployeesTodayStatusBulk(assignmentIds);
			if (response.success && response.data && Array.isArray(response.data)) {
				setTodayStatuses((prev) => {
					const next = { ...prev };
					response.data.forEach((item: any) => {
						const status = (item.status || 'not_marked') as AttendanceStatus;
						next[item.assignmentId] = {
							status,
							loading: false,
							checkInTime: item.attendance?.checkIn?.time || item.attendance?.checkInTime,
							checkOutTime: item.attendance?.checkOut?.time || item.attendance?.checkOutTime,
							attendanceId: item.attendance?.id,
						};
					});
					return next;
				});
			} else {
				setTodayStatuses((prev) => {
					const next = { ...prev };
					assignmentIds.forEach((assignmentId) => {
						next[assignmentId] = { status: 'not_marked', loading: false };
					});
					return next;
				});
			}
		} catch {
			setTodayStatuses((prev) => {
				const next = { ...prev };
				assignmentIds.forEach((assignmentId) => {
					next[assignmentId] = { status: 'not_marked', loading: false };
				});
				return next;
			});
		}
	}, []);

	// Transform employees to attendance list
	const attendanceList: AttendanceEmployee[] = useMemo(() => {
		return employees.map((emp) => ({
			id: emp.id,
			assignmentId: emp.assignmentId,
			name: emp.doctor?.fullName || 'Doctor',
			specialization: emp.doctor?.specialization || 'Specialist',
			avatar: emp.doctor?.avatar,
			shift: emp.shift || '09:00 AM - 05:00 PM',
			status: todayStatuses[emp.assignmentId]?.status || 'not_marked',
			checkInTime: todayStatuses[emp.assignmentId]?.checkInTime,
			checkOutTime: todayStatuses[emp.assignmentId]?.checkOutTime,
			attendanceId: todayStatuses[emp.assignmentId]?.attendanceId,
		}));
	}, [employees, todayStatuses]);

	useEffect(() => {
		if (!employees || employees.length === 0) return;
		const ids = employees
			.map((e) => e.assignmentId)
			.filter((x): x is string => Boolean(x));
		const target = focusAssignmentId ? ids.filter((x) => x === focusAssignmentId) : ids;
		void loadTodayStatuses(target);
		void loadPendingRequests();
	}, [employees, focusAssignmentId, loadTodayStatuses, loadPendingRequests]);

	// Filter based on search
	const filteredList = useMemo(() => {
		let list = attendanceList;
		if (focusAssignmentId) {
			list = list.filter((emp) => emp.assignmentId === focusAssignmentId);
		}
		if (!searchQuery.trim()) return list;
		const q = searchQuery.toLowerCase();
		return list.filter(
			(emp) => emp.name.toLowerCase().includes(q) || emp.specialization.toLowerCase().includes(q)
		);
	}, [attendanceList, searchQuery, focusAssignmentId]);

	// Filter pending requests if viewing single employee
	const filteredPendingRequests = useMemo(() => {
		if (focusAssignmentId) {
			return pendingRequests.filter(r => r.assignmentId === focusAssignmentId);
		}
		return pendingRequests;
	}, [pendingRequests, focusAssignmentId]);

	// Approval handlers
	const handleConfirmCheckIn = async (attendanceId: string, assignmentId: string) => {
		setProcessingId(attendanceId);
		try {
			const result = await attendanceApi.confirmCheckIn(attendanceId);
			if (result.success) {
				// Update local state
				setTodayStatuses(prev => ({
					...prev,
					[assignmentId]: {
						...prev[assignmentId],
						status: 'checkin_confirmed',
						loading: false,
					},
				}));
				// Remove from pending
				setPendingRequests(prev => prev.filter(r => r.id !== attendanceId));
				Alert.alert('Success', 'Check-in confirmed');
			} else {
				Alert.alert('Error', result.error || 'Failed to confirm check-in');
			}
		} catch (error: any) {
			Alert.alert('Error', error.message || 'Failed to confirm check-in');
		} finally {
			setProcessingId(null);
		}
	};

	const handleConfirmCheckOut = async (attendanceId: string, assignmentId: string) => {
		setProcessingId(attendanceId);
		try {
			const result = await attendanceApi.confirmCheckOut(attendanceId);
			if (result.success) {
				setTodayStatuses(prev => ({
					...prev,
					[assignmentId]: {
						...prev[assignmentId],
						status: 'checkout_confirmed',
						loading: false,
					},
				}));
				setPendingRequests(prev => prev.filter(r => r.id !== attendanceId));
				Alert.alert('Success', 'Check-out confirmed');
			} else {
				Alert.alert('Error', result.error || 'Failed to confirm check-out');
			}
		} catch (error: any) {
			Alert.alert('Error', error.message || 'Failed to confirm check-out');
		} finally {
			setProcessingId(null);
		}
	};

	const handleCancelAttendance = async (attendanceId: string, assignmentId: string) => {
		Alert.alert(
			'Cancel Attendance',
			'Are you sure you want to cancel this attendance request?',
			[
				{ text: 'No', style: 'cancel' },
				{
					text: 'Yes, Cancel',
					style: 'destructive',
					onPress: async () => {
						setProcessingId(attendanceId);
						try {
							const result = await attendanceApi.cancelAttendance(attendanceId);
							if (result.success) {
								setTodayStatuses(prev => ({
									...prev,
									[assignmentId]: {
										...prev[assignmentId],
										status: 'cancelled',
										loading: false,
									},
								}));
								setPendingRequests(prev => prev.filter(r => r.id !== attendanceId));
								Alert.alert('Success', 'Attendance cancelled');
							}
						} catch (error: any) {
							Alert.alert('Error', error.message || 'Failed to cancel');
						} finally {
							setProcessingId(null);
						}
					},
				},
			]
		);
	};

	const handleMarkAbsent = async (attendanceId: string | undefined, assignmentId: string) => {
		Alert.alert(
			'Mark Absent',
			'Are you sure you want to mark this employee as absent?',
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Mark Absent',
					style: 'destructive',
					onPress: async () => {
						setProcessingId(attendanceId || assignmentId);
						try {
							let result;
							if (attendanceId) {
								result = await attendanceApi.markAbsent(attendanceId);
							} else {
								result = await attendanceApi.createAbsentRecord(assignmentId);
							}
							if (result.success) {
								setTodayStatuses(prev => ({
									...prev,
									[assignmentId]: {
										...prev[assignmentId],
										status: 'absent',
										loading: false,
									},
								}));
								setPendingRequests(prev => prev.filter(r => r.assignmentId !== assignmentId));
								Alert.alert('Success', 'Marked as absent');
							}
						} catch (error: any) {
							Alert.alert('Error', error.message || 'Failed to mark absent');
						} finally {
							setProcessingId(null);
						}
					},
				},
			]
		);
	};

	const defaultAvatar = require('../../assets/images/logo.png');

	const getStatusBadge = (status: AttendanceStatus) => {
		switch (status) {
			case 'checkin_pending':
				return { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Check-in Pending' };
			case 'checkout_pending':
				return { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Check-out Pending' };
			case 'checkin_confirmed':
			case 'checked_in':
			case 'present':
				return { bg: 'bg-green-100', text: 'text-green-800', label: 'Present' };
			case 'checkout_confirmed':
			case 'checked_out':
				return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Checked Out' };
			case 'half_day':
				return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Half Day' };
			case 'absent':
				return { bg: 'bg-red-100', text: 'text-red-800', label: 'Absent' };
			case 'on_leave':
				return { bg: 'bg-purple-100', text: 'text-purple-800', label: 'On Leave' };
			case 'cancelled':
				return { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Cancelled' };
			default:
				return { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Not Marked' };
		}
	};

	// Check if status is pending
	const isPending = (status: AttendanceStatus) =>
		status === 'checkin_pending' || status === 'checkout_pending';

	return (
		<View className="flex-1 bg-gray-50">
			{/* Header */}
			<View className="bg-white px-5 pt-4 pb-4 border-b border-gray-100">
				<View className="flex-row items-center mb-4">
					<TouchableOpacity onPress={() => router.back()} className="mr-3">
						<Ionicons name="arrow-back" size={24} color="#111827" />
					</TouchableOpacity>
					<Text className="text-lg font-bold text-gray-900">
						{focusAssignmentId && filteredList.length > 0
							? `Mark Attendance: ${filteredList[0].name}`
							: 'Mark Attendance'}
					</Text>
				</View>

				{/* Search - Hide if single employee view */}
				{!focusAssignmentId && (
					<View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3">
						<Ionicons name="search" size={20} color="#9CA3AF" />
						<TextInput
							placeholder="Search Employees by Name"
							placeholderTextColor="#9CA3AF"
							value={searchQuery}
							onChangeText={setSearchQuery}
							className="flex-1 ml-2 text-gray-900"
						/>
					</View>
				)}
			</View>

			<ScrollView
				className="flex-1 px-5 pt-4"
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						colors={[Colors.brand.primary]}
					/>
				}
			>
				{/* Pending Requests Section */}
				{filteredPendingRequests.length > 0 && (
					<View className="mb-6">
						<Text className="text-xl font-bold text-gray-900 mb-3">
							🔔 Pending Approvals ({filteredPendingRequests.length})
						</Text>
						{filteredPendingRequests.map((request) => {
							const badge = getStatusBadge(request.status);
							const isProcessing = processingId === request.id;

							return (
								<View
									key={request.id}
									className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 mb-3"
								>
									<View className="flex-row items-center mb-3">
										<Image
											source={request.doctorAvatar ? { uri: request.doctorAvatar } : defaultAvatar}
											className="w-12 h-12 rounded-full"
										/>
										<View className="flex-1 ml-3">
											<Text className="font-bold text-gray-900">{request.doctorName}</Text>
											<Text className="text-gray-500 text-sm">
												{request.status === 'checkin_pending' ? 'Requested Check-in' : 'Requested Check-out'}
											</Text>
										</View>
										<View className={`px-3 py-1 rounded-full ${badge.bg}`}>
											<Text className={`text-xs font-semibold ${badge.text}`}>{badge.label}</Text>
										</View>
									</View>

									{/* Times */}
									<View className="flex-row mb-3">
										{request.checkIn && (
											<View className="flex-row items-center mr-4">
												<Ionicons name="log-in-outline" size={16} color="#059669" />
												<Text className="ml-1 text-gray-600 text-sm">
													{new Date(request.checkIn.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
												</Text>
											</View>
										)}
										{request.checkOut && (
											<View className="flex-row items-center">
												<Ionicons name="log-out-outline" size={16} color="#dc2626" />
												<Text className="ml-1 text-gray-600 text-sm">
													{new Date(request.checkOut.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
												</Text>
											</View>
										)}
									</View>

									{/* Action Buttons */}
									<View className="flex-row" style={{ gap: 8 }}>
										<TouchableOpacity
											onPress={() => request.status === 'checkin_pending'
												? handleConfirmCheckIn(request.id, request.assignmentId)
												: handleConfirmCheckOut(request.id, request.assignmentId)
											}
											disabled={isProcessing}
											className="flex-1 py-3 rounded-lg bg-green-600 items-center"
										>
											{isProcessing ? (
												<ActivityIndicator color="white" size="small" />
											) : (
												<Text className="text-white font-semibold">✓ Confirm</Text>
											)}
										</TouchableOpacity>
										<TouchableOpacity
											onPress={() => handleCancelAttendance(request.id, request.assignmentId)}
											disabled={isProcessing}
											className="flex-1 py-3 rounded-lg bg-gray-200 items-center"
										>
											<Text className="text-gray-700 font-semibold">✕ Cancel</Text>
										</TouchableOpacity>
										<TouchableOpacity
											onPress={() => handleMarkAbsent(request.id, request.assignmentId)}
											disabled={isProcessing}
											className="flex-1 py-3 rounded-lg bg-red-100 items-center"
										>
											<Text className="text-red-600 font-semibold">Absent</Text>
										</TouchableOpacity>
									</View>
								</View>
							);
						})}
					</View>
				)}

				{/* All Employees Section */}
				{!focusAssignmentId && <Text className="text-xl font-bold text-gray-900 mb-4">All Employees</Text>}

				{filteredList.length === 0 ? (
					<View className="items-center py-10">
						<Ionicons name="people-outline" size={48} color="#9CA3AF" />
						<Text className="text-gray-500 mt-3">No employees found</Text>
					</View>
				) : (
					filteredList.map((emp) => {
						const badge = getStatusBadge(emp.status);
						const isEmployeePending = isPending(emp.status);
						const isProcessing = processingId === (emp.attendanceId || emp.assignmentId);

						// Determine background color based on status
						const cardBg = emp.status === 'checkin_confirmed' || emp.status === 'checkout_confirmed' || emp.status === 'checked_in' || emp.status === 'present'
							? 'bg-green-50 border-green-200'
							: isEmployeePending
								? 'bg-orange-50 border-orange-200'
								: emp.status === 'cancelled' || emp.status === 'absent'
									? 'bg-red-50 border-red-200'
									: 'bg-white border-gray-200';

						return (
							<View
								key={emp.assignmentId}
								className={`rounded-xl border p-4 mb-3 ${cardBg}`}
							>
								{/* Top Row: Avatar, Name, Status */}
								<View className="flex-row items-center">
									<Image
										source={emp.avatar ? { uri: emp.avatar } : defaultAvatar}
										className="w-12 h-12 rounded-full"
									/>
									<View className="flex-1 ml-3">
										<Text className="font-bold text-gray-900">{emp.name}</Text>
										<Text className="text-gray-500 text-sm">{emp.specialization}</Text>
									</View>
									<View className={`px-3 py-1 rounded-full ${badge.bg}`}>
										<Text className={`text-xs font-semibold ${badge.text}`}>{badge.label}</Text>
									</View>
								</View>

								{/* Shift time */}
								<View className="flex-row items-center mt-3">
									<Ionicons name="time-outline" size={16} color="#6B7280" />
									<Text className="ml-2 text-gray-600 text-sm">{emp.shift}</Text>
								</View>

								{/* Times if checked in */}
								{(emp.checkInTime || emp.checkOutTime) && (
									<View className="flex-row mt-2">
										{emp.checkInTime && (
											<View className="flex-row items-center mr-4">
												<Ionicons name="log-in-outline" size={14} color="#059669" />
												<Text className="ml-1 text-gray-600 text-xs">
													In: {new Date(emp.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
												</Text>
											</View>
										)}
										{emp.checkOutTime && (
											<View className="flex-row items-center">
												<Ionicons name="log-out-outline" size={14} color="#dc2626" />
												<Text className="ml-1 text-gray-600 text-xs">
													Out: {new Date(emp.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
												</Text>
											</View>
										)}
									</View>
								)}

								{/* Actions for pending status */}
								{isEmployeePending && emp.attendanceId && (
									<View className="flex-row mt-4" style={{ gap: 8 }}>
										<TouchableOpacity
											onPress={() => emp.status === 'checkin_pending'
												? handleConfirmCheckIn(emp.attendanceId!, emp.assignmentId)
												: handleConfirmCheckOut(emp.attendanceId!, emp.assignmentId)
											}
											disabled={isProcessing}
											className="flex-1 py-2 rounded-lg bg-green-600 items-center"
										>
											{isProcessing ? (
												<ActivityIndicator color="white" size="small" />
											) : (
												<Text className="text-white font-semibold">Confirm</Text>
											)}
										</TouchableOpacity>
										<TouchableOpacity
											onPress={() => handleCancelAttendance(emp.attendanceId!, emp.assignmentId)}
											disabled={isProcessing}
											className="flex-1 py-2 rounded-lg border border-gray-300 items-center"
										>
											<Text className="text-gray-700 font-semibold">Cancel</Text>
										</TouchableOpacity>
										<TouchableOpacity
											onPress={() => handleMarkAbsent(emp.attendanceId, emp.assignmentId)}
											disabled={isProcessing}
											className="flex-1 py-2 rounded-lg bg-red-100 items-center"
										>
											<Text className="text-red-600 font-semibold">Absent</Text>
										</TouchableOpacity>
									</View>
								)}

								{/* Actions for confirmed check-in (allow check-out) */}
								{(emp.status === 'checkin_confirmed' || emp.status === 'checked_in' || emp.status === 'present') && !emp.checkOutTime && (
									<View className="flex-row mt-4 items-center justify-between">
										<Text className="text-green-600 text-sm">✓ Check-in confirmed</Text>
										<Text className="text-gray-500 text-sm">Waiting for check-out</Text>
									</View>
								)}

								{/* Completed status */}
								{(emp.status === 'checkout_confirmed' || emp.status === 'checked_out') && (
									<View className="mt-4 items-center">
										<Text className="text-green-600 font-medium">✓ Shift Completed</Text>
									</View>
								)}

								{/* Not marked - show mark absent option */}
								{emp.status === 'not_marked' && (
									<View className="flex-row justify-end mt-4">
										<TouchableOpacity
											onPress={() => handleMarkAbsent(undefined, emp.assignmentId)}
											disabled={isProcessing}
											className="px-4 py-2 rounded-lg bg-red-100"
										>
											<Text className="text-red-600 font-semibold">Mark Absent</Text>
										</TouchableOpacity>
									</View>
								)}
							</View>
						);
					})
				)}

				<View className="h-6" />
			</ScrollView>
		</View>
	);
}
