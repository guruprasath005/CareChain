import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

interface OfferModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (offerData: OfferFormData) => Promise<void>;
  candidateName: string;
  jobTitle: string;
  isSubmitting: boolean;
}

export interface OfferFormData {
  salary: number;
  salaryType: 'monthly' | 'annual' | 'hourly' | 'daily';
  currency: string;
  joiningDate: string;
  reportingDate: string;
  notes: string;
  offerConfirmationDate: string;
  terms: string;
}

type DatePickerField = 'joiningDate' | 'reportingDate' | 'offerConfirmationDate' | null;

export default function OfferModal({
  visible,
  onClose,
  onSubmit,
  candidateName,
  jobTitle,
  isSubmitting,
}: OfferModalProps) {
  const [salary, setSalary] = useState('');
  const [salaryType, setSalaryType] = useState<'monthly' | 'annual' | 'hourly' | 'daily'>('monthly');
  const [joiningDate, setJoiningDate] = useState<Date | null>(null);
  const [reportingDate, setReportingDate] = useState<Date | null>(null);
  const [offerConfirmationDate, setOfferConfirmationDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [showDatePicker, setShowDatePicker] = useState<DatePickerField>(null);

  const salaryTypes = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'annual', label: 'Annual' },
    { value: 'hourly', label: 'Hourly' },
    { value: 'daily', label: 'Daily' },
  ];

  const formatDate = (date: Date | null) => {
    if (!date) return 'Select Date';
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(null);
    }
    
    if (selectedDate && showDatePicker) {
      switch (showDatePicker) {
        case 'joiningDate':
          setJoiningDate(selectedDate);
          break;
        case 'reportingDate':
          setReportingDate(selectedDate);
          break;
        case 'offerConfirmationDate':
          setOfferConfirmationDate(selectedDate);
          break;
      }
    }
  };

  const validateForm = (): string | null => {
    if (!salary || parseInt(salary) <= 0) {
      return 'Please enter a valid salary amount';
    }
    if (!joiningDate) {
      return 'Please select a joining date';
    }
    if (!reportingDate) {
      return 'Please select a reporting date';
    }
    if (!offerConfirmationDate) {
      return 'Please select an offer confirmation deadline';
    }
    if (joiningDate < new Date()) {
      return 'Joining date cannot be in the past';
    }
    if (offerConfirmationDate < new Date()) {
      return 'Confirmation deadline cannot be in the past';
    }
    if (reportingDate < joiningDate) {
      return 'Reporting date cannot be before joining date';
    }
    return null;
  };

  const handleSubmit = async () => {
    const error = validateForm();
    if (error) {
      Alert.alert('Validation Error', error);
      return;
    }

    const offerData: OfferFormData = {
      salary: parseInt(salary),
      salaryType,
      currency: 'INR',
      joiningDate: joiningDate!.toISOString(),
      reportingDate: reportingDate!.toISOString(),
      notes: notes.trim(),
      offerConfirmationDate: offerConfirmationDate!.toISOString(),
      terms: terms.trim(),
    };

    await onSubmit(offerData);
  };

  const resetForm = () => {
    setSalary('');
    setSalaryType('monthly');
    setJoiningDate(null);
    setReportingDate(null);
    setOfferConfirmationDate(null);
    setNotes('');
    setTerms('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl max-h-[90%]">
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100">
            <View className="flex-1">
              <Text className="text-xl font-bold text-gray-900">Make an Offer</Text>
              <Text className="text-sm text-gray-500 mt-1">
                {candidateName} • {jobTitle}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              className="h-10 w-10 rounded-full bg-gray-100 items-center justify-center"
            >
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView className="px-6 py-4" showsVerticalScrollIndicator={false}>
            {/* Salary Section */}
            <View className="mb-5">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Salary <Text className="text-red-500">*</Text>
              </Text>
              <View className="flex-row">
                <View className="flex-1 mr-3">
                  <View className="flex-row items-center border border-gray-200 rounded-xl px-4 py-3 bg-gray-50">
                    <Text className="text-gray-500 mr-2">₹</Text>
                    <TextInput
                      placeholder="Enter amount"
                      value={salary}
                      onChangeText={setSalary}
                      keyboardType="numeric"
                      className="flex-1 text-gray-900"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </View>
                <View className="w-32">
                  <View className="border border-gray-200 rounded-xl bg-gray-50 overflow-hidden">
                    <TouchableOpacity
                      className="px-4 py-3"
                      onPress={() => {
                        const currentIndex = salaryTypes.findIndex(t => t.value === salaryType);
                        const nextIndex = (currentIndex + 1) % salaryTypes.length;
                        setSalaryType(salaryTypes[nextIndex].value as any);
                      }}
                    >
                      <Text className="text-gray-900 text-center">
                        {salaryTypes.find(t => t.value === salaryType)?.label}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* Joining Date */}
            <View className="mb-5">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Joining Date <Text className="text-red-500">*</Text>
              </Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker('joiningDate')}
                className="flex-row items-center border border-gray-200 rounded-xl px-4 py-3 bg-gray-50"
              >
                <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                <Text className={`ml-3 flex-1 ${joiningDate ? 'text-gray-900' : 'text-gray-400'}`}>
                  {formatDate(joiningDate)}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Reporting Date */}
            <View className="mb-5">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Reporting Date <Text className="text-red-500">*</Text>
              </Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker('reportingDate')}
                className="flex-row items-center border border-gray-200 rounded-xl px-4 py-3 bg-gray-50"
              >
                <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                <Text className={`ml-3 flex-1 ${reportingDate ? 'text-gray-900' : 'text-gray-400'}`}>
                  {formatDate(reportingDate)}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Offer Confirmation Deadline */}
            <View className="mb-5">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Offer Confirmation Deadline <Text className="text-red-500">*</Text>
              </Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker('offerConfirmationDate')}
                className="flex-row items-center border border-gray-200 rounded-xl px-4 py-3 bg-gray-50"
              >
                <Ionicons name="time-outline" size={20} color="#6b7280" />
                <Text className={`ml-3 flex-1 ${offerConfirmationDate ? 'text-gray-900' : 'text-gray-400'}`}>
                  {formatDate(offerConfirmationDate)}
                </Text>
              </TouchableOpacity>
              <Text className="text-xs text-gray-400 mt-1">
                Candidate must respond by this date
              </Text>
            </View>

            {/* Notes */}
            <View className="mb-5">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Notes (Optional)
              </Text>
              <TextInput
                placeholder="Add any additional information for the candidate..."
                value={notes}
                onChangeText={setNotes}
                className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-gray-900"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                placeholderTextColor="#9ca3af"
                style={{ minHeight: 80 }}
              />
            </View>

            {/* Terms & Conditions */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Terms & Conditions (Optional)
              </Text>
              <TextInput
                placeholder="e.g., Probation period, notice period, benefits..."
                value={terms}
                onChangeText={setTerms}
                className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-gray-900"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                placeholderTextColor="#9ca3af"
                style={{ minHeight: 80 }}
              />
            </View>

            {/* Info Banner */}
            <View className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
              <View className="flex-row items-start">
                <Ionicons name="information-circle" size={20} color="#3b82f6" />
                <View className="ml-3 flex-1">
                  <Text className="text-blue-800 font-medium text-sm">What happens next?</Text>
                  <Text className="text-blue-600 text-xs mt-1 leading-5">
                    • Candidate will receive an in-app notification{'\n'}
                    • An email with offer details will be sent{'\n'}
                    • You'll be notified when they respond
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View className="flex-row px-6 py-4 border-t border-gray-100 bg-white">
            <TouchableOpacity
              onPress={handleClose}
              className="flex-1 border border-gray-300 rounded-xl py-4 mr-3"
              disabled={isSubmitting}
            >
              <Text className="text-gray-700 font-semibold text-center">Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              className={`flex-1 bg-green-600 rounded-xl py-4 flex-row items-center justify-center ${isSubmitting ? 'opacity-50' : ''}`}
            >
              {isSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="white" />
                  <Text className="text-white font-semibold ml-2">Send Offer</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Date Picker */}
        {showDatePicker && (
          <DateTimePicker
            value={
              showDatePicker === 'joiningDate'
                ? joiningDate || new Date()
                : showDatePicker === 'reportingDate'
                ? reportingDate || new Date()
                : offerConfirmationDate || new Date()
            }
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={new Date()}
            onChange={handleDateChange}
          />
        )}
      </View>
    </Modal>
  );
}
