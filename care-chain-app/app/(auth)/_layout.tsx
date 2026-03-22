import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function AuthLayout() {
  const router = useRouter();
  const { isLoading, isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user) return;

    if (user.role === 'hospital') {
      router.replace('/(hospital)/(tabs)/home');
    } else if (user.role === 'doctor') {
      router.replace('/(doctor)/(tabs)/home');
    }
  }, [isLoading, isAuthenticated, user, router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
