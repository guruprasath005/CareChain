import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
	View,
	Text,
	ScrollView,
	TouchableOpacity,
	Image,
	TextInput,
	RefreshControl,
	Alert,
	Modal,
	ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEmployees, useEmployeeSchedule } from '@/hooks';
import { Calendar } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function EmployeeScheduleScreen() {
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id?: string }>();
	const { employees, isLoading, refetch } = useEmployees();
	const [refreshing, setRefreshing] = useState(false);

	const employee = useMemo(() => {
		const key = String(id);
		return employees.find((e) => e.assignmentId === key || e.id === key);
	}, [employees, id]);

	const { schedule, isLoading: scheduleLoading, error: scheduleError, fetchSchedule, addEntries, updateEntry, deleteEntry } = useEmployeeSchedule(employee?.assignmentId || '');

	// Schedule modal state
	const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
	const [selectedDates, setSelectedDates] = useState<{ [key: string]: any }>({});
	const [startTime, setStartTime] = useState(new Date());
	const [endTime, setEndTime] = useState(new Date());
	const [isWorkDay, setIsWorkDay] = useState(true);
	const [showStartTimePicker, setShowStartTimePicker] = useState(false);
	const [showEndTimePicker, setShowEndTimePicker] = useState(false);

	// Edit modal state
	const [editModalVisible, setEditModalVisible] = useState(false);
	const [editingEntry, setEditingEntry] = useState<any>(null);
	const [editStartTime, setEditStartTime] = useState(new Date());
	const [editEndTime, setEditEndTime] = useState(new Date());
	const [editIsWorkDay, setEditIsWorkDay] = useState(true);
	const [showEditStartTimePicker, setShowEditStartTimePicker] = useState(false);
	const [showEditEndTimePicker, setShowEditEndTimePicker] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		if (employee?.assignmentId) {
			fetchSchedule();
		}
	}, [employee?.assignmentId, fetchSchedule]);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await Promise.all([refetch(), fetchSchedule()]);
		setRefreshing(false);
	}, [refetch, fetchSchedule]);

	// Create marked dates object for MAIN screen calendar
	const markedDates = useMemo(() => {
		const marked: { [key: string]: any } = {};
		schedule.forEach((entry) => {
			marked[entry.date] = {
				marked: true,
				dotColor: entry.isWorkDay ? '#4F46E5' : '#EF4444',
				selected: true,
				selectedColor: entry.isWorkDay ? '#4F46E5' : '#EF4444',
				selectedTextColor: '#ffffff',
			};
		});
		return marked;
	}, [schedule]);

	// Group consecutive dates with the same schedule type and time into ranges
	interface ScheduleGroup {
		id: string;
		startDate: string;
		endDate: string;
		isWorkDay: boolean;
		startTime: string;
		endTime: string;
		notes?: string;
		entryIds: string[];
	}

	const groupedSchedule = useMemo(() => {
		if (schedule.length === 0) return [];

		const sorted = [...schedule].sort((a, b) =>
			new Date(a.date).getTime() - new Date(b.date).getTime()
		);

		const groups: ScheduleGroup[] = [];
		let currentGroup: ScheduleGroup | null = null;

		sorted.forEach((entry) => {
			const entryDate = new Date(entry.date);

			if (!currentGroup) {
				// Start new group
				currentGroup = {
					id: entry.id,
					startDate: entry.date,
					endDate: entry.date,
					isWorkDay: entry.isWorkDay,
					startTime: entry.startTime,
					endTime: entry.endTime,
					notes: entry.notes,
					entryIds: [entry.id],
				};
			} else {
				// Check if this entry can be grouped with current group
				const currentEndDate = new Date(currentGroup.endDate);
				const dayDiff = Math.round((entryDate.getTime() - currentEndDate.getTime()) / (1000 * 60 * 60 * 24));

				const sameType = entry.isWorkDay === currentGroup.isWorkDay;
				const sameTime = entry.startTime === currentGroup.startTime &&
					entry.endTime === currentGroup.endTime;
				const consecutive = dayDiff === 1;

				if (sameType && sameTime && consecutive) {
					// Extend current group
					currentGroup.endDate = entry.date;
					currentGroup.entryIds.push(entry.id);
				} else {
					// Save current group and start new one
					groups.push(currentGroup);
					currentGroup = {
						id: entry.id,
						startDate: entry.date,
						endDate: entry.date,
						isWorkDay: entry.isWorkDay,
						startTime: entry.startTime,
						endTime: entry.endTime,
						notes: entry.notes,
						entryIds: [entry.id],
					};
				}
			}
		});

		// Don't forget the last group
		if (currentGroup) {
			groups.push(currentGroup);
		}

		return groups;
	}, [schedule]);

	// Create marked dates for MODAL calendar (merging existing schedule + new selections)
	const modalMarkedDates = useMemo(() => {
		const marked: { [key: string]: any } = {};

		// First add existing schedule as markers (editable)
		schedule.forEach((entry) => {
			marked[entry.date] = {
				marked: true,
				dotColor: entry.isWorkDay ? '#4F46E5' : '#EF4444',
			};
		});

		// Then add selected dates (overrides existing if needed)
		Object.keys(selectedDates).forEach(date => {
			const hasConflict = schedule.some(s => s.date === date);
			const selectedColor: string | undefined = selectedDates[date]?.selectedColor;
			const isUpdate = Boolean(selectedDates[date]?.isUpdate);
			const dotColor = hasConflict || isUpdate
				? '#F59E0B'
				: selectedColor === '#EF4444'
					? '#EF4444'
					: '#4F46E5';
			marked[date] = {
				...selectedDates[date],
				// Always show a dot for every selected date so multi-select is visible.
				marked: true,
				dotColor,
				selected: true,
				selectedTextColor: '#ffffff',
			};
		});

		return marked;
	}, [schedule, selectedDates]);

	// Get conflicting dates (selected dates that already have schedules)
	const conflictingDates = useMemo(() => {
		return Object.keys(selectedDates).filter(date =>
			schedule.some(s => s.date === date)
		);
	}, [selectedDates, schedule]);

	const parseTimeToDate = (timeStr: string) => {
		const base = new Date();
		base.setSeconds(0, 0);
		const [timePart, meridiemRaw] = timeStr.split(' ');
		const [h, m] = timePart.split(':').map(Number);
		let hours = Number.isNaN(h) ? 0 : h;
		const minutes = Number.isNaN(m) ? 0 : m;
		const meridiem = meridiemRaw?.toUpperCase();
		if (meridiem === 'PM' && hours < 12) hours += 12;
		if (meridiem === 'AM' && hours === 12) hours = 0;
		base.setHours(hours, minutes, 0, 0);
		return base;
	};

	const handleDayPress = (day: any) => {
		const dateStr = day.dateString;
		const existingEntry = schedule.find(s => s.date === dateStr);

		// Check if already selected first to allow toggling off even for conflicting dates
		if (selectedDates[dateStr]) {
			setSelectedDates(prev => {
				const newDates = { ...prev };
				delete newDates[dateStr];
				return newDates;
			});
			return;
		}

		// If not selected, check for conflict
		if (existingEntry) {
			Alert.alert(
				'Already Scheduled',
				`This date already has a ${existingEntry.isWorkDay ? 'work' : 'no-work'} schedule. Do you want to update it?`,
				[
					{ text: 'Cancel', style: 'cancel' },
					{
						text: 'Update',
						onPress: () => {
							setSelectedDates(prev => ({
								...prev,
								[dateStr]: {
									selected: true,
									selectedColor: '#F59E0B', // Amber to indicate update
									isUpdate: true,
								}
							}));
							// Pre-fill with existing entry data
							setIsWorkDay(existingEntry.isWorkDay);
							if (existingEntry.startTime) {
								setStartTime(parseTimeToDate(existingEntry.startTime));
							}
							if (existingEntry.endTime) {
								setEndTime(parseTimeToDate(existingEntry.endTime));
							}
						}
					}
				]
			);
			return;
		}

		// New date selection (no conflict)
		setSelectedDates(prev => ({
			...prev,
			[dateStr]: {
				selected: true,
				selectedColor: isWorkDay ? '#4F46E5' : '#EF4444',
				isUpdate: false,
			}
		}));
	};

	const handleAddSchedule = () => {
		const defaultStart = new Date();
		defaultStart.setHours(9, 0, 0, 0);
		const defaultEnd = new Date();
		defaultEnd.setHours(17, 0, 0, 0);
		setStartTime(defaultStart);
		setEndTime(defaultEnd);
		setIsWorkDay(true);
		setSelectedDates({}); // Reset current selection, but modalMarkedDates will still show existing
		setScheduleModalVisible(true);
	};

	const handleSaveSchedule = async () => {
		if (Object.keys(selectedDates).length === 0) {
			Alert.alert('Error', 'Please select at least one date');
			return;
		}

		setIsSaving(true);

		const formatTimeForDB = (date: Date) => {
			return date.toLocaleTimeString('en-US', {
				hour: '2-digit',
				minute: '2-digit',
				hour12: true
			});
		};

		// Combine both new and existing dates into one payload for bulk upsert
		// The backend's upsertScheduleEntries handles both creating new and updating existing by date
		const entries = Object.keys(selectedDates).map(date => ({
			date,
			startTime: formatTimeForDB(startTime),
			endTime: formatTimeForDB(endTime),
			isWorkDay,
		}));

		try {
			// Use addEntries which now points to the bulk endpoint
			const result = await addEntries(entries);

			if (result.success) {
				const count = entries.length;
				Alert.alert('Success', `Successfully saved schedule for ${count} day${count === 1 ? '' : 's'}`);
				setScheduleModalVisible(false);
				setSelectedDates({});
				fetchSchedule(); // Refresh
			} else {
				Alert.alert('Error', result.error || 'Failed to save schedule');
			}
		} catch (error) {
			Alert.alert('Error', 'Failed to save schedule');
		} finally {
			setIsSaving(false);
		}
	};

	// Handle opening edit modal for a schedule entry
	const handleEditEntry = (entry: any) => {
		setEditingEntry(entry);
		setEditIsWorkDay(entry.isWorkDay);
		if (entry.startTime) {
			setEditStartTime(parseTimeToDate(entry.startTime));
		}
		if (entry.endTime) {
			setEditEndTime(parseTimeToDate(entry.endTime));
		}
		setEditModalVisible(true);
	};

	// Handle updating a schedule entry
	const handleUpdateEntry = async () => {
		if (!editingEntry) return;

		setIsSaving(true);
		const formatTimeForDB = (date: Date) => {
			return date.toLocaleTimeString('en-US', {
				hour: '2-digit',
				minute: '2-digit',
				hour12: true
			});
		};

		const result = await updateEntry(editingEntry.id, {
			startTime: formatTimeForDB(editStartTime),
			endTime: formatTimeForDB(editEndTime),
			isWorkDay: editIsWorkDay,
		});

		setIsSaving(false);

		if (result.success) {
			Alert.alert('Success', 'Schedule updated successfully');
			setEditModalVisible(false);
			setEditingEntry(null);
			fetchSchedule();
		} else {
			Alert.alert('Error', result.error || 'Failed to update schedule');
		}
	};

	// Handle deleting a schedule entry
	const handleDeleteEntry = (entry: any) => {
		Alert.alert(
			'Delete Schedule',
			`Are you sure you want to delete the schedule for ${new Date(entry.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}?`,
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Delete',
					style: 'destructive',
					onPress: async () => {
						const result = await deleteEntry(entry.id);
						if (result.success) {
							Alert.alert('Deleted', 'Schedule entry removed');
							fetchSchedule();
						} else {
							Alert.alert('Error', result.error || 'Failed to delete schedule');
						}
					},
				},
			]
		);
	};

	const defaultAvatar = require('../../assets/images/logo.png');

	if (isLoading && !employee) {
		return (
			<View className="flex-1 bg-gray-50 items-center justify-center">
				<ActivityIndicator size="large" color="#1A1464" />
				<Text className="mt-3 text-gray-500">Loading...</Text>
			</View>
		);
	}

	if (!employee) {
		return (
			<View className="flex-1 bg-gray-50 items-center justify-center px-6">
				<Ionicons name="person-outline" size={48} color="#9CA3AF" />
				<Text className="mt-3 text-gray-900 font-semibold">Employee not found</Text>
				<TouchableOpacity className="mt-4" onPress={() => router.back()}>
					<Text className="text-indigo-700 font-semibold">Go Back</Text>
				</TouchableOpacity>
			</View>
		);
	}

	return (
		<View className="flex-1 bg-gray-50">
			{/* Header */}
			<View className="bg-white px-5 pt-4 pb-4 border-b border-gray-100">
				<View className="flex-row items-center mb-4">
					<TouchableOpacity onPress={() => router.back()} className="mr-3">
						<Ionicons name="arrow-back" size={24} color="#111827" />
					</TouchableOpacity>
					<Text className="text-lg font-bold text-gray-900">Employee Schedule</Text>
				</View>

				{/* Employee Info */}
				<View className="flex-row items-center">
					<Image
						source={employee.doctor.avatar ? { uri: employee.doctor.avatar } : defaultAvatar}
						className="w-12 h-12 rounded-full"
					/>
					<View className="ml-3 flex-1">
						<Text className="font-bold text-gray-900">{employee.doctor.fullName}</Text>
						<Text className="text-gray-500 text-sm">{employee.doctor.specialization || 'Specialist'}</Text>
					</View>
					<TouchableOpacity
						onPress={handleAddSchedule}
						className="px-4 py-2 rounded-lg bg-indigo-900"
					>
						<Text className="text-white font-semibold text-sm">Add Schedule</Text>
					</TouchableOpacity>
				</View>
			</View>

			<ScrollView
				className="flex-1"
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1A1464']} />
				}
			>
				{/* Calendar */}
				<View className="bg-white mx-5 mt-4 rounded-xl border border-gray-200 overflow-hidden">
					<Calendar
						markedDates={markedDates}
						theme={{
							todayTextColor: '#4F46E5',
							arrowColor: '#4F46E5',
						}}
					/>
				</View>

				{/* Schedule List */}
				<View className="px-5 mt-4">
					<Text className="text-base font-bold text-gray-900 mb-3">Scheduled Shifts</Text>

					{scheduleError && (
						<View className="bg-red-50 p-4 rounded-xl mb-4">
							<Text className="text-red-600 text-sm">{scheduleError}</Text>
							<TouchableOpacity onPress={() => fetchSchedule()} className="mt-2">
								<Text className="text-red-700 font-bold text-xs underline">Try Again</Text>
							</TouchableOpacity>
						</View>
					)}

					{scheduleLoading ? (
						<View className="py-10 items-center">
							<ActivityIndicator color="#1A1464" />
						</View>
					) : groupedSchedule.length === 0 ? (
						<View className="bg-white rounded-xl border border-gray-200 py-10 items-center">
							<Feather name="calendar" size={48} color="#9CA3AF" />
							<Text className="text-gray-500 mt-3">No schedule entries yet</Text>
							<TouchableOpacity
								onPress={handleAddSchedule}
								className="mt-4 px-4 py-2 rounded-lg bg-indigo-900"
							>
								<Text className="text-white font-semibold">Add Schedule</Text>
							</TouchableOpacity>
						</View>
					) : (
						groupedSchedule
							.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
							.map((group) => {
								const isRange = group.startDate !== group.endDate;
								const formatDateShort = (dateStr: string) => {
									return new Date(dateStr).toLocaleDateString('en-US', {
										month: 'short',
										day: 'numeric',
									});
								};
								const formatDateFull = (dateStr: string) => {
									return new Date(dateStr).toLocaleDateString('en-US', {
										weekday: 'long',
										month: 'short',
										day: 'numeric',
									});
								};

								return (
									<View
										key={group.id}
										className={`bg-white rounded-xl border mb-3 overflow-hidden ${group.isWorkDay ? 'border-indigo-100' : 'border-red-100'}`}
									>
										{/* Card Header with Status Badge */}
										<View className={`px-4 py-2 ${group.isWorkDay ? 'bg-indigo-50' : 'bg-red-50'}`}>
											<View className="flex-row items-center justify-between">
												<Text className="font-bold text-gray-900">
													{isRange
														? `${formatDateShort(group.startDate)} – ${formatDateShort(group.endDate)}`
														: formatDateFull(group.startDate)
													}
												</Text>
												<View
													className={`px-3 py-1 rounded-full ${group.isWorkDay ? 'bg-indigo-600' : 'bg-red-500'}`}
												>
													<Text className="text-xs font-bold text-white">
														{group.isWorkDay ? 'WORK' : 'NO WORK'}
													</Text>
												</View>
											</View>
											{isRange && (
												<Text className="text-xs text-gray-500 mt-1">
													{group.entryIds.length} days
												</Text>
											)}
										</View>

										{/* Card Body */}
										<View className="px-4 py-3">
											{group.isWorkDay && (
												<View className="flex-row items-center mb-2">
													<Ionicons name="time-outline" size={16} color="#6B7280" />
													<Text className="text-gray-700 text-sm ml-2 font-medium">
														{group.startTime} – {group.endTime}
													</Text>
												</View>
											)}
											{group.notes && (
												<View className="flex-row items-start">
													<Feather name="file-text" size={14} color="#9CA3AF" style={{ marginTop: 2 }} />
													<Text className="text-gray-500 text-xs ml-2 flex-1">{group.notes}</Text>
												</View>
											)}

											{/* Action Buttons */}
											<View className="flex-row justify-end mt-3 pt-3 border-t border-gray-100" style={{ gap: 8 }}>
												{!isRange ? (
													<>
														<TouchableOpacity
															onPress={() => handleEditEntry(schedule.find(s => s.id === group.id)!)}
															className="flex-row items-center px-3 py-2 rounded-lg bg-gray-100"
															activeOpacity={0.7}
														>
															<Feather name="edit-2" size={14} color="#4B5563" />
															<Text className="text-gray-700 text-sm font-medium ml-1.5">Edit</Text>
														</TouchableOpacity>
														<TouchableOpacity
															onPress={() => handleDeleteEntry(schedule.find(s => s.id === group.id)!)}
															className="flex-row items-center px-3 py-2 rounded-lg bg-red-50"
															activeOpacity={0.7}
														>
															<Feather name="trash-2" size={14} color="#DC2626" />
															<Text className="text-red-600 text-sm font-medium ml-1.5">Delete</Text>
														</TouchableOpacity>
													</>
												) : (
													<TouchableOpacity
														onPress={() => {
															Alert.alert(
																'Delete Range',
																`Delete all ${group.entryIds.length} schedule entries from ${formatDateShort(group.startDate)} to ${formatDateShort(group.endDate)}?`,
																[
																	{ text: 'Cancel', style: 'cancel' },
																	{
																		text: 'Delete All',
																		style: 'destructive',
																		onPress: async () => {
																			// Delete all entries in this group
																			for (const entryId of group.entryIds) {
																				await deleteEntry(entryId);
																			}
																			Alert.alert('Deleted', 'Schedule entries removed');
																			fetchSchedule();
																		},
																	},
																]
															);
														}}
														className="flex-row items-center px-3 py-2 rounded-lg bg-red-50"
														activeOpacity={0.7}
													>
														<Feather name="trash-2" size={14} color="#DC2626" />
														<Text className="text-red-600 text-sm font-medium ml-1.5">Delete Range</Text>
													</TouchableOpacity>
												)}
											</View>
										</View>
									</View>
								);
							})
					)}
				</View>

				<View className="h-6" />
			</ScrollView>

			{/* Schedule Modal */}
			{scheduleModalVisible && (
				<Modal
					transparent
					animationType="slide"
					visible={scheduleModalVisible}
					onRequestClose={() => setScheduleModalVisible(false)}
				>
					<View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
						<View style={{ backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '90%' }}>
							{/* Header */}
							<View className="flex-row items-center justify-between p-5 border-b border-gray-200">
								<View>
									<Text className="text-xl font-bold text-gray-900">Add Schedule</Text>
									<Text className="text-sm text-gray-500 mt-1">{employee.doctor.fullName}</Text>
								</View>
								<TouchableOpacity
									onPress={() => setScheduleModalVisible(false)}
									className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
								>
									<Ionicons name="close" size={24} color="#6B7280" />
								</TouchableOpacity>
							</View>

							<ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
								{/* Work Day Toggle */}
								<View className="px-5 py-4 border-b border-gray-100">
									<Text className="text-sm font-semibold text-gray-700 mb-3">Schedule Type</Text>
									<View className="flex-row" style={{ gap: 10 }}>
										<TouchableOpacity
											onPress={() => {
												setIsWorkDay(true);
												setSelectedDates((prev) => {
													const updated = { ...prev };
													Object.keys(updated).forEach((key) => {
														if (updated[key]?.isUpdate) return;
														updated[key] = {
															...updated[key],
															selected: true,
															selectedColor: '#4F46E5',
														};
													});
													return updated;
												});
											}}
											className={`flex-1 py-3 rounded-xl border-2 ${isWorkDay ? 'bg-indigo-50 border-indigo-600' : 'bg-white border-gray-200'
												}`}
										>
											<Text
												className={`text-center font-semibold ${isWorkDay ? 'text-indigo-900' : 'text-gray-600'
													}`}
											>
												Work Day
											</Text>
										</TouchableOpacity>
										<TouchableOpacity
											onPress={() => {
												setIsWorkDay(false);
												setSelectedDates((prev) => {
													const updated = { ...prev };
													Object.keys(updated).forEach((key) => {
														if (updated[key]?.isUpdate) return;
														updated[key] = {
															...updated[key],
															selected: true,
															selectedColor: '#EF4444',
														};
													});
													return updated;
												});
											}}
											className={`flex-1 py-3 rounded-xl border-2 ${!isWorkDay ? 'bg-red-50 border-red-600' : 'bg-white border-gray-200'
												}`}
										>
											<Text
												className={`text-center font-semibold ${!isWorkDay ? 'text-red-900' : 'text-gray-600'
													}`}
											>
												No Work
											</Text>
										</TouchableOpacity>
									</View>
								</View>

								{/* Calendar */}
								<View className="px-5 py-4">
									<Text className="text-sm font-semibold text-gray-700 mb-3">Select Dates</Text>
									<Calendar
										markedDates={modalMarkedDates}
										onDayPress={handleDayPress}
										theme={{
											todayTextColor: '#4F46E5',
											selectedDayBackgroundColor: isWorkDay ? '#4F46E5' : '#EF4444',
											selectedDayTextColor: '#ffffff',
											arrowColor: '#4F46E5',
										}}
										minDate={new Date().toISOString().split('T')[0]}
									/>
									{/* Calendar Legend */}
									<View className="flex-row flex-wrap mt-3 ml-1" style={{ gap: 12 }}>
										<View className="flex-row items-center">
											<View className="w-2 h-2 rounded-full bg-indigo-600 mr-1.5" />
											<Text className="text-xs text-gray-500">Work day</Text>
										</View>
										<View className="flex-row items-center">
											<View className="w-2 h-2 rounded-full bg-red-500 mr-1.5" />
											<Text className="text-xs text-gray-500">No work</Text>
										</View>
										<View className="flex-row items-center">
											<View className="w-2 h-2 rounded-full bg-amber-500 mr-1.5" />
											<Text className="text-xs text-gray-500">Will update</Text>
										</View>
									</View>
								</View>

								{/* Time Selection */}
								{isWorkDay && (
									<View className="px-5 py-4 border-t border-gray-100">
										<Text className="text-sm font-semibold text-gray-700 mb-3">Shift Time</Text>
										<View className="flex-row" style={{ gap: 12 }}>
											<View className="flex-1">
												<Text className="text-xs text-gray-500 mb-2">Start Time</Text>
												<TouchableOpacity
													onPress={() => setShowStartTimePicker(true)}
													className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3"
												>
													<Text className="text-gray-900 font-medium">
														{startTime.toLocaleTimeString('en-US', {
															hour: '2-digit',
															minute: '2-digit',
															hour12: true
														})}
													</Text>
												</TouchableOpacity>
											</View>
											<View className="flex-1">
												<Text className="text-xs text-gray-500 mb-2">End Time</Text>
												<TouchableOpacity
													onPress={() => setShowEndTimePicker(true)}
													className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3"
												>
													<Text className="text-gray-900 font-medium">
														{endTime.toLocaleTimeString('en-US', {
															hour: '2-digit',
															minute: '2-digit',
															hour12: true
														})}
													</Text>
												</TouchableOpacity>
											</View>
										</View>
									</View>
								)}

								{/* Selected Dates Summary */}
								{Object.keys(selectedDates).length > 0 && (
									<View className="px-5 py-4 bg-gray-50">
										<View className="flex-row items-center justify-between mb-2">
											<Text className="text-sm font-semibold text-gray-700">
												Selected: {Object.keys(selectedDates).length} {Object.keys(selectedDates).length === 1 ? 'day' : 'days'}
											</Text>
											{conflictingDates.length > 0 && (
												<View className="bg-amber-100 px-2 py-1 rounded-full flex-row items-center">
													<Ionicons name="warning-outline" size={12} color="#D97706" />
													<Text className="text-amber-700 text-xs font-medium ml-1">
														{conflictingDates.length} update{conflictingDates.length > 1 ? 's' : ''}
													</Text>
												</View>
											)}
										</View>
										<Text className="text-xs text-gray-500">
											{Object.keys(selectedDates).sort().slice(0, 3).join(', ')}
											{Object.keys(selectedDates).length > 3 && ` +${Object.keys(selectedDates).length - 3} more`}
										</Text>
										{conflictingDates.length > 0 && (
											<Text className="text-xs text-amber-600 mt-2">
												⚠️ Selected dates with existing schedules will be updated
											</Text>
										)}
									</View>
								)}
							</ScrollView>

							{/* Action Buttons */}
							<View className="p-5 border-t border-gray-200 flex-row" style={{ gap: 12 }}>
								<TouchableOpacity
									onPress={() => setScheduleModalVisible(false)}
									className="flex-1 py-3 rounded-xl border border-gray-300"
									disabled={isSaving}
								>
									<Text className="text-center font-semibold text-gray-700">Cancel</Text>
								</TouchableOpacity>
								<TouchableOpacity
									onPress={handleSaveSchedule}
									className="flex-1 py-3 rounded-xl bg-indigo-900 flex-row items-center justify-center"
									disabled={Object.keys(selectedDates).length === 0 || isSaving}
									style={{
										opacity: Object.keys(selectedDates).length === 0 || isSaving ? 0.5 : 1,
									}}
								>
									{isSaving ? (
										<>
											<ActivityIndicator color="#fff" size="small" />
											<Text className="text-center font-semibold text-white ml-2">Saving...</Text>
										</>
									) : (
										<Text className="text-center font-semibold text-white">
											{conflictingDates.length > 0 ? 'Save & Update' : 'Save Schedule'}
										</Text>
									)}
								</TouchableOpacity>
							</View>
						</View>
					</View>

					{/* Time Pickers */}
					{showStartTimePicker && (
						<DateTimePicker
							value={startTime}
							mode="time"
							is24Hour={false} // Force 12h picker
							display="default"
							onChange={(_event, selectedDate) => {
								setShowStartTimePicker(false);
								if (selectedDate) setStartTime(selectedDate);
							}}
						/>
					)}
					{showEndTimePicker && (
						<DateTimePicker
							value={endTime}
							mode="time"
							is24Hour={false} // Force 12h picker
							display="default"
							onChange={(_event, selectedDate) => {
								setShowEndTimePicker(false);
								if (selectedDate) setEndTime(selectedDate);
							}}
						/>
					)}
				</Modal>
			)}

			{/* Edit Schedule Modal */}
			{editModalVisible && editingEntry && (
				<Modal
					transparent
					animationType="slide"
					visible={editModalVisible}
					onRequestClose={() => setEditModalVisible(false)}
				>
					<View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 }}>
						<View className="bg-white rounded-2xl overflow-hidden">
							{/* Header */}
							<View className="bg-indigo-900 px-5 py-4">
								<Text className="text-white text-lg font-bold">Edit Schedule</Text>
								<Text className="text-indigo-200 text-sm mt-1">
									{new Date(editingEntry.date).toLocaleDateString('en-US', {
										weekday: 'long',
										month: 'long',
										day: 'numeric',
										year: 'numeric'
									})}
								</Text>
							</View>

							{/* Content */}
							<View className="p-5">
								{/* Work Day Toggle */}
								<Text className="text-sm font-semibold text-gray-700 mb-3">Schedule Type</Text>
								<View className="flex-row mb-5" style={{ gap: 10 }}>
									<TouchableOpacity
										onPress={() => setEditIsWorkDay(true)}
										className={`flex-1 py-3 rounded-xl border-2 ${editIsWorkDay ? 'bg-indigo-50 border-indigo-600' : 'bg-white border-gray-200'}`}
									>
										<Text className={`text-center font-semibold ${editIsWorkDay ? 'text-indigo-900' : 'text-gray-600'}`}>
											Work Day
										</Text>
									</TouchableOpacity>
									<TouchableOpacity
										onPress={() => setEditIsWorkDay(false)}
										className={`flex-1 py-3 rounded-xl border-2 ${!editIsWorkDay ? 'bg-red-50 border-red-600' : 'bg-white border-gray-200'}`}
									>
										<Text className={`text-center font-semibold ${!editIsWorkDay ? 'text-red-900' : 'text-gray-600'}`}>
											No Work
										</Text>
									</TouchableOpacity>
								</View>

								{/* Time Selection */}
								{editIsWorkDay && (
									<View className="mb-5">
										<Text className="text-sm font-semibold text-gray-700 mb-3">Shift Time</Text>
										<View className="flex-row" style={{ gap: 12 }}>
											<View className="flex-1">
												<Text className="text-xs text-gray-500 mb-2">Start Time</Text>
												<TouchableOpacity
													onPress={() => setShowEditStartTimePicker(true)}
													className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3"
												>
													<Text className="text-gray-900 font-medium">
														{editStartTime.toLocaleTimeString('en-US', {
															hour: '2-digit',
															minute: '2-digit',
															hour12: true
														})}
													</Text>
												</TouchableOpacity>
											</View>
											<View className="flex-1">
												<Text className="text-xs text-gray-500 mb-2">End Time</Text>
												<TouchableOpacity
													onPress={() => setShowEditEndTimePicker(true)}
													className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3"
												>
													<Text className="text-gray-900 font-medium">
														{editEndTime.toLocaleTimeString('en-US', {
															hour: '2-digit',
															minute: '2-digit',
															hour12: true
														})}
													</Text>
												</TouchableOpacity>
											</View>
										</View>
									</View>
								)}

								{/* Action Buttons */}
								<View className="flex-row mt-2" style={{ gap: 12 }}>
									<TouchableOpacity
										onPress={() => {
											setEditModalVisible(false);
											setEditingEntry(null);
										}}
										className="flex-1 py-3 rounded-xl border border-gray-300"
									>
										<Text className="text-center font-semibold text-gray-700">Cancel</Text>
									</TouchableOpacity>
									<TouchableOpacity
										onPress={handleUpdateEntry}
										className="flex-1 py-3 rounded-xl bg-indigo-900"
										disabled={isSaving}
										style={{ opacity: isSaving ? 0.5 : 1 }}
									>
										<Text className="text-center font-semibold text-white">
											{isSaving ? 'Saving...' : 'Save Changes'}
										</Text>
									</TouchableOpacity>
								</View>
							</View>
						</View>
					</View>

					{/* Edit Time Pickers */}
					{showEditStartTimePicker && (
						<DateTimePicker
							value={editStartTime}
							mode="time"
							is24Hour={false}
							display="default"
							onChange={(_event, selectedDate) => {
								setShowEditStartTimePicker(false);
								if (selectedDate) setEditStartTime(selectedDate);
							}}
						/>
					)}
					{showEditEndTimePicker && (
						<DateTimePicker
							value={editEndTime}
							mode="time"
							is24Hour={false}
							display="default"
							onChange={(_event, selectedDate) => {
								setShowEditEndTimePicker(false);
								if (selectedDate) setEditEndTime(selectedDate);
							}}
						/>
					)}
				</Modal>
			)}
		</View>
	);
}
