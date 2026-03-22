import { Stack, router } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

export default function DoctorLayout() {
  const { isLoading, isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !user) {
      try {
        router.replace('/(auth)/login');
      } catch (e) {
        console.warn('Navigation not ready for login redirect');
      }
      return;
    }

    if (user.role === 'hospital') {
      try {
        router.replace('/(hospital)/(tabs)/home');
      } catch (e) {
        console.warn('Navigation not ready for hospital redirect');
      }
      return;
    }

    if (user.role === 'pending') {
      try {
        router.replace({
          pathname: '/(auth)/role',
          params: { email: user.email, fullName: user.fullName },
        });
      } catch (e) {
        console.warn('Navigation not ready for role redirect');
      }
    }
  }, [isLoading, isAuthenticated, user]);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1e3a8a" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="editProfile" />
        <Stack.Screen name="careerPreferences" />
      </Stack>
    </>
  );
}