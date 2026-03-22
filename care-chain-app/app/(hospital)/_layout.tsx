import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar, Alert } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/Colors';
import { setSocketEventHandlers, setGlobalSocketEventHandlers, AttendanceNotification, joinAttendanceRoom } from '../../services/socket';

export default function HospitalLayout() {
  const router = useRouter();
  const { isLoading, isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !user) {
      router.replace('/(auth)/login');
      return;
    }

    if (user.role === 'doctor') {
      router.replace('/(doctor)/(tabs)/home');
      return;
    }

    if (user.role === 'pending') {
      router.replace({
        pathname: '/(auth)/role',
        params: { email: user.email, fullName: user.fullName },
      });
      return;
    }

    // Join attendance room and listen for notifications
    joinAttendanceRoom();

    setGlobalSocketEventHandlers({
      onAttendanceCheckInRequest: (data: AttendanceNotification) => {
        Alert.alert(
          'Check-in Request',
          data.message,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'View',
              onPress: () => router.push({
                pathname: '/(hospital)/(tabs)/markEmployeeAttendance',
                params: { id: data.assignmentId }
              })
            }
          ]
        );
      },
      onAttendanceCheckOutRequest: (data: AttendanceNotification) => {
        Alert.alert(
          'Check-out Request',
          data.message,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'View',
              onPress: () => router.push({
                pathname: '/(hospital)/(tabs)/markEmployeeAttendance',
                params: { id: data.assignmentId }
              })
            }
          ]
        );
      }
    });

  }, [isLoading, isAuthenticated, user, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.brand.secondary} />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="candidateDetails/[id]" />
    </Stack>
  );
}