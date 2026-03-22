import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: { date: string; time: string; message: string }) => void;
  candidateName: string;
  jobTitle: string;
  isSubmitting?: boolean;
};

const TIME_SLOTS = [
  '06:00 AM - 08:30 AM',
  '10:00 AM - 10:30 AM',
  '11:00 AM - 11:30 AM',
];

export default function ScheduleInterviewModal({
  visible,
  onClose,
  onSubmit,
  candidateName,
  jobTitle,
  isSubmitting = false,
}: Props) {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [message, setMessage] = useState('');
  const [showCustomTime, setShowCustomTime] = useState(false);

  const handleSubmit = () => {
    if (!selectedDate || !selectedTime) {
      return;
    }
    onSubmit({ date: selectedDate, time: selectedTime, message });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const markedDates = selectedDate
    ? {
        [selectedDate]: {
          selected: true,
          selectedColor: '#130160',
        },
      }
    : {};

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50">
        <View 
          style={{
            flex: 1,
            backgroundColor: '#FFFFFF',
            marginTop: 60,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          }}
        >
          {/* Header */}
          <View 
            style={{
              backgroundColor: '#130160',
              paddingTop: 20,
              paddingBottom: 20,
              paddingHorizontal: 20,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View className="flex-1">
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', fontFamily: 'DMSans-Bold' }}>
                Schedule Interview
              </Text>
              <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 12, marginTop: 4, fontFamily: 'DMSans-Regular' }}>
                Schedule an interview by selecting your preferred date and time
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 12,
              }}
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
            {/* Job Info Card */}
            <View 
              style={{
                margin: 20,
                backgroundColor: '#F0F9FF',
                borderRadius: 16,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View 
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: '#130160',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="briefcase" size={24} color="#FFFFFF" />
              </View>
              <View className="flex-1 ml-3">
                <Text style={{ color: '#111827', fontWeight: 'bold', fontSize: 15, fontFamily: 'DMSans-Bold' }}>
                  {jobTitle}
                </Text>
                <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2, fontFamily: 'DMSans-Regular' }}>
                  {candidateName}
                </Text>
              </View>
            </View>

            {/* Upcoming Schedule */}
            {selectedDate && selectedTime && (
              <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
                <Text style={{ color: '#111827', fontWeight: 'bold', fontSize: 14, marginBottom: 12, fontFamily: 'DMSans-Bold' }}>
                  Upcoming Schedule
                </Text>
                <View 
                  style={{
                    backgroundColor: '#F9FAFB',
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <Text style={{ color: '#6B7280', fontSize: 12, fontFamily: 'DMSans-Regular' }}>
                    Date: {formatDate(selectedDate)}
                  </Text>
                  <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 4, fontFamily: 'DMSans-Regular' }}>
                    Time: {selectedTime}
                  </Text>
                </View>
              </View>
            )}

            {/* Choose a Date */}
            <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
              <Text style={{ color: '#111827', fontWeight: 'bold', fontSize: 16, marginBottom: 12, fontFamily: 'DMSans-Bold' }}>
                Choose a Date
              </Text>
              <Calendar
                onDayPress={(day) => setSelectedDate(day.dateString)}
                markedDates={markedDates}
                minDate={new Date().toISOString().split('T')[0]}
                theme={{
                  selectedDayBackgroundColor: '#130160',
                  selectedDayTextColor: '#FFFFFF',
                  todayTextColor: '#130160',
                  dayTextColor: '#111827',
                  textDisabledColor: '#D1D5DB',
                  monthTextColor: '#111827',
                  textMonthFontFamily: 'DMSans-Bold',
                  textDayFontFamily: 'DMSans-Regular',
                  textDayHeaderFontFamily: 'DMSans-SemiBold',
                  textMonthFontSize: 16,
                  textDayFontSize: 14,
                }}
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
              />
            </View>

            {/* Select a Time Slot */}
            <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
              <Text style={{ color: '#111827', fontWeight: 'bold', fontSize: 16, marginBottom: 12, fontFamily: 'DMSans-Bold' }}>
                Select a Time Slot
              </Text>
              {TIME_SLOTS.map((slot) => (
                <TouchableOpacity
                  key={slot}
                  onPress={() => {
                    setSelectedTime(slot);
                    setShowCustomTime(false);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: selectedTime === slot ? '#130160' : '#E5E7EB',
                    backgroundColor: selectedTime === slot ? '#F0F0FF' : '#FFFFFF',
                    marginBottom: 12,
                  }}
                >
                  <View 
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: selectedTime === slot ? '#130160' : '#D1D5DB',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    {selectedTime === slot && (
                      <View 
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: '#130160',
                        }}
                      />
                    )}
                  </View>
                  <Text style={{ 
                    color: selectedTime === slot ? '#130160' : '#6B7280',
                    fontSize: 14,
                    fontFamily: 'DMSans-Regular',
                  }}>
                    {slot}
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                onPress={() => setShowCustomTime(!showCustomTime)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                }}
              >
                <Ionicons name="time-outline" size={18} color="#130160" />
                <Text style={{ color: '#130160', fontSize: 14, marginLeft: 8, fontFamily: 'DMSans-SemiBold' }}>
                  Propose Custom Time
                </Text>
              </TouchableOpacity>
            </View>

            {/* Message (Optional) */}
            <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
              <Text style={{ color: '#111827', fontWeight: 'bold', fontSize: 16, marginBottom: 12, fontFamily: 'DMSans-Bold' }}>
                Message (Optional)
              </Text>
              <TextInput
                placeholder={`Dear ${candidateName}, I would like to request to schedule an interview and discuss a suitable date and time.`}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={{
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  borderRadius: 12,
                  padding: 12,
                  minHeight: 100,
                  fontFamily: 'DMSans-Regular',
                  fontSize: 14,
                  color: '#111827',
                }}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Helpful Tips */}
            <View 
              style={{
                marginHorizontal: 20,
                marginBottom: 20,
                backgroundColor: '#F0F9FF',
                borderRadius: 12,
                padding: 16,
              }}
            >
              <View className="flex-row items-start">
                <Ionicons name="bulb-outline" size={20} color="#130160" style={{ marginTop: 2 }} />
                <View className="flex-1 ml-3">
                  <Text style={{ color: '#111827', fontWeight: 'bold', fontSize: 14, marginBottom: 4, fontFamily: 'DMSans-Bold' }}>
                    Helpful Tips
                  </Text>
                  <Text style={{ color: '#6B7280', fontSize: 12, lineHeight: 18, fontFamily: 'DMSans-Regular' }}>
                    Scheduling sends a request to the employer for confirmation. You'll be notified once they respond.
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Bottom Buttons */}
          <View 
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: '#FFFFFF',
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderTopWidth: 1,
              borderTopColor: '#E5E7EB',
              flexDirection: 'row',
            }}
          >
            <TouchableOpacity
              onPress={onClose}
              style={{
                flex: 1,
                borderWidth: 2,
                borderColor: '#130160',
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
                marginRight: 8,
              }}
            >
              <Text style={{ color: '#130160', fontWeight: 'bold', fontSize: 15, fontFamily: 'DMSans-Bold' }}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!selectedDate || !selectedTime || isSubmitting}
              style={{
                flex: 1,
                backgroundColor: (!selectedDate || !selectedTime || isSubmitting) ? '#9CA3AF' : '#130160',
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
                marginLeft: 8,
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 15, fontFamily: 'DMSans-Bold' }}>
                  Schedule Interview
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
