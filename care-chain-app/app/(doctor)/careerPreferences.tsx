import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  StatusBar,
  Image,
  Switch,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import RNDateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

type Step = 1 | 2 | 3 | 4 | 'success';

export default function CareerPreferencesScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>(1);

  // Step 1 - Preferences
  const [shortTermJobs, setShortTermJobs] = useState<'yes' | 'no' | null>(null);
  const [longTermJobs, setLongTermJobs] = useState<'yes' | 'no' | null>(null);
  const [perPatient, setPerPatient] = useState(false);
  const [perHour, setPerHour] = useState(true);
  const [perDay, setPerDay] = useState(false);
  const [meals, setMeals] = useState(false);
  const [hourlyRate, setHourlyRate] = useState('');
  const [perPatientRate, setPerPatientRate] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [monthlyRate, setMonthlyRate] = useState('');

  // Step 2 - Availability (pass the schedule state)
  const [weekSchedule, setWeekSchedule] = useState({
    monday: {
      enabled: true,
      expanded: true,
      timeSlots: [
        { start: new Date(2025, 0, 11, 9, 0), end: new Date(2025, 0, 11, 12, 0) },
        { start: new Date(2025, 0, 11, 12, 0), end: new Date(2025, 0, 11, 17, 0) }
      ]
    },
    tuesday: {
      enabled: true,
      expanded: false,
      timeSlots: [
        { start: new Date(2025, 0, 12, 9, 0), end: new Date(2025, 0, 12, 12, 0) }
      ]
    },
    wednesday: {
      enabled: true,
      expanded: false,
      timeSlots: [
        { start: new Date(2025, 0, 13, 9, 0), end: new Date(2025, 0, 13, 12, 0) }
      ]
    },
    thursday: {
      enabled: false,
      expanded: false,
      timeSlots: []
    },
    friday: {
      enabled: false,
      expanded: false,
      timeSlots: []
    },
    saturday: {
      enabled: false,
      expanded: false,
      timeSlots: []
    },
    sunday: {
      enabled: false,
      expanded: false,
      timeSlots: []
    }
  });

  // Step 3 - Location
  const [selectedDistance, setSelectedDistance] = useState('25 KM');
  const [customRadius, setCustomRadius] = useState(25);
  const [useCustomRadius, setUseCustomRadius] = useState(false);

  const renderContent = () => {
    if (currentStep === 'success') {
      return <SuccessScreen onExploreJobs={() => router.push('/allJobs')} onGoHome={() => router.push('/home')} />;
    }

    return (
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="bg-blue-900 px-4 pt-4 pb-6 rounded-b-3xl">
          <View className="flex-row items-center justify-between">
            <Pressable className="h-11 w-11 rounded-full bg-white/10 border border-white/20 items-center justify-center">
              <Image
                source={require('../assets/images/logo.png')}
                className="h-8 w-8 rounded-full"
                resizeMode="cover"
              />
            </Pressable>

            <View className="flex-row items-center gap-3">
              <Pressable className="h-11 w-11 rounded-full bg-white/10 border border-white/20 items-center justify-center">
                <Ionicons name="notifications-outline" size={20} color="#fff" />
                <View className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500" />
              </Pressable>

              <Pressable className="h-11 w-11 rounded-full bg-white/10 border border-white/20 items-center justify-center">
                <Ionicons name="settings-outline" size={20} color="#fff" />
              </Pressable>
            </View>
          </View>
        </View>

        <View className="px-4 py-5">
          {/* Title & Close */}
          <View className="flex-row items-start justify-between mb-4">
            <View className="flex-1">
              <Text className="text-gray-900 text-2xl font-semibold">Career Preferences</Text>
              <Text className="text-gray-500 text-sm mt-1">
                Help us find the right job opportunities based on your preferences.
              </Text>
            </View>
            <Pressable onPress={() => router.back()} className="ml-3">
              <Ionicons name="close" size={28} color="#111827" />
            </Pressable>
          </View>

          {/* Step Indicator */}
          <View className="flex-row items-center justify-between mb-6">
            <StepCircle number={1} label="Preferences" active={currentStep === 1} completed={currentStep > 1} />
            <StepDivider />
            <StepCircle number={2} label="Availability" active={currentStep === 2} completed={currentStep > 2} />
            <StepDivider />
            <StepCircle number={3} label="Location" active={currentStep === 3} completed={currentStep > 3} />
            <StepDivider />
            <StepCircle number={4} label="Review" active={currentStep === 4} completed={false} />
          </View>

          {/* Step Content */}
          {currentStep === 1 && (
            <Step1Preferences
              shortTermJobs={shortTermJobs}
              setShortTermJobs={setShortTermJobs}
              longTermJobs={longTermJobs}
              setLongTermJobs={setLongTermJobs}
              perPatient={perPatient}
              setPerPatient={setPerPatient}
              perHour={perHour}
              setPerHour={setPerHour}
              perDay={perDay}
              setPerDay={setPerDay}
              meals={meals}
              setMeals={setMeals}
              hourlyRate={hourlyRate}
              setHourlyRate={setHourlyRate}
              perPatientRate={perPatientRate}
              setPerPatientRate={setPerPatientRate}
              dailyRate={dailyRate}
              setDailyRate={setDailyRate}
              monthlyRate={monthlyRate}
              setMonthlyRate={setMonthlyRate}
              onNext={() => setCurrentStep(2)}
            />
          )}

          {currentStep === 2 && (
            <Step2Availability
              weekSchedule={weekSchedule}
              setWeekSchedule={setWeekSchedule}
              onNext={() => setCurrentStep(3)}
              onPrevious={() => setCurrentStep(1)}
            />
          )}

          {currentStep === 3 && (
            <Step3Location
              selectedDistance={selectedDistance}
              setSelectedDistance={setSelectedDistance}
              customRadius={customRadius}
              setCustomRadius={setCustomRadius}
              useCustomRadius={useCustomRadius}
              setUseCustomRadius={setUseCustomRadius}
              onNext={() => setCurrentStep(4)}
              onPrevious={() => setCurrentStep(2)}
            />
          )}

          {currentStep === 4 && (
            <Step4Review
              // Pass all the user's selections
              shortTermJobs={shortTermJobs}
              longTermJobs={longTermJobs}
              perPatient={perPatient}
              perHour={perHour}
              perDay={perDay}
              meals={meals}
              hourlyRate={hourlyRate}
              perPatientRate={perPatientRate}
              dailyRate={dailyRate}
              monthlyRate={monthlyRate}
              weekSchedule={weekSchedule}
              selectedDistance={selectedDistance}
              customRadius={customRadius}
              useCustomRadius={useCustomRadius}
              onConfirm={() => setCurrentStep('success')}
              onPrevious={() => setCurrentStep(3)}
            />
          )}
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#1e3a8a" />
      {renderContent()}
    </SafeAreaView>
  );
}

