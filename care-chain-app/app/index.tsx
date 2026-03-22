import { Image, Text, View } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import '../global.css';

export default function App() {
  const router = useRouter();
  const { isLoading, isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    const timer = setTimeout(() => {
      if (isAuthenticated && user) {
        if (user.role === 'hospital') {
          router.replace('/(hospital)/(tabs)/home');
          return;
        }
        if (user.role === 'doctor') {
          router.replace('/(doctor)/(tabs)/home');
          return;
        }
        // Role still pending
        router.replace('/(auth)/role');
        return;
      }

      router.replace('/(auth)/onboarding');
    }, 400);

    return () => clearTimeout(timer);
  }, [isLoading, isAuthenticated, user, router]);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Image
        className="w-48 h-24 mb-4"
        source={require('../assets/images/icon.png')}
        resizeMode="contain"
      />
      <Text className="text-blue-500 text-2xl font-bold">Care Chain</Text>
    </View>
  );
}