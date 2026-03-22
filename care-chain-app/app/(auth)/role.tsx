// app/(auth)/chooserole.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';

export default function ChooseRoleScreen() {
  const params = useLocalSearchParams<{ email: string; fullName?: string }>();
  const { selectRole, user } = useAuth();
  const [role, setRole] = useState<'doctor' | 'hospital' | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    if (!role) return;

    if (!params.email) {
      Alert.alert('Error', 'Session expired. Please login again.');
      router.replace('/(auth)/login');
      return;
    }

    setIsLoading(true);
    try {
      const result = await selectRole(params.email, role);

      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to select role');
        return;
      }

      // Navigate based on role
      if (role === 'doctor') {
        router.replace('/(doctor)/(tabs)/home');
      } else if (role === 'hospital') {
        router.replace('/(hospital)/(tabs)/home');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.brand.secondary} />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {/* TOP IMAGE */}
        <View style={{ width: '100%', height: 300 }}>
          <Image
            source={require('../assets/images/top-bg_.png')}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />

          {/* TEXT ON IMAGE */}
          <View className="absolute top-24 left-6 right-6 items-center justify-center">
            <Text className="text-white text-4xl font-bold mb-3 text-center">
              Choose Your Role
            </Text>
            <Text className="text-white text-center text-base opacity-90 leading-6 px-4">
              Select how you want to join CareChain.{'\n'}
              This helps us personalize your experience.
            </Text>
          </View>
        </View>

        {/* FORM CARD */}
        <View className="-mt-12 flex-1 bg-white rounded-t-3xl px-6 pt-8">
          {/* DOCTOR */}
          <TouchableOpacity
            className={`rounded-2xl p-4 mb-5 border-2 ${role === 'doctor'
              ? 'border-brand-primary bg-blue-50'
              : 'border-gray-200'
              }`}
            onPress={() => setRole('doctor')}
          >
            <View className="flex-row items-center">
              <Image
                source={require('../assets/images/logo.png')} // any image
                className="w-16 h-16 mr-4"
                resizeMode="contain"
              />
              <View>
                <Text className="text-lg font-semibold text-gray-900">
                  Doctor
                </Text>
                <Text className="text-sm text-gray-500 mt-1">
                  Individual medical professional
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* HOSPITAL */}
          <TouchableOpacity
            className={`rounded-2xl p-4 mb-8 border-2 ${role === 'hospital'
              ? 'border-brand-primary bg-blue-50'
              : 'border-gray-200'
              }`}
            onPress={() => setRole('hospital')}
          >
            <View className="flex-row items-center">
              <Image
                source={require('../assets/images/logo.png')} // any image
                className="w-16 h-16 mr-4"
                resizeMode="contain"
              />
              <View>
                <Text className="text-lg font-semibold text-gray-900">
                  Hospital
                </Text>
                <Text className="text-sm text-gray-500 mt-1">
                  Healthcare organization or clinic
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* CONTINUE BUTTON */}
          <TouchableOpacity
            className={`rounded-xl py-4 ${role && !isLoading ? 'bg-brand-primary' : 'bg-gray-300'
              }`}
            onPress={handleContinue}
            disabled={!role || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white text-center text-base font-semibold">
                CONTINUE
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
