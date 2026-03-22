import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEmployees, useHospitalLeaveRequests, useEmployeeSchedule } from '@/hooks';
import { useFilteredEmployees } from '@/hooks/useFilteredEmployees';
import { hospitalApi } from '@/services/api';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar } from 'react-native-calendars';
import { EmptyState } from '../../_components/EmptyState';
import { SkeletonLoader } from '../../_components/SkeletonLoader';

type TabKey = 'Employees' | 'Schedule' | 'Leave';

type Employee = {
  id: string;
  assignmentId: string;
  name: string;
  role: string;
  avatar: string | null;
  status: 'Active' | 'Completed' | 'Terminated';
  jobTitle: string;
  dateRange: string;
  salaryLabel: string;
  shift?: string;
  jobType?: string;
  department?: string;
};

type LeaveRequest = {
  id: string;
  doctorName: string;
  doctorAvatar: string | null;
  doctorRole: string;
  jobTitle: string;
  startDate: string;
  endDate: string;
  dateRange: string;
  totalDays: number;
  type: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
};

function Tab({
  label,
  active,
  onPress,
}: {
  label: TabKey;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} className="px-6 py-2">
      <Text
        className={`${active ? 'text-brand-primary font-bold' : 'text-gray-500 font-semibold'
          } text-base`}
      >
        {label}
      </Text>
      <View className={`mt-2 h-1 rounded-full ${active ? 'bg-brand-primary' : 'bg-transparent'}`} />
    </TouchableOpacity>
  );
}

