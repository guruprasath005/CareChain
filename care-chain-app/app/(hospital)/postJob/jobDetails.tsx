import { Ionicons } from '@expo/vector-icons';
import RNDateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown } from 'react-native-element-dropdown';
import { hospitalApi } from '@/services/api';
import { StatusBar } from 'react-native';
import { Colors } from '@/constants/Colors';
import { StateCitySelector } from '@/app/_components/StateCitySelector';

// Parse time string (HH:MM) to Date object
const parseTimeString = (timeStr: string): Date => {
  const date = new Date();
  if (timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
      date.setHours(hours, minutes, 0, 0);
    }
  }
  return date;
};

export default function JobDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isEditMode = params.mode === 'edit' && params.id;
  const jobId = params.id as string;

  const [loading, setLoading] = useState(!!isEditMode);
  // Initialize with params if available (for back navigation), otherwise default
  const [jobTitle, setJobTitle] = useState((params.jobTitle as string) || '');
  const [jobDescription, setJobDescription] = useState((params.jobDescription as string) || '');
  const [specialization, setSpecialization] = useState((params.specialization as string) || '');
  const [city, setCity] = useState((params.city as string) || '');
  const [state, setState] = useState((params.state as string) || '');
  const [pincode, setPincode] = useState((params.pincode as string) || '');

  const [startDate, setStartDate] = useState(
    params.startDate ? new Date(params.startDate as string) : new Date()
  );
  const [endDate, setEndDate] = useState(
    params.endDate ? new Date(params.endDate as string) : new Date()
  );
  // For time, if params exist they might be time strings or full dates.
  // The Review screen passes .toTimeString() which is "HH:MM:SS GMT..."
  // But our previous logic was expecting Date objects or using existing state.
  // Let's create a helper or just parse if valid date string.
  const [shiftStartTime, setShiftStartTime] = useState(
    params.shiftStartTime
      ? (params.shiftStartTime.includes(':') ? parseTimeString(params.shiftStartTime as string) : new Date(params.shiftStartTime as string))
      : new Date()
  );
  const [shiftEndTime, setShiftEndTime] = useState(
    params.shiftEndTime
      ? (params.shiftEndTime.includes(':') ? parseTimeString(params.shiftEndTime as string) : new Date(params.shiftEndTime as string))
      : new Date()
  );

  const [jobType, setJobType] = useState((params.jobType as string) || 'Full Time');
  const [salaryType, setSalaryType] = useState((params.salaryType as string) || 'monthly');
  const [salary, setSalary] = useState((params.salary as string) || '');

  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time'>('date');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeDateField, setActiveDateField] = useState<'start' | 'end' | 'shiftStart' | 'shiftEnd' | null>(null);

  // Hidden state for passing to next screens (fetched during edit)
  const [facilities, setFacilities] = useState({
    transportation: 'false',
    accommodation: 'false',
    meals: 'false',
    insurance: 'false',
  });
  const [requirements, setRequirements] = useState({
    qualifications: '',
    skills: '',
    experience: '',
  });

  const [isFocusJobType, setIsFocusJobType] = useState(false);
  const [isFocusSalaryType, setIsFocusSalaryType] = useState(false);

  const jobTypeData = [
    { label: 'Full Time', value: 'Full Time' },
    { label: 'Part Time', value: 'Part Time' },
    { label: 'Contract', value: 'Contract' },
    { label: 'Locum Tenens', value: 'Locum Tenens' },
  ];

  // Map backend jobType values to display values
  const mapJobTypeFromBackend = (type: string): string => {
    const mapping: Record<string, string> = {
      'full_time': 'Full Time',
      'part_time': 'Part Time',
      'contract': 'Contract',
      'locum_tenens': 'Locum Tenens',
      'per_diem': 'Contract',
    };
    return mapping[type] || type || 'Full Time';
  };

  // Fetch existing job data when in edit mode
  useEffect(() => {
    const fetchJobData = async () => {
      if (!isEditMode || !jobId) return;

      try {
        setLoading(true);
        const response = await hospitalApi.getJobWithApplications(jobId);

        if (response.success && response.data) {
          const job = response.data.job || response.data;

          // Populate form fields
          setJobTitle(job.title || '');
          setJobDescription(job.description || '');
          setSpecialization(job.specialization || '');

          // Location
          if (job.location) {
            setCity(job.location.city || '');
            setState(job.location.state || '');
            setPincode(job.location.pincode || '');
          }

          // Duration
          if (job.duration) {
            if (job.duration.startDate) {
              setStartDate(new Date(job.duration.startDate));
            }
            if (job.duration.endDate) {
              setEndDate(new Date(job.duration.endDate));
            }
          }

          // Shift times
          if (job.shift) {
            if (job.shift.startTime) {
              setShiftStartTime(parseTimeString(job.shift.startTime));
            }
            if (job.shift.endTime) {
              setShiftEndTime(parseTimeString(job.shift.endTime));
            }
          }

          // Job type
          setJobType(mapJobTypeFromBackend(job.jobType));

          // Salary/Compensation
          if (job.compensation?.amount) {
            setSalary(String(job.compensation.amount));
          } else if (job.salary) {
            // Extract number from salary string
            const salaryNum = job.salary.replace(/[^\d]/g, '');
            setSalary(salaryNum);
            setSalary(salaryNum);
          }

          // Facilities
          if (job.facilities) {
            setFacilities({
              transportation: String(!!job.facilities.transport),
              accommodation: String(!!job.facilities.accommodation),
              meals: String(!!job.facilities.meals),
              insurance: String(!!job.facilities.insurance),
            });
          }

          // Requirements
          if (job.requirements) {
            setRequirements({
              qualifications: Array.isArray(job.requirements.qualifications) ? job.requirements.qualifications.join(',') : '',
              skills: Array.isArray(job.requirements.skills) ? job.requirements.skills.join(',') : '',
              experience: typeof job.requirements.minimumExperience === 'number'
                ? (job.requirements.minimumExperience === 0 ? 'Less than 1 Year' :
                  job.requirements.minimumExperience === 1 ? 'One Year' :
                    job.requirements.minimumExperience === 2 ? 'Two Years' :
                      job.requirements.minimumExperience >= 5 ? '5+ Years' : '3-5 Years') // Approx mapping
                : (job.requirements.minimumExperience || '')
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch job:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchJobData();
  }, [isEditMode, jobId]);

  const handleNext = () => {
    router.push({
      pathname: '/(hospital)/postJob/candidateSupport',
      params: {
        jobId: isEditMode ? jobId : undefined,
        mode: isEditMode ? 'edit' : 'create',
        jobTitle,
        jobDescription,
        specialization: specialization || jobTitle, // fallback to title
        city,
        state,
        pincode,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        shiftStartTime: shiftStartTime.toTimeString(),
        shiftEndTime: shiftEndTime.toTimeString(),
        jobType,
        salary,
        salaryType,
        // Pass fetched/existing facilities and requirements
        transportation: facilities.transportation,
        accommodation: facilities.accommodation,
        meals: facilities.meals,
        insurance: facilities.insurance,
        qualifications: requirements.qualifications,
        skills: requirements.skills,
        experience: requirements.experience,
      },
    });
  };

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    // On Android the picker is a dialog — close it after any interaction
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    // On iOS the picker is inline — only close when dismissed, not on every scroll
    if (event.type === 'dismissed') {
      setShowDatePicker(false);
      return;
    }
    if (selectedDate && activeDateField) {
      if (activeDateField === 'start') setStartDate(selectedDate);
      if (activeDateField === 'end') setEndDate(selectedDate);
      if (activeDateField === 'shiftStart') setShiftStartTime(selectedDate);
      if (activeDateField === 'shiftEnd') setShiftEndTime(selectedDate);
    }
  };

  const showPicker = (mode: 'date' | 'time', field: 'start' | 'end' | 'shiftStart' | 'shiftEnd') => {
    setDatePickerMode(mode);
    setActiveDateField(field);
    setShowDatePicker(true);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString();
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.brand.secondary} />
        <ActivityIndicator size="large" color={Colors.brand.secondary} />
        <Text className="mt-4 text-gray-600">Loading job details...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.brand.secondary} />
      <View className="px-5 mt-4">
        <View className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="absolute right-4 top-4 z-10"
          >
            <Ionicons name="close" size={24} color="#1f2937" />
          </TouchableOpacity>

          <Text className="text-xl font-semibold text-gray-900 mb-1">
            {isEditMode ? 'Edit Job Details' : 'Job Details'}
          </Text>
          <Text className="text-sm text-gray-500 mb-6">
            {isEditMode ? 'Update the job information' : 'Enter basic information about the positions'}
          </Text>

          <View className="flex-row items-center mb-6">
            <View className="w-8 h-8 rounded-full bg-brand-primary items-center justify-center">
              <Text className="text-white font-semibold text-sm">1</Text>
            </View>
            <View className="flex-1 h-0.5 bg-gray-200 mx-2" />
            <View className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center">
              <Text className="text-gray-400 font-semibold text-sm">2</Text>
            </View>
            <View className="flex-1 h-0.5 bg-gray-200 mx-2" />
            <View className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center">
              <Text className="text-gray-400 font-semibold text-sm">3</Text>
            </View>
            <View className="flex-1 h-0.5 bg-gray-200 mx-2" />
            <View className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center">
              <Text className="text-gray-400 font-semibold text-sm">4</Text>
            </View>
          </View>

          <View className="flex-row mb-4">
            <Text className="text-xs text-gray-600 flex-1">Job Details</Text>
            <Text className="text-xs text-gray-400 flex-1 text-center">
              Candidate Support
            </Text>
            <Text className="text-xs text-gray-400 flex-1 text-center">Requirements</Text>
            <Text className="text-xs text-gray-400 flex-1 text-right">Review</Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <View className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <Text className="text-base font-semibold text-gray-900 mb-4">
            Hospital Information
          </Text>

          <Text className="text-sm text-gray-700 mb-2">
            Job Title <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            value={jobTitle}
            onChangeText={setJobTitle}
            placeholder="Enter Job Title"
            placeholderTextColor="#9ca3af"
            className="border border-gray-200 rounded-lg px-4 py-3 mb-4 text-gray-900"
          />

          <Text className="text-sm text-gray-700 mb-2">
            Job Description <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            value={jobDescription}
            onChangeText={setJobDescription}
            placeholder="Enter Job Description (min 50 characters)"
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className="border border-gray-200 rounded-lg px-4 py-3 mb-4 text-gray-900 h-24"
          />

          <Text className="text-sm text-gray-700 mb-2">
            Specialization <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            value={specialization}
            onChangeText={setSpecialization}
            placeholder="e.g. Cardiology, Nursing, ICU"
            placeholderTextColor="#9ca3af"
            className="border border-gray-200 rounded-lg px-4 py-3 mb-4 text-gray-900"
          />

          <Text className="text-base font-semibold text-gray-900 mb-4 mt-2">
            Job Location
          </Text>

          <StateCitySelector
            state={state}
            city={city}
            onStateChange={(newState) => {
              setState(newState);
              setCity(''); // Clear city when state changes
            }}
            onCityChange={setCity}
          />

          <View className="flex-row gap-3 mb-4 mt-3">
            <View className="flex-1">
              <Text className="text-sm text-gray-700 mb-2">Pincode</Text>
              <TextInput
                value={pincode}
                onChangeText={setPincode}
                placeholder="Pincode"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                className="border border-gray-200 rounded-lg px-4 py-3 text-gray-900"
              />
            </View>
          </View>

          <Text className="text-sm text-gray-700 mb-2">Work Schedule</Text>
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <TouchableOpacity
                onPress={() => showPicker('date', 'start')}
                className="border border-gray-200 rounded-lg px-4 py-3 flex-row justify-between items-center"
              >
                <Text className="text-gray-900">{formatDate(startDate)}</Text>
                <Ionicons name="calendar-outline" size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View className="flex-1">
              <TouchableOpacity
                onPress={() => showPicker('date', 'end')}
                className="border border-gray-200 rounded-lg px-4 py-3 flex-row justify-between items-center"
              >
                <Text className="text-gray-900">{formatDate(endDate)}</Text>
                <Ionicons name="calendar-outline" size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>
          </View>

          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <TouchableOpacity
                onPress={() => showPicker('time', 'shiftStart')}
                className="border border-gray-200 rounded-lg px-4 py-3 flex-row justify-between items-center"
              >
                <Text className="text-gray-900">{formatTime(shiftStartTime)}</Text>
                <Ionicons name="time-outline" size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View className="flex-1">
              <TouchableOpacity
                onPress={() => showPicker('time', 'shiftEnd')}
                className="border border-gray-200 rounded-lg px-4 py-3 flex-row justify-between items-center"
              >
                <Text className="text-gray-900">{formatTime(shiftEndTime)}</Text>
                <Ionicons name="time-outline" size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>
          </View>

          <Text className="text-sm text-gray-700 mb-2">Job Type</Text>
          <Dropdown
            style={[styles.dropdown, isFocusJobType && { borderColor: 'blue' }]}
            placeholderStyle={styles.placeholderStyle}
            selectedTextStyle={styles.selectedTextStyle}
            inputSearchStyle={styles.inputSearchStyle}
            iconStyle={styles.iconStyle}
            data={jobTypeData}
            search={false}
            maxHeight={300}
            labelField="label"
            valueField="value"
            placeholder={!isFocusJobType ? 'Select job type' : '...'}
            value={jobType}
            onFocus={() => setIsFocusJobType(true)}
            onBlur={() => setIsFocusJobType(false)}
            onChange={item => {
              setJobType(item.value);
              setIsFocusJobType(false);
            }}
          />

          <Text className="text-sm text-gray-700 mb-2">
            Salary Type <Text className="text-red-500">*</Text>
          </Text>
          <Dropdown
            style={[styles.dropdown, isFocusSalaryType && { borderColor: 'blue' }]}
            placeholderStyle={styles.placeholderStyle}
            selectedTextStyle={styles.selectedTextStyle}
            inputSearchStyle={styles.inputSearchStyle}
            iconStyle={styles.iconStyle}
            data={[
              { label: 'Per Month', value: 'monthly' },
              { label: 'Per Day', value: 'daily' },
              { label: 'Per Hour', value: 'hourly' },
              { label: 'Per Patient', value: 'per_patient' },
            ]}
            search={false}
            maxHeight={300}
            labelField="label"
            valueField="value"
            placeholder={!isFocusSalaryType ? 'Select salary type' : '...'}
            value={salaryType}
            onFocus={() => setIsFocusSalaryType(true)}
            onBlur={() => setIsFocusSalaryType(false)}
            onChange={item => {
              setSalaryType(item.value);
              setIsFocusSalaryType(false);
            }}
          />

          <Text className="text-sm text-gray-700 mb-2">
            Salary <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            value={salary}
            onChangeText={setSalary}
            placeholder="Enter Salary"
            placeholderTextColor="#9ca3af"
            keyboardType="numeric"
            className="border border-gray-200 rounded-lg px-4 py-3 mb-4 text-gray-900"
          />
        </View>

        <TouchableOpacity
          onPress={handleNext}
          className="bg-brand-primary rounded-xl py-4 mb-8"
          activeOpacity={0.8}
        >
          <Text className="text-white text-center font-semibold text-base">Next</Text>
        </TouchableOpacity>

      </ScrollView>

      {showDatePicker && (
        <>
          {Platform.OS === 'ios' && (
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingVertical: 6 }}>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={{ paddingVertical: 6, paddingHorizontal: 12 }}>
                <Text style={{ color: '#130160', fontWeight: '600', fontSize: 15 }}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
          <RNDateTimePicker
            value={
              activeDateField === 'start' ? startDate :
              activeDateField === 'end' ? endDate :
              activeDateField === 'shiftStart' ? shiftStartTime :
              shiftEndTime
            }
            mode={datePickerMode}
            is24Hour={false}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    height: 50,
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  placeholderStyle: {
    fontSize: 14,
    color: '#9ca3af',
  },
  selectedTextStyle: {
    fontSize: 14,
    color: '#111827',
  },
  iconStyle: {
    width: 20,
    height: 20,
  },
  inputSearchStyle: {
    height: 40,
    fontSize: 14,
  },
});