function Step1Preferences({
  shortTermJobs,
  setShortTermJobs,
  longTermJobs,
  setLongTermJobs,
  perPatient,
  setPerPatient,
  perHour,
  setPerHour,
  perDay,
  setPerDay,
  meals,
  setMeals,
  hourlyRate,
  setHourlyRate,
  perPatientRate,
  setPerPatientRate,
  dailyRate,
  setDailyRate,
  monthlyRate,
  setMonthlyRate,
  onNext,
}: any) {

  return (
    <View>
      {/* Short-Term Jobs */}
      <View className="rounded-2xl bg-white border border-gray-100 px-4 py-4 mb-4">
        <Text className="text-gray-900 font-semibold mb-2">Short-Term Jobs</Text>
        <Text className="text-gray-500 text-xs mb-3">
          Are you looking for locum tenens, per diem, or temporary assignments?
        </Text>

        <Pressable
          className={`rounded-xl border px-4 py-3 mb-2 flex-row items-center ${shortTermJobs === 'yes' ? 'border-blue-900 bg-blue-50' : 'border-gray-200 bg-white'
            }`}
          onPress={() => setShortTermJobs('yes')}
        >
          <View
            className={`h-5 w-5 rounded-full border-2 items-center justify-center ${shortTermJobs === 'yes' ? 'border-blue-900' : 'border-gray-300'
              }`}
          >
            {shortTermJobs === 'yes' && <View className="h-3 w-3 rounded-full bg-blue-900" />}
          </View>
          <Text className="ml-3 text-gray-900">Yes</Text>
        </Pressable>

        <Pressable
          className={`rounded-xl border px-4 py-3 flex-row items-center ${shortTermJobs === 'no' ? 'border-blue-900 bg-blue-50' : 'border-gray-200 bg-white'
            }`}
          onPress={() => setShortTermJobs('no')}
        >
          <View
            className={`h-5 w-5 rounded-full border-2 items-center justify-center ${shortTermJobs === 'no' ? 'border-blue-900' : 'border-gray-300'
              }`}
          >
            {shortTermJobs === 'no' && <View className="h-3 w-3 rounded-full bg-blue-900" />}
          </View>
          <Text className="ml-3 text-gray-900">No</Text>
        </Pressable>
      </View>

      {/* Long-Term Jobs */}
      <View className="rounded-2xl bg-white border border-gray-100 px-4 py-4 mb-4">
        <Text className="text-gray-900 font-semibold mb-2">Long-Term Jobs</Text>
        <Text className="text-gray-500 text-xs mb-3">
          Are you interested in permanent placements or extended contracts?
        </Text>

        <Pressable
          className={`rounded-xl border px-4 py-3 mb-2 flex-row items-center ${longTermJobs === 'yes' ? 'border-blue-900 bg-blue-50' : 'border-gray-200 bg-white'
            }`}
          onPress={() => setLongTermJobs('yes')}
        >
          <View
            className={`h-5 w-5 rounded-full border-2 items-center justify-center ${longTermJobs === 'yes' ? 'border-blue-900' : 'border-gray-300'
              }`}
          >
            {longTermJobs === 'yes' && <View className="h-3 w-3 rounded-full bg-blue-900" />}
          </View>
          <Text className="ml-3 text-gray-900">Yes</Text>
        </Pressable>

        <Pressable
          className={`rounded-xl border px-4 py-3 flex-row items-center ${longTermJobs === 'no' ? 'border-blue-900 bg-blue-50' : 'border-gray-200 bg-white'
            }`}
          onPress={() => setLongTermJobs('no')}
        >
          <View
            className={`h-5 w-5 rounded-full border-2 items-center justify-center ${longTermJobs === 'no' ? 'border-blue-900' : 'border-gray-300'
              }`}
          >
            {longTermJobs === 'no' && <View className="h-3 w-3 rounded-full bg-blue-900" />}
          </View>
          <Text className="ml-3 text-gray-900">No</Text>
        </Pressable>
      </View>

      {/* Preferred Payment Unit */}
      <View className="rounded-2xl bg-white border border-gray-100 px-4 py-4 mb-4">
        <Text className="text-gray-900 font-semibold mb-2">Preferred Payment Unit</Text>
        <Text className="text-gray-500 text-xs mb-4">
          Choose how you would like to define your payment rates.
        </Text>

        <View className="flex-row gap-3 mb-3">
          <PaymentCard
            icon="person"
            title="Per Patient"
            subtitle="Paid for each patient you attend."
            active={perPatient}
            onToggle={() => setPerPatient(!perPatient)}
          />
          <PaymentCard
            icon="time"
            title="Per Hour"
            subtitle="Paid based on hours worked."
            active={perHour}
            onToggle={() => setPerHour(!perHour)}
          />
        </View>

        <View className="flex-row gap-3">
          <PaymentCard
            icon="calendar"
            title="Per Day"
            subtitle="Fixed payment for each working day"
            active={perDay}
            onToggle={() => setPerDay(!perDay)}
          />
          <PaymentCard
            icon="calendar-outline"
            title="Per Month"
            subtitle="Monthly salary-based payment."
            active={meals}
            onToggle={() => setMeals(!meals)}
          />
        </View>
      </View>

      {/* Dynamic Rate Input Fields */}
      {perPatient && (
        <View className="rounded-2xl bg-white border border-gray-100 px-4 py-4 mb-4">
          <View className="flex-row items-center mb-3">
            <Ionicons name="information-circle-outline" size={20} color="#1e3a8a" />
            <Text className="ml-2 text-gray-900 font-semibold">Preferred per patient rate</Text>
          </View>
          <Text className="text-gray-500 text-xs mb-3">
            Enter the per patient amount you expect to be paid.
          </Text>

          <View className="flex-row items-center rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
            <Ionicons name="cash-outline" size={20} color="#6b7280" />
            <TextInput
              placeholder="Enter your preferred per patient rate"
              value={perPatientRate}
              onChangeText={setPerPatientRate}
              keyboardType="numeric"
              className="flex-1 ml-3 text-gray-900"
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>
      )}

      {perHour && (
        <View className="rounded-2xl bg-white border border-gray-100 px-4 py-4 mb-4">
          <View className="flex-row items-center mb-3">
            <Ionicons name="information-circle-outline" size={20} color="#1e3a8a" />
            <Text className="ml-2 text-gray-900 font-semibold">Preferred hourly rate</Text>
          </View>
          <Text className="text-gray-500 text-xs mb-3">
            Enter the hourly amount you expect to be paid.
          </Text>

          <View className="flex-row items-center rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
            <Ionicons name="cash-outline" size={20} color="#6b7280" />
            <TextInput
              placeholder="Enter your preferred hourly rate"
              value={hourlyRate}
              onChangeText={setHourlyRate}
              keyboardType="numeric"
              className="flex-1 ml-3 text-gray-900"
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>
      )}

      {perDay && (
        <View className="rounded-2xl bg-white border border-gray-100 px-4 py-4 mb-4">
          <View className="flex-row items-center mb-3">
            <Ionicons name="information-circle-outline" size={20} color="#1e3a8a" />
            <Text className="ml-2 text-gray-900 font-semibold">Preferred daily rate</Text>
          </View>
          <Text className="text-gray-500 text-xs mb-3">
            Enter the daily amount you expect to be paid.
          </Text>

          <View className="flex-row items-center rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
            <Ionicons name="cash-outline" size={20} color="#6b7280" />
            <TextInput
              placeholder="Enter your preferred daily rate"
              value={dailyRate}
              onChangeText={setDailyRate}
              keyboardType="numeric"
              className="flex-1 ml-3 text-gray-900"
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>
      )}

      {meals && (
        <View className="rounded-2xl bg-white border border-gray-100 px-4 py-4 mb-4">
          <View className="flex-row items-center mb-3">
            <Ionicons name="information-circle-outline" size={20} color="#1e3a8a" />
            <Text className="ml-2 text-gray-900 font-semibold">Preferred monthly rate</Text>
          </View>
          <Text className="text-gray-500 text-xs mb-3">
            Enter the monthly amount you expect to be paid.
          </Text>

          <View className="flex-row items-center rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
            <Ionicons name="cash-outline" size={20} color="#6b7280" />
            <TextInput
              placeholder="Enter your preferred monthly rate"
              value={monthlyRate}
              onChangeText={setMonthlyRate}
              keyboardType="numeric"
              className="flex-1 ml-3 text-gray-900"
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>
      )}

      {/* Helpful Tips */}
      <View className="rounded-2xl bg-blue-50 border border-blue-100 px-4 py-4 mb-6">
        <View className="flex-row items-center mb-2">
          <Ionicons name="bulb" size={18} color="#1e3a8a" />
          <Text className="ml-2 text-gray-900 font-semibold">Helpful Tips</Text>
        </View>
        <Text className="text-gray-600 text-xs leading-5">
          • Selecting more options helps us match you with more jobs.{'\n'}
          • Choosing both short- and long-term roles boosts your visibility.{'\n'}
          • Payment preferences help employers contact you faster.{'\n'}
          • You can update these preferences anytime.
        </Text>
      </View>

      <Pressable
        className="rounded-xl bg-blue-900 py-4 items-center"
        onPress={onNext}
      >
        <Text className="text-white font-semibold text-base">Next</Text>
      </Pressable>
    </View>
  );
}