function EmployeeCard({
  employee,
  attendanceStatus,
}: {
  employee: Employee;
  attendanceStatus?: { status: string; loading: boolean };
}) {
  const router = useRouter();
  const defaultAvatar = require('../../assets/images/logo.png');

  const statusColor =
    employee.status === 'Active'
      ? 'bg-green-100 text-green-700'
      : employee.status === 'Completed'
        ? 'bg-gray-100 text-gray-700'
        : 'bg-red-100 text-red-700';

  // Attendance badge colors
  const attendanceBadge = () => {
    const status = attendanceStatus?.status || 'not_marked';
    switch (status) {
      case 'checked_in':
      case 'present':
        return { bg: 'bg-green-100', text: 'text-green-700', label: 'PRESENT' };
      case 'checked_out':
        return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'CHECKED OUT' };
      case 'absent':
        return { bg: 'bg-red-100', text: 'text-red-700', label: 'ABSENT' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-700', label: 'NOT MARKED' };
    }
  };
  const badge = attendanceBadge();

  return (
    <View className="bg-white rounded-2xl p-4 mb-3 shadow-sm border border-gray-100">
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-row items-center flex-1">
          <Image
            source={employee.avatar ? { uri: employee.avatar } : defaultAvatar}
            className="w-12 h-12 rounded-full"
            defaultSource={defaultAvatar}
          />
          <View className="ml-3 flex-1">
            <Text className="text-base font-semibold text-gray-900">{employee.name}</Text>
            <Text className="text-sm text-gray-500">{employee.role}</Text>
          </View>
        </View>
        <View className={`px-3 py-1 rounded-full ${badge.bg}`}>
          <Text className={`text-xs font-semibold ${badge.text}`}>
            {badge.label}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center mb-2">
        <Ionicons name="briefcase-outline" size={14} color="#9ca3af" />
        <Text className="text-xs text-gray-500 ml-1.5">{employee.jobTitle}</Text>
        <Text className="text-xs text-gray-400 ml-2">| {employee.shift || 'Regular Shift'}</Text>
      </View>

      <View className="flex-row gap-2 mt-3">
        <TouchableOpacity
          onPress={() =>
            router.push({ pathname: '/(hospital)/(tabs)/markEmployeeAttendance', params: { id: employee.assignmentId } })
          }
          className="flex-1 border border-brand-primary/20 bg-brand-primary/5 rounded-xl py-3"
          activeOpacity={0.8}
        >
          <Text className="text-brand-primary text-center font-semibold text-sm">
            Mark Attendance
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            router.push({ pathname: '/(hospital)/(tabs)/employeeViewProfile', params: { id: employee.assignmentId } })
          }
          className="flex-1 bg-brand-primary rounded-xl py-3"
          activeOpacity={0.8}
        >
          <Text className="text-white text-center font-semibold text-sm">View Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ScheduleCard({
  employee,
  onAssignTime,
}: {
  employee: Employee;
  onAssignTime: (employee: Employee) => void;
}) {
  const defaultAvatar = require('../../assets/images/logo.png');

  return (
    <View className="bg-white rounded-2xl p-4 mb-3 shadow-sm border border-gray-100">
      {/* Header with Avatar, Name, and On Duty Badge */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <Image
            source={employee.avatar ? { uri: employee.avatar } : defaultAvatar}
            className="w-12 h-12 rounded-full"
            defaultSource={defaultAvatar}
          />
          <View className="ml-3 flex-1">
            <Text className="text-base font-semibold text-gray-900">{employee.name}</Text>
            <Text className="text-sm text-gray-500">{employee.role}</Text>
          </View>
        </View>
        <View className="px-3 py-1 rounded-full bg-green-100">
          <Text className="text-xs font-semibold text-green-700">On Duty</Text>
        </View>
      </View>

      {/* Shift Time Info */}
      <View className="flex-row items-center mt-3 bg-gray-50 rounded-lg px-3 py-2">
        <Ionicons name="time-outline" size={16} color="#6B7280" />
        <Text className="ml-2 text-gray-700 text-sm">Shift: {employee.shift || '09:00 AM - 05:00 PM'}</Text>
      </View>

      {/* Actions - Assign Time only */}
      <View className="flex-row justify-end items-center mt-4">
        <TouchableOpacity
          onPress={() => onAssignTime(employee)}
          className="px-5 py-2.5 rounded-lg bg-brand-primary"
          activeOpacity={0.85}
        >
          <Text className="text-white font-semibold text-sm">Manage Schedule</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function LeaveRequestCard({
  request,
  onAction,
}: {
  request: LeaveRequest;
  onAction: (id: string, action: 'approve' | 'reject') => Promise<void> | void;
}) {
  const defaultAvatar = require('../../assets/images/logo.png');

  // Format dates for display
  const startLabel = new Date(request.startDate).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
  const endLabel = new Date(request.endDate).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });

  return (
    <View className="bg-white rounded-2xl p-4 mb-3 shadow-sm border border-gray-100">
      {/* Header with Avatar, Name, and Pending Badge */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <Image
            source={request.doctorAvatar ? { uri: request.doctorAvatar } : defaultAvatar}
            className="w-12 h-12 rounded-full"
            defaultSource={defaultAvatar}
          />
          <View className="ml-3 flex-1">
            <Text className="text-base font-semibold text-gray-900">{request.doctorName}</Text>
            <Text className="text-sm text-gray-500">{request.doctorRole}</Text>
          </View>
        </View>
        <View className="px-3 py-1 rounded-full bg-orange-100">
          <Text className="text-xs font-semibold text-orange-700">Pending</Text>
        </View>
      </View>

      {/* Date Range with Calendar Icon */}
      <View className="flex-row items-center mt-3">
        <Feather name="calendar" size={16} color="#6B7280" />
        <Text className="ml-2 text-gray-700 text-sm">
          {startLabel} – {endLabel}
        </Text>
        <View className="ml-2 px-2 py-0.5 bg-gray-100 rounded">
          <Text className="text-gray-500 text-xs">{request.totalDays} Days</Text>
        </View>
      </View>

      {/* Reason with File Icon */}
      <View className="flex-row items-start mt-2">
        <Feather name="file-text" size={16} color="#6B7280" style={{ marginTop: 2 }} />
        <Text className="ml-2 text-gray-600 text-sm flex-1" numberOfLines={2}>
          {request.reason}
        </Text>
      </View>

      {/* Action Buttons */}
      <View className="flex-row justify-end mt-4" style={{ gap: 10 }}>
        <TouchableOpacity
          onPress={() => onAction(request.id, 'reject')}
          className="px-5 py-2.5 rounded-lg border border-gray-300"
          activeOpacity={0.85}
        >
          <Text className="text-gray-700 font-semibold text-sm">Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onAction(request.id, 'approve')}
          className="px-5 py-2.5 rounded-lg bg-brand-primary"
          activeOpacity={0.85}
        >
          <Text className="text-white font-semibold text-sm">Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function HospitalEmployees() {
  const [activeTab, setActiveTab] = useState<TabKey>('Employees');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Track attendance statuses for each employee
  const [attendanceStatuses, setAttendanceStatuses] = useState<Record<string, {
    status: 'not_marked' | 'checked_in' | 'checked_out' | 'absent' | 'present';
    loading: boolean;
  }>>({});

  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [hasFetchedAttendance, setHasFetchedAttendance] = useState(false);

  // Schedule modal state
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [selectedEmployeeForSchedule, setSelectedEmployeeForSchedule] = useState<Employee | null>(null);
  const [selectedDates, setSelectedDates] = useState<{ [key: string]: any }>({});
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [isWorkDay, setIsWorkDay] = useState(true);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // We need brand primary for calendar
  const BRAND_PRIMARY = '#130160';
  const BRAND_SECONDARY = '#1E3A8A';

  // Use schedule hook with selected employee's ID
  const { schedule, addEntries, fetchSchedule } = useEmployeeSchedule(selectedEmployeeForSchedule?.assignmentId || '');

  useEffect(() => {
    if (selectedEmployeeForSchedule?.assignmentId) {
      fetchSchedule();
    }
  }, [selectedEmployeeForSchedule?.assignmentId, fetchSchedule]);

  // Pre-fill selectedDates when schedule loads
  useEffect(() => {
    if (schedule && schedule.length > 0 && selectedEmployeeForSchedule) {
      const dates: { [key: string]: any } = {};
      schedule.forEach(entry => {
        dates[entry.date] = {
          selected: true,
          selectedColor: entry.isWorkDay ? '#375BD2' : '#EF4444',
        };
      });
      setSelectedDates(dates);

      // Also try to set time from first entry if available?
      // Might be confusing if multiple entries have different times.
      // For now, default to 9-5 is fine, or maybe take the most recent?
    } else if (scheduleModalVisible && (!schedule || schedule.length === 0)) {
      // Only clear if we are opening modal and have no schedule
      // But be careful not to clear if we are just selecting dates
      // Best to clear only when switching employee
    }
  }, [schedule, selectedEmployeeForSchedule]);

  // Schedule handlers
  const handleAssignTime = (employee: Employee) => {
    setSelectedEmployeeForSchedule(employee);
    // don't clear selectedDates here immediately, let the useEffect handle it when schedule updates
    // But schedule update might be async. 
    // If we switch from Emp A to Emp B. 
    // 1. setSelectedEmployee(EmpB)
    // 2. Hook re-runs with EmpB ID. `schedule` will temporarily be EmpA's or empty?
    // Hook usually clears data or sets loading when ID changes.
    // Let's clear it here safely.
    setSelectedDates({});

    const defaultStart = new Date();
    defaultStart.setHours(9, 0, 0, 0);
    const defaultEnd = new Date();
    defaultEnd.setHours(17, 0, 0, 0);
    setStartTime(defaultStart);
    setEndTime(defaultEnd);
    setIsWorkDay(true);
    setScheduleModalVisible(true);
  };

  const handleDayPress = (day: any) => {
    const dateStr = day.dateString;
    const newSelectedDates = { ...selectedDates };

    if (newSelectedDates[dateStr]) {
      // Deselect if already selected
      delete newSelectedDates[dateStr];
    } else {
      // Select the date
      newSelectedDates[dateStr] = {
        selected: true,
        selectedColor: isWorkDay ? '#375BD2' : '#EF4444',
      };
    }

    setSelectedDates(newSelectedDates);
  };

  const handleSaveSchedule = async () => {
    if (!selectedEmployeeForSchedule || Object.keys(selectedDates).length === 0) {
      Alert.alert('Error', 'Please select at least one date');
      return;
    }

    const formatTime = (date: Date) => {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    };

    const entries = Object.keys(selectedDates).map(date => ({
      date,
      startTime: formatTime(startTime),
      endTime: formatTime(endTime),
      isWorkDay,
    }));

    try {
      const result = await addEntries(entries);

      if (result.success) {
        Alert.alert('Success', 'Schedule saved successfully');
        setScheduleModalVisible(false);
        setSelectedDates({});
      } else {
        Alert.alert('Error', result.error || 'Failed to save schedule');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred');
    }
  };

  const { employees: rawEmployees, loading, error, refetch } = useEmployees();

  // Use the useFilteredEmployees hook for client-side filtering on raw employees
  const { filteredEmployees: filteredRawEmployees, isEmpty } = useFilteredEmployees({
    employees: rawEmployees,
    searchQuery,
    activeTab,
  });

  // Transform filtered API employees to component format - memoized to prevent recreation on every render
  const employees: Employee[] = useMemo(() => filteredRawEmployees.map((emp: any) => {
    const start = emp.startDate ? new Date(emp.startDate) : null;
    const end = emp.endDate ? new Date(emp.endDate) : null;
    const startLabel = start && !Number.isNaN(start.getTime()) ? start.toLocaleDateString() : null;
    const endLabel = end && !Number.isNaN(end.getTime()) ? end.toLocaleDateString() : null;

    const dateRange = startLabel && endLabel ? `${startLabel} - ${endLabel}` : startLabel || endLabel || 'Dates not set';

    const statusLabel: Employee['status'] =
      emp.status === 'active' ? 'Active' : emp.status === 'completed' ? 'Completed' : 'Terminated';

    return {
      id: emp.doctor?.id || emp.doctorId || emp.id,
      assignmentId: emp.assignmentId || emp.id,
      name: emp.doctor?.fullName || 'Doctor',
      role: emp.doctor?.specialization || 'Doctor',
      avatar: emp.doctor?.avatar || null,
      status: statusLabel,
      jobTitle: emp.job?.title || 'Job',
      dateRange,
      salaryLabel: typeof emp.salary === 'number' ? `₹${emp.salary}` : 'Salary N/A',
      shift: emp.shift,
      jobType: emp.jobType,
      department: emp.department,
    };
  }), [filteredRawEmployees]);

  // Fetch today's status for all employees
  const fetchTodayStatuses = useCallback(async () => {
    const activeEmployees = employees.filter(emp => emp.status === 'Active');
    if (activeEmployees.length === 0 || attendanceLoading || hasFetchedAttendance) {
      return;
    }

    setAttendanceLoading(true);
    const assignmentIds = activeEmployees.map(emp => emp.assignmentId);
    const statuses: Record<string, { status: any; loading: boolean }> = {};

    // Initialize all as loading
    assignmentIds.forEach(id => {
      statuses[id] = { status: 'not_marked', loading: true };
    });
    setAttendanceStatuses(statuses);

    try {
      const response = await hospitalApi.getEmployeesTodayStatusBulk(assignmentIds);
      if (response.success && response.data && Array.isArray(response.data)) {
        const newStatuses: Record<string, { status: any; loading: boolean }> = {};
        response.data.forEach((item: any) => {
          newStatuses[item.assignmentId] = { status: item.status, loading: false };
        });
        setAttendanceStatuses(newStatuses);
        setHasFetchedAttendance(true); // Mark as fetched
      } else {
        // Fallback to not_marked for all
        const fallbackStatuses: Record<string, { status: any; loading: boolean }> = {};
        assignmentIds.forEach(id => {
          fallbackStatuses[id] = { status: 'not_marked', loading: false };
        });
        setAttendanceStatuses(fallbackStatuses);
        setHasFetchedAttendance(true); // Still mark as fetched to prevent retries
      }
    } catch {
      // On error, set all to not_marked
      const errorStatuses: Record<string, { status: any; loading: boolean }> = {};
      assignmentIds.forEach(id => {
        errorStatuses[id] = { status: 'not_marked', loading: false };
      });
      setAttendanceStatuses(errorStatuses);
      setHasFetchedAttendance(true); // Still mark as fetched to prevent retries
    } finally {
      setAttendanceLoading(false);
    }
  }, [employees, attendanceLoading, hasFetchedAttendance]);

  useEffect(() => {
    if (rawEmployees.length > 0 && activeTab === 'Employees' && !attendanceLoading && !hasFetchedAttendance) {
      fetchTodayStatuses();
    }
  }, [rawEmployees.length, activeTab, attendanceLoading, hasFetchedAttendance, fetchTodayStatuses]);

  // Reset attendance data when tab changes
  useEffect(() => {
    if (activeTab !== 'Employees') {
      setAttendanceStatuses({});
      setHasFetchedAttendance(false);
    }
  }, [activeTab]);

  // Fetch Leave Requests
  const { requests: rawRequests, isLoading: leaveLoading, refresh: refreshLeave, processRequest } = useHospitalLeaveRequests('pending');

  const leaveRequests: LeaveRequest[] = rawRequests.map(r => ({
    id: r.id,
    doctorName: r.doctorName,
    doctorAvatar: r.doctorAvatar || null,
    doctorRole: r.doctorRole,
    jobTitle: r.jobTitle,
    startDate: r.startDate,
    endDate: r.endDate,
    dateRange: `${new Date(r.startDate).toLocaleDateString()} - ${new Date(r.endDate).toLocaleDateString()}`,
    totalDays: r.totalDays,
    type: r.leaveType.charAt(0).toUpperCase() + r.leaveType.slice(1),
    reason: r.reason,
    status: r.status,
  }));

  // Leave tab statistics
  const pendingCount = leaveRequests.length;

  const onLeaveToday = useMemo(() => {
    const now = new Date();
    return rawRequests.filter((req) => {
      if (req.status !== 'approved') return false;
      const start = new Date(req.startDate);
      const end = new Date(req.endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
      return start <= now && end >= now;
    }).length;
  }, [rawRequests]);

  const todayLabel = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refreshLeave()]);
    setRefreshing(false);
  }, [refetch, refreshLeave]);

  // Combined loading state only if on relevant list, or initial load
  // Actually simplest is just show loading if hook is loading active list
  const isListLoading = (activeTab === 'Leave' ? leaveLoading : loading) && !refreshing;

  // Clear search handler
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  return (
    <View className="flex-1 bg-gray-50">
      {/* Tabs */}
      <View className="flex-row bg-white pt-2 border-b border-gray-100 justify-center">
        <Tab label="Employees" active={activeTab === 'Employees'} onPress={() => setActiveTab('Employees')} />
        <Tab label="Schedule" active={activeTab === 'Schedule'} onPress={() => setActiveTab('Schedule')} />
        <Tab label="Leave" active={activeTab === 'Leave'} onPress={() => setActiveTab('Leave')} />
      </View>

      {/* Search Bar */}
      <View className="px-5 py-4 bg-white">
        <View className="flex-row items-center bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
          <Ionicons name="search-outline" size={20} color="#9ca3af" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search Employees by Name"
            placeholderTextColor="#9ca3af"
            className="flex-1 ml-2 text-gray-900 text-sm"
          />
          {searchQuery.trim().length > 0 && (
            <TouchableOpacity onPress={handleClearSearch} className="ml-2">
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
          <TouchableOpacity className="ml-2 bg-brand-primary rounded-lg p-2">
            <Ionicons name="options-outline" size={18} color="white" />
          </TouchableOpacity>
        </View>
        {/* Inline search indicator */}
        {searchQuery.trim().length > 0 && (
          <View className="mt-2 flex-row items-center">
            <Ionicons name="funnel-outline" size={14} color="#6B7280" />
            <Text className="text-xs text-gray-600 ml-1">
              Filtering by: "{searchQuery}"
            </Text>
          </View>
        )}
      </View>

      {/* Employee List */}
      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1A1464']} />
        }
      >
        {isListLoading ? (
          <View className="mt-4">
            <SkeletonLoader variant="card" count={3} />
          </View>
        ) : error ? (
          <EmptyState
            type="error"
            title="Error"
            message={error}
            onRetry={onRefresh}
          />
        ) : employees.length === 0 ? (
          <EmptyState
            type={searchQuery.trim() ? 'no-search-results' : 'no-data'}
            icon="people-outline"
            title={searchQuery ? 'No employees found' : 'No employees yet'}
            message={searchQuery ? 'Try adjusting your search terms' : 'Employees will appear here once hired'}
            showSearchButton={searchQuery.trim().length > 0}
            onClearSearch={searchQuery.trim() ? handleClearSearch : undefined}
          />
        ) : (
          <>
            {activeTab === 'Employees' ? (
              employees.map((employee) => (
                <EmployeeCard
                  key={employee.assignmentId}
                  employee={employee}
                  attendanceStatus={attendanceStatuses[employee.assignmentId]}
                />
              ))
            ) : activeTab === 'Schedule' ? (
              employees
                .filter((e) => e.status === 'Active')
                .map((employee) => (
                  <ScheduleCard
                    key={employee.assignmentId}
                    employee={employee}
                    onAssignTime={handleAssignTime}
                  />
                ))
            ) : activeTab === 'Leave' ? (
              <>
                {/* Leave Stats Cards */}
                <View className="flex-row mb-4" style={{ gap: 12 }}>
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

                {/* Today Header */}
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-xl font-bold text-gray-900">Today, {todayLabel}</Text>
                  <TouchableOpacity>
                    <Text className="text-brand-secondary font-semibold">View Calendar</Text>
                  </TouchableOpacity>
                </View>

                {/* Leave Request Cards */}
                {leaveRequests.length > 0 ? (
                  leaveRequests.map((req) => (
                    <LeaveRequestCard
                      key={req.id}
                      request={req}
                      onAction={async (id, action) => {
                        await processRequest(id, action);
                      }}
                    />
                  ))
                ) : (
                  <View className="py-10 items-center">
                    <Feather name="calendar" size={48} color="#9CA3AF" />
                    <Text className="text-gray-500 mt-3">No pending leave requests</Text>
                  </View>
                )}
              </>
            ) : null}
            <View className="h-4" />
          </>
        )}
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
                  <Text className="text-xl font-bold text-gray-900">Manage Schedule</Text>
                  <Text className="text-sm text-gray-500 mt-1">
                    {selectedEmployeeForSchedule?.name}
                  </Text>
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
                        // Update selected dates colors
                        const updated = { ...selectedDates };
                        Object.keys(updated).forEach(key => {
                          updated[key].selectedColor = '#375BD2';
                        });
                        setSelectedDates(updated);
                      }}
                      className={`flex-1 py-3 rounded-xl border-2 ${isWorkDay ? 'bg-brand-tertiary/10 border-brand-tertiary' : 'bg-white border-gray-200'
                        }`}
                    >
                      <Text
                        className={`text-center font-semibold ${isWorkDay ? 'text-brand-tertiary' : 'text-gray-600'
                          }`}
                      >
                        Work Day
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setIsWorkDay(false);
                        // Update selected dates colors
                        const updated = { ...selectedDates };
                        Object.keys(updated).forEach(key => {
                          updated[key].selectedColor = '#EF4444';
                        });
                        setSelectedDates(updated);
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
                    markedDates={selectedDates}
                    onDayPress={handleDayPress}
                    theme={{
                      todayTextColor: '#375BD2',
                      selectedDayBackgroundColor: isWorkDay ? '#375BD2' : '#EF4444',
                      selectedDayTextColor: '#ffffff',
                      arrowColor: '#375BD2',
                    }}
                    minDate={new Date().toISOString().split('T')[0]}
                  />
                </View>

                {/* Time Selection - Only show for work days */}
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
                    <Text className="text-sm font-semibold text-gray-700 mb-2">
                      Selected: {Object.keys(selectedDates).length} {Object.keys(selectedDates).length === 1 ? 'day' : 'days'}
                    </Text>
                    <Text className="text-xs text-gray-500">
                      {Object.keys(selectedDates).sort().slice(0, 3).join(', ')}
                      {Object.keys(selectedDates).length > 3 && ` +${Object.keys(selectedDates).length - 3} more`}
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Action Buttons */}
              <View className="p-5 border-t border-gray-200 flex-row" style={{ gap: 12 }}>
                <TouchableOpacity
                  onPress={() => setScheduleModalVisible(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-300"
                >
                  <Text className="text-center font-semibold text-gray-700">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveSchedule}
                  className="flex-1 py-3 rounded-xl bg-indigo-900"
                  disabled={Object.keys(selectedDates).length === 0}
                  style={{
                    opacity: Object.keys(selectedDates).length === 0 ? 0.5 : 1,
                  }}
                >
                  <Text className="text-center font-semibold text-white">Save Schedule</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Time Pickers */}
          {showStartTimePicker && (
            <DateTimePicker
              value={startTime}
              mode="time"
              is24Hour={false}
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
              is24Hour={false}
              display="default"
              onChange={(_event, selectedDate) => {
                setShowEndTimePicker(false);
                if (selectedDate) setEndTime(selectedDate);
              }}
            />
          )}
        </Modal>
      )}
    </View>
  );
}
