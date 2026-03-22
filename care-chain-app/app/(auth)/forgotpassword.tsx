// app/(auth)/forgotpassword.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';

export default function ForgotPasswordScreen() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    setIsLoading(true);
    try {
      const result = await forgotPassword(email.trim());

      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to send reset email');
        return;
      }

      // Navigate to OTP screen
      router.push({
        pathname: '/(auth)/emailotp',
        params: { email: email.trim(), mode: 'reset' },
      });
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.replace('/(auth)/login');
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
              Forgot Password
            </Text>
            <Text className="text-white text-center text-base opacity-90 leading-6 px-4">
              Don't worry! Enter your email and we'll{'\n'}
              help you reset your password.
            </Text>
          </View>
        </View>

        {/* FORM */}
        <View className="-mt-12 flex-1 bg-white rounded-t-3xl px-6 pt-8">
          {/* EMAIL */}
          <View className="mb-6">
            <Text className="text-gray-700 text-sm font-medium mb-2">
              Email
            </Text>
            <TextInput
              className="bg-gray-100 rounded-xl px-4 py-4 text-gray-700"
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
            />
          </View>

          {/* FORGOT PASSWORD BUTTON */}
          <TouchableOpacity
            className={`rounded-xl py-4 mb-6 ${isLoading ? 'bg-gray-400' : 'bg-[#1A1464]'}`}
            onPress={handleForgotPassword}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white text-center text-base font-semibold">
                SEND RESET CODE
              </Text>
            )}
          </TouchableOpacity>

          {/* BACK TO LOGIN */}
          <View className="flex-row justify-center mb-8">
            <TouchableOpacity onPress={handleBackToLogin} disabled={isLoading}>
              <Text className="text-gray-900 text-sm font-semibold underline">
                Back to Login
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
