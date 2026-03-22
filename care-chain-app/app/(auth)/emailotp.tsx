// app/(auth)/emailotp.tsx
import React, { useState, useRef, useEffect } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';

export default function EmailOTPScreen() {
  const params = useLocalSearchParams<{
    email: string;
    mode: 'verification' | 'reset';
    fullName?: string;
  }>();

  const { verifyEmail, resendOTP, resetPassword } = useAuth();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordField, setShowPasswordField] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleOtpChange = (text: string, index: number) => {
    // Only allow numbers
    const cleanedText = text.replace(/[^0-9]/g, '');

    const newOtp = [...otp];
    newOtp[index] = cleanedText;
    setOtp(newOtp);

    // Auto-focus next input
    if (cleanedText && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all digits entered
    if (index === 5 && cleanedText) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === 6) {
        if (params.mode === 'reset') {
          setShowPasswordField(true);
        } else {
          handleVerify(fullOtp);
        }
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (otpCode?: string) => {
    const code = otpCode || otp.join('');
    if (code.length !== 6) {
      Alert.alert('Error', 'Please enter the complete OTP');
      return;
    }

    setIsLoading(true);
    try {
      if (params.mode === 'reset') {
        if (!newPassword) {
          Alert.alert('Error', 'Please enter a new password');
          setIsLoading(false);
          return;
        }

        const result = await resetPassword(params.email, code, newPassword);
        if (!result.success) {
          Alert.alert('Reset Failed', result.error || 'Please try again');
          return;
        }

        Alert.alert('Success', 'Password reset successfully', [
          { text: 'OK', onPress: () => router.replace('/(auth)/login') }
        ]);
      } else {
        const result = await verifyEmail(params.email, code);

        if (!result.success) {
          Alert.alert('Verification Failed', result.error || 'Please try again');
          return;
        }

        if (result.requiresRoleSelection) {
          router.replace({
            pathname: '/(auth)/role',
            params: { email: params.email, fullName: params.fullName },
          });
        } else {
          // User already has role, go to home
          const role = result.user?.role;
          if (role === 'hospital') {
            router.replace('/(hospital)/(tabs)/home');
          } else if (role === 'doctor') {
            router.replace('/(doctor)/(tabs)/home');
          } else {
            // Defensive fallback: if backend didn't include user data, send to role selection.
            router.replace({
              pathname: '/(auth)/role',
              params: { email: params.email, fullName: params.fullName },
            });
          }
        }
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    setIsLoading(true);
    try {
      const type = params.mode === 'reset' ? 'password_reset' : 'email_verification';
      const result = await resendOTP(params.email, type);

      if (result.success) {
        setCountdown(60);
        setCanResend(false);
        setOtp(['', '', '', '', '', '']);
        Alert.alert('Success', 'OTP sent successfully');
      } else {
        Alert.alert('Error', result.error || 'Failed to resend OTP');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to resend OTP');
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
              {params.mode === 'reset' ? 'Reset Password' : 'Verify Email'}
            </Text>
            <Text className="text-white text-center text-base opacity-90 leading-6 px-4">
              We've sent a 6-digit code to{'\n'}
              {params.email}
            </Text>
          </View>
        </View>

        {/* FORM */}
        <View className="-mt-12 flex-1 bg-white rounded-t-3xl px-6 pt-8">
          {/* OTP INPUTS */}
          <View className="flex-row justify-between mb-6">
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { inputRefs.current[index] = ref; }}
                className={`w-12 h-14 bg-gray-50 rounded-xl text-center text-xl font-bold text-gray-900 ${digit ? 'border-2 border-brand-primary' : ''
                  }`}
                value={digit}
                onChangeText={(text) => handleOtpChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                editable={!isLoading}
              />
            ))}
          </View>

          {/* RESEND OTP BUTTON */}
          <View className="mb-6">
            <TouchableOpacity
              className={`rounded-xl py-4 border-2 ${canResend
                ? 'border-brand-primary bg-white'
                : 'border-gray-300 bg-gray-50'
                }`}
              onPress={handleResend}
              disabled={!canResend || isLoading}
            >
              <Text
                className={`text-center text-base font-semibold ${canResend ? 'text-brand-primary' : 'text-gray-400'
                  }`}
              >
                {canResend ? 'RESEND OTP' : `RESEND OTP (${countdown}s)`}
              </Text>
            </TouchableOpacity>
            <Text className="text-gray-500 text-xs text-center mt-2">
              Didn't receive the code? Click above to resend
            </Text>
          </View>

          {/* PASSWORD FIELD (for reset mode) */}
          {params.mode === 'reset' && showPasswordField && (
            <View className="mb-6">
              <Text className="text-gray-700 text-sm font-medium mb-2">
                New Password
              </Text>
              <TextInput
                className="bg-gray-100 rounded-xl px-4 py-4 text-gray-700"
                placeholder="Enter new password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                editable={!isLoading}
              />
              <Text className="text-gray-400 text-xs mt-2">
                Min 8 chars, uppercase, lowercase, number, special char
              </Text>
            </View>
          )}

          {/* VERIFY BUTTON */}
          <TouchableOpacity
            className={`rounded-xl py-4 mb-4 ${isLoading ? 'bg-gray-400' : 'bg-brand-primary'}`}
            onPress={() => handleVerify()}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white text-center text-base font-semibold">
                {params.mode === 'reset' && showPasswordField ? 'RESET PASSWORD' : 'VERIFY'}
              </Text>
            )}
          </TouchableOpacity>

          {/* BACK TO LOGIN */}
          <TouchableOpacity
            className="items-center mb-8"
            onPress={() => router.replace('/(auth)/login')}
            disabled={isLoading}
          >
            <Text className="text-gray-600 text-sm">
              Back to Login
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