function Step2Availability({ weekSchedule, setWeekSchedule, onNext, onPrevious }: any) {
  // State for Time Picker
  const [showPicker, setShowPicker] = useState(false);
  const [activeTimerInfo, setActiveTimerInfo] = useState<{ 
    day: string; 
    slotIndex: number; 
    type: 'start' | 'end' 
  } | null>(null);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const handleTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowPicker(false);
    if (selectedDate && activeTimerInfo) {
      const { day, slotIndex, type } = activeTimerInfo;
      setWeekSchedule(prev => ({
        ...prev,
        [day]: {
          ...prev[day],
          timeSlots: prev[day].timeSlots.map((slot, index) => 
            index === slotIndex 
              ? { ...slot, [type]: selectedDate }
              : slot
          )
        }
      }));
    }
  };

  const openPicker = (day: string, slotIndex: number, type: 'start' | 'end') => {
    setActiveTimerInfo({ day, slotIndex, type });
    setShowPicker(true);
  };

  const addTimeSlot = (day: string) => {
    setWeekSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        timeSlots: [
          ...prev[day].timeSlots,
          { 
            start: new Date(2025, 0, 11, 9, 0), 
            end: new Date(2025, 0, 11, 17, 0) 
          }
        ]
      }
    }));
  };

  const removeTimeSlot = (day: string, slotIndex: number) => {
    setWeekSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        timeSlots: prev[day].timeSlots.filter((_, index) => index !== slotIndex)
      }
    }));
  };

  const toggleDay = (day: string) => {
    setWeekSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day].enabled,
        timeSlots: !prev[day].enabled ? [
          { start: new Date(2025, 0, 11, 9, 0), end: new Date(2025, 0, 11, 12, 0) }
        ] : prev[day].timeSlots
      }
    }));
  };

  const toggleExpanded = (day: string) => {
    setWeekSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        expanded: !prev[day].expanded
      }
    }));
  };

  const copyToTuesday = () => {
    setWeekSchedule(prev => ({
      ...prev,
      tuesday: {
        ...prev.tuesday,
        timeSlots: [...prev.monday.timeSlots.map(slot => ({
          start: new Date(slot.start.getTime() + 24 * 60 * 60 * 1000), // Add 1 day
          end: new Date(slot.end.getTime() + 24 * 60 * 60 * 1000)
        }))]
      }
    }));
  };

  const getDayLabel = (day: string) => {
    const labels = {
      monday: 'Monday (11.01.2025)',
      tuesday: 'Tuesday',
      wednesday: 'Wednesday',
      thursday: 'Thursday',
      friday: 'Friday',
      saturday: 'Saturday',
      sunday: 'Sunday'
    };
    return labels[day] || day;
  };

  const getTimeRangeText = (timeSlots: any[]) => {
    if (timeSlots.length === 0) return 'No time set';
    if (timeSlots.length === 1) {
      return `${formatTime(timeSlots[0].start)} TO ${formatTime(timeSlots[0].end)}`;
    }
    return `${timeSlots.length} time slots`;
  };

  return (
    <View>
      <View className="rounded-2xl bg-white border border-gray-100 px-4 py-4 mb-4">
        <Text className="text-gray-900 font-semibold mb-2">Availability & Schedule</Text>
        <Text className="text-gray-500 text-xs mb-4">
          Set the days, dates, and time slots you're available to work.
        </Text>

        {/* Monday - Always expanded initially */}
        <View className="mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-gray-900 font-semibold">{getDayLabel('monday')}</Text>
            <Ionicons name="calendar-outline" size={20} color="#6b7280" />
          </View>

          {weekSchedule.monday.timeSlots.map((slot, index) => (
            <View key={index} className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 mb-2">
              <View className="flex-row items-center justify-between">
                <Pressable onPress={() => openPicker('monday', index, 'start')}>
                  <Text className="text-gray-900">{formatTime(slot.start)}</Text>
                </Pressable>

                <Text className="text-gray-500">TO</Text>

                <Pressable onPress={() => openPicker('monday', index, 'end')}>
                  <Text className="text-gray-900">{formatTime(slot.end)}</Text>
                </Pressable>

                <Pressable onPress={() => removeTimeSlot('monday', index)}>
                  <Ionicons name="remove-circle-outline" size={20} color="#ef4444" />
                </Pressable>
              </View>
            </View>
          ))}

          <Pressable 
            className="items-center py-2 mb-2"
            onPress={() => addTimeSlot('monday')}
          >
            <Text className="text-blue-900 font-semibold">+ Add Time Slot</Text>
          </Pressable>

          <Pressable 
            className="flex-row items-center justify-end py-2"
            onPress={copyToTuesday}
          >
            <Ionicons name="copy-outline" size={16} color="#1e3a8a" />
            <Text className="ml-2 text-blue-900 text-sm">Copy to Tuesday</Text>
          </Pressable>
        </View>

        {/* Other Days */}
        {Object.entries(weekSchedule).filter(([day]) => day !== 'monday').map(([day, schedule]) => (
          <View key={day} className="mb-3">
            <Pressable
              className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 flex-row items-center justify-between"
              onPress={() => schedule.enabled && toggleExpanded(day)}
            >
              <View className="flex-1">
                <View className="flex-row items-center mb-1">
                  <Text className="text-gray-600 text-xs font-medium mr-2">
                    {day.substring(0, 2).toUpperCase()}
                  </Text>
                  <Text className="text-gray-900 font-semibold">{getDayLabel(day)}</Text>
                </View>
                <Text className="text-gray-500 text-xs">
                  {schedule.enabled ? getTimeRangeText(schedule.timeSlots) : 'Not available'}
                </Text>
              </View>
              
              <View className="flex-row items-center gap-3">
                <Switch
                  value={schedule.enabled}
                  onValueChange={() => toggleDay(day)}
                  trackColor={{ false: '#d1d5db', true: '#1e3a8a' }}
                  thumbColor="#fff"
                />
                {schedule.enabled && (
                  <Pressable onPress={() => toggleExpanded(day)}>
                    <Ionicons 
                      name={schedule.expanded ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color="#6b7280" 
                    />
                  </Pressable>
                )}
              </View>
            </Pressable>

            {/* Expanded Time Slots */}
            {schedule.enabled && schedule.expanded && (
              <View className="mt-2 ml-4">
                {schedule.timeSlots.map((slot, index) => (
                  <View key={index} className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 mb-2">
                    <View className="flex-row items-center justify-between">
                      <Pressable onPress={() => openPicker(day, index, 'start')}>
                        <Text className="text-gray-900">{formatTime(slot.start)}</Text>
                      </Pressable>

                      <Text className="text-gray-500">TO</Text>

                      <Pressable onPress={() => openPicker(day, index, 'end')}>
                        <Text className="text-gray-900">{formatTime(slot.end)}</Text>
                      </Pressable>

                      <Pressable onPress={() => removeTimeSlot(day, index)}>
                        <Ionicons name="remove-circle-outline" size={20} color="#ef4444" />
                      </Pressable>
                    </View>
                  </View>
                ))}

                <Pressable 
                  className="items-center py-2"
                  onPress={() => addTimeSlot(day)}
                >
                  <Text className="text-blue-900 font-semibold">+ Add Time Slot</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))}
      </View>

      {showPicker && (
        <RNDateTimePicker
          value={activeTimerInfo ? 
            weekSchedule[activeTimerInfo.day].timeSlots[activeTimerInfo.slotIndex][activeTimerInfo.type] : 
            new Date()
          }
          mode="time"
          is24Hour={false}
          display="default"
          onChange={handleTimeChange}
        />
      )}

      <View className="flex-row gap-3">
        <Pressable
          className="flex-1 rounded-xl border border-gray-200 py-4 items-center"
          onPress={onPrevious}
        >
          <Text className="text-gray-900 font-semibold">Previous</Text>
        </Pressable>
        <Pressable
          className="flex-1 rounded-xl bg-blue-900 py-4 items-center"
          onPress={onNext}
        >
          <Text className="text-white font-semibold">Next</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Step3Location({ 
  selectedDistance, 
  setSelectedDistance, 
  customRadius, 
  setCustomRadius, 
  useCustomRadius, 
  setUseCustomRadius, 
  onNext, 
  onPrevious 
}: any) {
  const distanceOptions = ['5 KM', '10 KM', '15 KM', '25 KM'];

  // Simple slider component
  const CustomSlider = () => {
    const minValue = 5;
    const maxValue = 40;
    const range = maxValue - minValue;
    
    const handleSliderTouch = (event: any) => {
      if (!useCustomRadius) return;
      
      const { locationX } = event.nativeEvent;
      // Use a more conservative width estimate
      const containerPadding = 32; // 16px padding on each side
      const sliderWidth = 280; // Approximate available width
      
      const percentage = Math.max(0, Math.min(1, locationX / sliderWidth));
      const newValue = Math.round(minValue + (percentage * range));
      setCustomRadius(newValue);
    };

    const thumbPosition = ((customRadius - minValue) / range) * 100;

    return (
      <View className="relative mb-4">
        <TouchableWithoutFeedback onPress={handleSliderTouch}>
          <View className="px-3 py-2">
            <View className={`h-2 rounded-full ${useCustomRadius ? 'bg-gray-200' : 'bg-gray-100'}`}>
              <View 
                className={`h-2 rounded-full ${useCustomRadius ? 'bg-blue-900' : 'bg-gray-300'}`}
                style={{ width: `${thumbPosition}%` }}
              />
            </View>
            <View
              className={`absolute h-6 w-6 rounded-full top-[-2px] border-2 border-white shadow-md ${
                useCustomRadius ? 'bg-blue-900' : 'bg-gray-400'
              }`}
              style={{ 
                left: `${thumbPosition}%`,
                marginLeft: -12,
                marginTop: -2
              }}
            />
          </View>
        </TouchableWithoutFeedback>
      </View>
    );
  };

  const handleDistanceSelect = (distance: string) => {
    if (useCustomRadius) return; // Don't allow interaction if custom radius is enabled
    setSelectedDistance(distance);
  };

  const toggleCustomRadius = () => {
    setUseCustomRadius(!useCustomRadius);
    if (!useCustomRadius) {
      // When enabling custom radius, clear distance selection
      setSelectedDistance('');
    } else {
      // When disabling custom radius, set default distance
      setSelectedDistance('25 KM');
    }
  };

  return (
    <View>
      <View className="rounded-2xl bg-white border border-gray-100 px-4 py-4 mb-4">
        <Text className="text-gray-900 font-semibold mb-2">Preferred Job Location Radius</Text>
        <Text className="text-gray-500 text-xs mb-4">
          Choose how far you're willing to travel for work.
        </Text>

        {/* Maximum Travel Distance */}
        <Text className={`font-semibold mb-3 ${useCustomRadius ? 'text-gray-400' : 'text-gray-900'}`}>
          Maximum Travel Distance
        </Text>
        <View className="flex-row gap-2 mb-6">
          {distanceOptions.map((distance) => (
            <Pressable
              key={distance}
              className={`flex-1 rounded-xl px-3 py-2 items-center ${
                !useCustomRadius && selectedDistance === distance 
                  ? 'bg-blue-900' 
                  : useCustomRadius 
                    ? 'bg-gray-50' 
                    : 'bg-gray-100'
              }`}
              onPress={() => handleDistanceSelect(distance)}
              disabled={useCustomRadius}
            >
              <Text
                className={`text-xs font-semibold ${
                  !useCustomRadius && selectedDistance === distance 
                    ? 'text-white' 
                    : useCustomRadius 
                      ? 'text-gray-300' 
                      : 'text-gray-600'
                }`}
              >
                {distance}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Custom Radius Slider with Toggle */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className={`font-semibold ${useCustomRadius ? 'text-gray-900' : 'text-gray-400'}`}>
            Custom Radius
          </Text>
          <Switch
            value={useCustomRadius}
            onValueChange={toggleCustomRadius}
            trackColor={{ false: '#d1d5db', true: '#1e3a8a' }}
            thumbColor="#fff"
          />
        </View>
        
        <View className="flex-row items-center justify-between mb-2">
          <Text className={`text-xs ${useCustomRadius ? 'text-gray-500' : 'text-gray-300'}`}>
            Min: 5KM
          </Text>
          <Text className={`text-xs ${useCustomRadius ? 'text-gray-500' : 'text-gray-300'}`}>
            Max: 40KM
          </Text>
        </View>
        
        <CustomSlider />

        {/* Current Value Display */}
        <View className="items-center mb-4">
          <Text className={`text-sm ${useCustomRadius ? 'text-gray-700' : 'text-gray-400'}`}>
            Current radius: {customRadius}KM
          </Text>
        </View>
      </View>

      {/* Helpful Tips */}
      <View className="rounded-2xl bg-blue-50 border border-blue-100 px-4 py-4 mb-6">
        <View className="flex-row items-center mb-2">
          <Ionicons name="bulb" size={18} color="#1e3a8a" />
          <Text className="ml-2 text-gray-900 font-semibold">Helpful Tips</Text>
        </View>
        <Text className="text-gray-600 text-xs leading-5">
          • Choosing a wider radius shows more nearby jobs.{'\n'}
          • Hospitals prefer candidates open to flexible travel.{'\n'}
          • You can change your location radius anytime.{'\n'}
          • Your exact address is never shared with employers.
        </Text>
      </View>

      <View className="flex-row gap-3">
        <Pressable
          className="flex-1 rounded-xl border border-gray-200 py-4 items-center"
          onPress={onPrevious}
        >
          <Text className="text-gray-900 font-semibold">Previous</Text>
        </Pressable>
        <Pressable
          className="flex-1 rounded-xl bg-blue-900 py-4 items-center"
          onPress={onNext}
        >
          <Text className="text-white font-semibold">Next</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Step4Review({ 
  shortTermJobs,
  longTermJobs,
  perPatient,
  perHour,
  perDay,
  meals,
  hourlyRate,
  perPatientRate,
  dailyRate,
  monthlyRate,
  weekSchedule,
  selectedDistance,
  customRadius,
  useCustomRadius,
  onConfirm, 
  onPrevious 
}: any) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const getJobTypes = () => {
    const types = [];
    if (shortTermJobs === 'yes') types.push('Short-term');
    if (longTermJobs === 'yes') types.push('Long-term');
    return types.length > 0 ? types.join(', ') : 'Not specified';
  };

  const getPaymentMethods = () => {
    const methods = [];
    if (perPatient) methods.push('Per Patient');
    if (perHour) methods.push('Per Hour');
    if (perDay) methods.push('Per Day');
    if (meals) methods.push('Per Month');
    return methods.length > 0 ? methods.join(', ') : 'Not specified';
  };

  const getPaymentRates = () => {
    const rates = [];
    if (perPatient && perPatientRate) rates.push(`${perPatientRate}/patient`);
    if (perHour && hourlyRate) rates.push(`${hourlyRate}/hr`);
    if (perDay && dailyRate) rates.push(`${dailyRate}/day`);
    if (meals && monthlyRate) rates.push(`${monthlyRate}/month`);
    return rates.length > 0 ? rates.join(', ') : 'Not specified';
  };

  const getTravelDistance = () => {
    if (useCustomRadius) {
      return `${customRadius} KM (Custom)`;
    }
    return selectedDistance || 'Not specified';
  };

  const getDaySchedule = (day: string) => {
    const schedule = weekSchedule[day];
    if (!schedule.enabled) {
      return { status: 'Not available', color: 'text-red-600' };
    }
    
    if (schedule.timeSlots.length === 0) {
      return { status: 'Available (No times set)', color: 'text-yellow-600' };
    }
    
    if (schedule.timeSlots.length === 1) {
      const slot = schedule.timeSlots[0];
      return { 
        status: `${formatTime(slot.start)} – ${formatTime(slot.end)}`, 
        color: 'text-green-600' 
      };
    }
    
    return { 
      status: `${schedule.timeSlots.length} time slots`, 
      color: 'text-green-600' 
    };
  };

  return (
    <View>
      {/* Job Preferences */}
      <View className="rounded-2xl bg-white border border-gray-100 px-4 py-4 mb-4">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-gray-900 font-semibold">Job Preferences</Text>
          <Pressable onPress={() => onPrevious && onPrevious()}>
            <Text className="text-blue-900 text-xs font-semibold">✏️ Edit</Text>
          </Pressable>
        </View>

        <ReviewRow label="Job Type" value={getJobTypes()} />
        <ReviewRow label="Payment Method" value={getPaymentMethods()} />
        <ReviewRow label="Payment Rates" value={getPaymentRates()} />
      </View>

      {/* Availability & Schedule */}
      <View className="rounded-2xl bg-white border border-gray-100 px-4 py-4 mb-4">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-gray-900 font-semibold">Availability & Schedule</Text>
          <Pressable onPress={() => onPrevious && onPrevious()}>
            <Text className="text-blue-900 text-xs font-semibold">✏️ Edit</Text>
          </Pressable>
        </View>

        {Object.entries(weekSchedule).map(([day, _]) => {
          const daySchedule = getDaySchedule(day);
          const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
          
          return (
            <ReviewRow 
              key={day}
              label={dayLabel} 
              value={daySchedule.status} 
              valueColor={daySchedule.color}
            />
          );
        })}
      </View>

      {/* Preferred Job Location */}
      <View className="rounded-2xl bg-white border border-gray-100 px-4 py-4 mb-4">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-gray-900 font-semibold">Preferred Job Location</Text>
          <Pressable onPress={() => onPrevious && onPrevious()}>
            <Text className="text-blue-900 text-xs font-semibold">✏️ Edit</Text>
          </Pressable>
        </View>

        <ReviewRow label="Travel Distance" value={getTravelDistance()} />
      </View>

      {/* Helpful Tips */}
      <View className="rounded-2xl bg-blue-50 border border-blue-100 px-4 py-4 mb-6">
        <View className="flex-row items-center mb-2">
          <Ionicons name="bulb" size={18} color="#1e3a8a" />
          <Text className="ml-2 text-gray-900 font-semibold">Helpful Tips</Text>
        </View>
        <Text className="text-gray-600 text-xs leading-5">
          Reviewing your preferences carefully helps hospitals match you with the right opportunities faster.
        </Text>
      </View>

      <View className="flex-row gap-3">
        <Pressable
          className="flex-1 rounded-xl border border-gray-200 py-4 items-center"
          onPress={onPrevious}
        >
          <Text className="text-gray-900 font-semibold">Previous</Text>
        </Pressable>
        <Pressable
          className="flex-1 rounded-xl bg-blue-900 py-4 items-center"
          onPress={onConfirm}
        >
          <Text className="text-white font-semibold">Confirm & Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SuccessScreen({ onExploreJobs, onGoHome }: any) {
  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-blue-900 px-4 pt-4 pb-6 rounded-b-3xl">
        <View className="flex-row items-center justify-between">
          <Pressable className="h-11 w-11 rounded-full bg-white/10 border border-white/20 items-center justify-center">
            <Image
              source={require('../assets/images/logo.png')}
              className="h-8 w-8 rounded-full"
              resizeMode="cover"
            />
          </Pressable>

          <View className="flex-row items-center gap-3">
            <Pressable className="h-11 w-11 rounded-full bg-white/10 border border-white/20 items-center justify-center">
              <Ionicons name="notifications-outline" size={20} color="#fff" />
              <View className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500" />
            </Pressable>

            <Pressable className="h-11 w-11 rounded-full bg-white/10 border border-white/20 items-center justify-center">
              <Ionicons name="settings-outline" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 py-8">
          {/* Success Icon */}
          <View className="items-center mb-8">
            <View className="h-20 w-20 rounded-full bg-green-100 items-center justify-center mb-6">
              <View className="h-14 w-14 rounded-full bg-green-500 items-center justify-center">
                <Ionicons name="checkmark" size={28} color="#fff" />
              </View>
            </View>

            {/* Title and Description */}
            <Text className="text-gray-900 text-xl font-semibold mb-3 text-center">
              Preferences Saved Successfully
            </Text>
            <Text className="text-gray-500 text-sm text-center leading-6 px-4">
              Your career preferences have been updated and are now active on your profile.
            </Text>
          </View>

          {/* What This Means Section */}
          <View className="rounded-2xl bg-cyan-50 border border-cyan-100 p-5 mb-5">
            <View className="flex-row items-start">
              <View className="h-10 w-10 rounded-full bg-cyan-100 items-center justify-center mr-4 mt-1">
                <Ionicons name="information-circle" size={18} color="#0891b2" />
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 font-semibold text-base mb-3">What This Means</Text>
                <Text className="text-gray-600 text-sm leading-6 mb-4">
                  Your preferences are now used to match you with relevant job opportunities and improve recommendations. Hospitals can view your availability and location preferences when considering you for roles.
                </Text>
                <View className="flex-row items-center">
                  <View className="h-2 w-2 rounded-full bg-green-500 mr-2" />
                  <Text className="text-green-700 text-sm font-semibold">Status: Active Preference</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Ready to Get Started Section */}
          <View className="rounded-2xl bg-blue-50 border border-blue-100 p-5 mb-8">
            <View className="flex-row items-start">
              <View className="h-10 w-10 rounded-full bg-blue-100 items-center justify-center mr-4 mt-1">
                <Ionicons name="rocket" size={18} color="#1e3a8a" />
              </View>
              <View className="flex-1">
                <Text className="text-blue-900 font-semibold text-base mb-3">Ready to Get Started?</Text>
                <Text className="text-gray-600 text-sm leading-6">
                  You can start exploring jobs that match your preferences or wait for hospitals to reach out based on your availability and location settings.
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="px-2">
            <Pressable
              className="w-full rounded-xl bg-blue-900 py-4 items-center mb-5"
              onPress={onExploreJobs}
            >
              <Text className="text-white font-semibold text-base">Explore Jobs</Text>
            </Pressable>

            <Pressable onPress={onGoHome} className="items-center mb-6">
              <Text className="text-gray-600 text-base">Go to Home</Text>
            </Pressable>

            {/* Footer Text */}
            <Text className="text-gray-400 text-xs text-center leading-5 px-4">
              You can update your preferences anytime in your profile settings
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function StepCircle({
  number,
  label,
  active,
  completed,
}: {
  number: number;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <View className="items-center">
      <View
        className={`h-12 w-12 rounded-full items-center justify-center ${active ? 'bg-blue-900' : completed ? 'bg-green-500' : 'bg-gray-200'
          }`}
      >
        {completed ? (
          <Ionicons name="checkmark" size={20} color="#fff" />
        ) : (
          <Text className={`font-semibold ${active ? 'text-white' : 'text-gray-400'}`}>
            {number}
          </Text>
        )}
      </View>
      <Text className={`text-xs mt-2 ${active ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
        {label}
      </Text>
    </View>
  );
}

function StepDivider() {
  return <View className="flex-1 h-px bg-gray-200 mx-2 mt-6" />;
}

function PaymentCard({
  icon,
  title,
  subtitle,
  active,
  onToggle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <View className="flex-1 rounded-xl bg-gray-50 border border-gray-100 px-3 py-3">
      <View className="flex-row items-center justify-between mb-2">
        <Ionicons name={icon} size={18} color="#6b7280" />
        <Switch
          value={active}
          onValueChange={onToggle}
          trackColor={{ false: '#d1d5db', true: '#1e3a8a' }}
          thumbColor="#fff"
        />
      </View>
      <Text className="text-gray-900 font-semibold text-xs mb-1">{title}</Text>
      <Text className="text-gray-500 text-[10px] leading-4">{subtitle}</Text>
      <Text className="text-gray-400 text-[10px] mt-2">Yes/No</Text>
    </View>
  );
}

function DayToggle({
  label,
  time,
  enabled,
  onToggle,
}: {
  label: string;
  time: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <View className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 mb-3 flex-row items-center justify-between">
      <View className="flex-1">
        <Text className="text-gray-900 font-semibold">{label}</Text>
        <Text className="text-gray-500 text-xs mt-1">{time}</Text>
      </View>
      <View className="flex-row items-center gap-3">
        <Switch
          value={enabled}
          onValueChange={onToggle}
          trackColor={{ false: '#d1d5db', true: '#1e3a8a' }}
          thumbColor="#fff"
        />
        <Ionicons name="chevron-down" size={20} color="#6b7280" />
      </View>
    </View>
  );
}

function ReviewRow({
  label,
  value,
  valueColor = 'text-gray-900',
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View className="flex-row items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
      <Text className="text-gray-500 text-sm">{label}</Text>
      <Text className={`${valueColor} font-semibold text-sm`}>{value}</Text>
    </View>
  );
}
