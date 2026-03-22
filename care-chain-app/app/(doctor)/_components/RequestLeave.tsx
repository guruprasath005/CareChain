import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { LeaveRequestStatus, RequestLeaveData } from '../../../data/activeJobs';

export type RequestLeaveProps = {
  data: RequestLeaveData;
  onPressNotifications?: () => void;
  onPressSettings?: () => void;
  onSubmit?: (payload: {
    dateText: string;
    startDate?: Date | null;
    endDate?: Date | null;
    dayMode: 'single' | 'multiple';
    leaveType: 'Sick' | 'Emergency';
    note: string;
  }) => void;
  onPressViewAll?: () => void;
};

function statusPill(status: LeaveRequestStatus) {
  switch (status) {
    case 'Pending':
      return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' };
    case 'Approved':
      return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Approved' };
    case 'Rejected':
      return { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-700', label: status };
  }
}

const RequestLeave: React.FC<RequestLeaveProps> = ({
  data,
  onSubmit,
  onPressViewAll,
}) => {
  /* State */
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [dateText, setDateText] = useState(''); // Keep for compatibility if needed, but primarily use state dates

  const [dayMode, setDayMode] = useState<'single' | 'multiple'>('single');
  const [leaveType, setLeaveType] = useState<'Sick' | 'Emergency'>('Sick');
  const [note, setNote] = useState('');

  // Update dateText for display whenever dates change
  React.useEffect(() => {
    if (dayMode === 'single' && startDate) {
      setDateText(startDate.toLocaleDateString('en-US'));
    } else if (dayMode === 'multiple' && startDate && endDate) {
      setDateText(`${startDate.toLocaleDateString('en-US')} - ${endDate.toLocaleDateString('en-US')}`);
    } else if (dayMode === 'multiple' && startDate) {
      setDateText(`${startDate.toLocaleDateString('en-US')} - ...`);
    } else {
      setDateText('');
    }
  }, [startDate, endDate, dayMode]);

  const onStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setStartDate(selectedDate);
      if (dayMode === 'single') {
        setEndDate(selectedDate);
      }
    }
  };

  const onEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  const usedYtdText = useMemo(
    () => String(data.usedYtdDays).padStart(2, '0'),
    [data.usedYtdDays]
  );

  const [calculatedTotalDays, setCalculatedTotalDays] = useState(0);

  // Calculate total days whenever dates change
  useEffect(() => {
    if (!startDate || !endDate) {
      setCalculatedTotalDays(0);
      return;
    }
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setCalculatedTotalDays(diffDays + 1); // +1 because leave includes both start and end dates
  }, [startDate, endDate]);

  // Show total days when both dates are selected and calculation is valid
  const shouldShowTotalDays = Boolean(startDate && endDate && calculatedTotalDays > 0);

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ paddingBottom: 16 }}>
      {/* Header */}
      <View className="px-5 pt-8">
        <View className="w-full max-w-2xl self-center">
          <View>
            <Text className="text-gray-900 text-xl font-bold">{data.doctorName}</Text>
            <Text className="text-gray-600 text-sm font-medium mt-1">{data.doctorRole}</Text>
          </View>

          <Text className="text-gray-900 text-2xl font-bold mt-6">Request Time Off</Text>
          <Text className="text-gray-600 text-sm font-medium mt-2">
            Manage your schedule and leave balances
          </Text>
        </View>
      </View>

      {/* Stats Cards */}
      <View className="px-5 mt-6">
        <View className="w-full max-w-2xl self-center">
          <View className="flex-row">
            <View className="flex-1 bg-white rounded-xl border border-gray-300 p-4 mr-3.5">
              <Text className="text-gray-500 text-sm font-medium">AVAILABLE</Text>
              <Text className="text-2xl font-bold text-gray-900 mt-2">
                {data.availableDays} <Text className="text-sm font-medium text-gray-500">days</Text>
              </Text>
              <View className="flex-row items-center mt-2">
                <View className="w-6 h-6 rounded-full bg-emerald-500 items-center justify-center">
                  <Ionicons name="add" size={14} color="#FFFFFF" />
                </View>
                <Text className="text-emerald-700 text-sm font-bold ml-2">Accruing</Text>
              </View>
            </View>

            <View className="flex-1 bg-white rounded-xl border border-gray-300 p-4">
              <Text className="text-gray-500 text-sm font-medium">USED YTD</Text>
              <Text className="text-2xl font-bold text-gray-900 mt-2">
                {usedYtdText} <Text className="text-sm font-medium text-gray-500">days</Text>
              </Text>
              <Text className="text-gray-500 text-sm mt-2 font-medium">{data.usedYtdSinceLabel}</Text>
            </View>
          </View>

          {/* New Request Form */}
          <View className="mt-6 bg-white rounded-xl border border-gray-300 p-5">
            <View className="flex-row items-center">
              <Ionicons name="create-outline" size={18} color="#111827" />
              <Text className="text-lg font-bold text-gray-900 ml-2">New Request</Text>
            </View>

            <Text className="text-gray-700 font-medium mt-5">Select Dates</Text>

            <View className="mt-2 flex-row items-center justify-between">
              {/* Start Date Picker Trigger */}
              <TouchableOpacity
                onPress={() => setShowStartDatePicker(true)}
                activeOpacity={0.8}
                className="flex-1 flex-row items-center border border-gray-400 rounded-lg px-3 py-3 mr-2.5"
              >
                <Text className={`flex-1 text-sm ${startDate ? 'text-gray-900' : 'text-gray-500'}`}>
                  {startDate ? startDate.toLocaleDateString() : 'Start Date'}
                </Text>
                <Ionicons name="calendar-outline" size={18} color="#6b7280" />
              </TouchableOpacity>

              {dayMode === 'multiple' && (
                <>
                  <Text className="text-gray-400">-</Text>
                  {/* End Date Picker Trigger */}
                  <TouchableOpacity
                    onPress={() => setShowEndDatePicker(true)}
                    activeOpacity={0.8}
                    className="flex-1 flex-row items-center border border-gray-400 rounded-lg px-3 py-3"
                  >
                    <Text className={`flex-1 text-sm ${endDate ? 'text-gray-900' : 'text-gray-500'}`}>
                      {endDate ? endDate.toLocaleDateString() : 'End Date'}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color="#6b7280" />
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Date Pickers */}
            {(showStartDatePicker || (Platform.OS === 'ios' && showStartDatePicker)) && (
              <DateTimePicker
                value={startDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onStartDateChange}
                minimumDate={new Date()}
              />
            )}

            {dayMode === 'multiple' && (showEndDatePicker || (Platform.OS === 'ios' && showEndDatePicker)) && (
              <DateTimePicker
                value={endDate || startDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onEndDateChange}
                minimumDate={startDate || new Date()}
              />
            )}

            <Text className="text-xs text-gray-500 mt-1">
              For multiple days, use format: mm/dd/yyyy - mm/dd/yyyy
            </Text>

            {/* Total Days Display */}
            {shouldShowTotalDays && calculatedTotalDays > 0 && (
              <View className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <Text className="text-sm text-blue-800 font-medium">
                  Total Days: {calculatedTotalDays} day{calculatedTotalDays !== 1 ? 's' : ''}
                </Text>
              </View>
            )}

            <View className="mt-4 flex-row items-center">
              <TouchableOpacity
                onPress={() => setDayMode('single')}
                activeOpacity={0.85}
                className="flex-row items-center mr-4"
              >
                <View
                  className={`w-5 h-5 rounded-full border ${dayMode === 'single' ? 'border-blue-600' : 'border-gray-400'
                    } items-center justify-center`}
                >
                  {dayMode === 'single' ? <View className="w-3 h-3 rounded-full bg-blue-600" /> : null}
                </View>
                <Text className="text-gray-700 font-medium ml-2">Single Day</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setDayMode('multiple')}
                activeOpacity={0.85}
                className="flex-row items-center"
              >
                <View
                  className={`w-5 h-5 rounded-full border ${dayMode === 'multiple' ? 'border-blue-600' : 'border-gray-400'
                    } items-center justify-center`}
                >
                  {dayMode === 'multiple' ? <View className="w-3 h-3 rounded-full bg-blue-600" /> : null}
                </View>
                <Text className="text-gray-700 font-medium ml-2">Multiple Days</Text>
              </TouchableOpacity>
            </View>

            <Text className="text-gray-700 font-medium mt-6">Type of Leave</Text>
            <View className="mt-2 flex-row" style={{ gap: 12 }}>
              <TouchableOpacity
                onPress={() => setLeaveType('Sick')}
                activeOpacity={0.9}
                className={`flex-1 rounded-xl border p-4 items-center justify-center ${leaveType === 'Sick' ? 'border-gray-700 bg-blue-00 text-white' : 'border-gray-300'
                  }`}
              >
                <View className="w-10 h-10 rounded-lg bg-gray-100 items-center justify-center">
                  <Ionicons name="sad-outline" size={22} color="#4b5563" />
                </View>
                <Text className="text-lg font-bold text-gray-700 mt-3">Sick</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setLeaveType('Emergency')}
                activeOpacity={0.9}
                className={`flex-1 rounded-xl border p-4 items-center justify-center ${leaveType === 'Emergency' ? 'border-gray-700 bg-gray-50' : 'border-gray-300'
                  }`}
              >
                <View className="w-10 h-10 rounded-lg bg-gray-100 items-center justify-center">
                  <Ionicons name="warning-outline" size={22} color="#4b5563" />
                </View>
                <Text className="text-lg font-bold text-gray-700 mt-3">Emergency</Text>
              </TouchableOpacity>
            </View>

            <Text className="text-gray-700 font-medium mt-6">Note (Optional)</Text>
            <View className="mt-2 border border-gray-400 rounded-lg px-4 py-3">
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Brief reason for request..."
                placeholderTextColor="#6b7280"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                className="text-gray-900 text-sm"
                style={{ minHeight: 80 }}
              />
            </View>

            <TouchableOpacity
              onPress={() => onSubmit?.({
                dateText: dateText, // Keep for backward compat if needed, or better yet, pass dates
                startDate: startDate,
                endDate: endDate,
                dayMode,
                leaveType,
                note
              })}
              activeOpacity={0.9}
              className="mt-6 bg-blue-900 rounded-lg py-3 items-center justify-center"
            >
              <Text className="text-white text-base font-bold">Send Request</Text>
            </TouchableOpacity>
          </View>

          {/* Recent Requests */}
          <View className="mt-8 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-gray-900">Recent Requests</Text>
            <TouchableOpacity onPress={onPressViewAll} activeOpacity={0.85}>
              <Text className="text-blue-600 text-sm font-medium">View All</Text>
            </TouchableOpacity>
          </View>

          <View className="mt-4">
            {data.recentRequests.length > 0 ? (
              <>
                {data.recentRequests.map((req, index) => {
                  const pill = statusPill(req.status);
                  return (
                    <View
                      key={`request-${index}`}
                      className="bg-white rounded-xl border border-gray-300 p-4 mb-3 flex-row items-center"
                    >
                  <View className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center">
                    <Ionicons
                      name={
                        req.status === 'Approved'
                          ? 'checkmark'
                          : req.status === 'Rejected'
                            ? 'close'
                            : 'hourglass'
                      }
                      size={20}
                      color={
                        req.status === 'Approved'
                          ? '#059669'
                          : req.status === 'Rejected'
                            ? '#DC2626'
                            : '#D97706'
                      }
                    />
                  </View>

                  <View className="flex-1 ml-3">
                    <Text className="text-base font-bold text-gray-900">{req.dateRange}</Text>
                    <Text className="text-gray-500 text-sm mt-1">
                      {req.typeLabel} • {req.durationLabel}
                    </Text>
                  </View>

                  <View className={`px-3 py-1 rounded-full ${pill.bg}`}>
                    <Text className={`text-xs font-bold ${pill.text}`}>{pill.label}</Text>
                  </View>
                </View>
              );
            })}
              </>
            ) : (
              <View className="bg-gray-50 rounded-xl p-6 items-center justify-center">
                <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
                <Text className="text-gray-500 text-sm mt-2">No recent leave requests</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

export default RequestLeave;