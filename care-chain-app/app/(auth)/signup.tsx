// app/(auth)/signup.tsx
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
import { Ionicons, AntDesign } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';

export default function SignupScreen() {
  const { signup } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(pwd)) return 'Password must contain an uppercase letter';
    if (!/[a-z]/.test(pwd)) return 'Password must contain a lowercase letter';
    if (!/[0-9]/.test(pwd)) return 'Password must contain a number';
    if (!/[!@#$%^&*]/.test(pwd)) return 'Password must contain a special character (!@#$%^&*)';
    return null;
  };

  const handleSignup = async () => {
    if (!fullName || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      Alert.alert('Invalid Password', passwordError);
      return;
    }

    setIsLoading(true);
    try {
      const result = await signup(fullName.trim(), email.trim(), password);

      if (!result.success) {
        Alert.alert('Signup Failed', result.error || 'Please try again');
        return;
      }

      // Navigate to OTP verification
      router.push({
        pathname: '/(auth)/emailotp',
        params: { email: email.trim(), mode: 'verification', fullName: fullName.trim() },
      });
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = () => {
    router.push('/(auth)/login');
  };

  const handleGoogleSignIn = () => {
    Alert.alert('Coming Soon', 'Google sign up will be available soon');
  };

  const handleAppleSignIn = () => {
    Alert.alert('Coming Soon', 'Apple sign up will be available soon');
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
              Create an Account
            </Text>
            <Text className="text-white text-center text-base opacity-90 leading-6 px-4">
              Join the network built for healthcare heroes.{'\n'}
              Connect, learn, and grow with CareChain.
            </Text>
          </View>
        </View>

        {/* FORM */}
        <View className="-mt-12 flex-1 bg-white rounded-t-3xl px-6 pt-8">
          {/* FULL NAME */}
          <View className="mb-5">
            <Text className="text-gray-700 text-sm font-medium mb-2">
              Full Name
            </Text>
            <View className="flex-row items-center bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 focus:border-brand-primary">
              <Ionicons name="person-outline" size={20} color="#6b7280" style={{ marginRight: 10 }} />
              <TextInput
                className="flex-1 text-gray-700 text-base"
                placeholder="Enter your full name"
                placeholderTextColor="#9ca3af"
                value={fullName}
                onChangeText={setFullName}
                editable={!isLoading}
              />
            </View>
          </View>

          {/* EMAIL */}
          <View className="mb-5">
            <Text className="text-gray-700 text-sm font-medium mb-2">
              Email
            </Text>
            <View className="flex-row items-center bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 focus:border-brand-primary">
              <Ionicons name="mail-outline" size={20} color="#6b7280" style={{ marginRight: 10 }} />
              <TextInput
                className="flex-1 text-gray-700 text-base"
                placeholder="Enter your email"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>
          </View>

          {/* PASSWORD */}
          <View className="mb-6">
            <Text className="text-gray-700 text-sm font-medium mb-2">
              Password
            </Text>
            <View className="flex-row items-center bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 focus:border-brand-primary">
              <Ionicons name="lock-closed-outline" size={20} color="#6b7280" style={{ marginRight: 10 }} />
              <TextInput
                className="flex-1 text-gray-700 text-base"
                placeholder="Create a password"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="#6b7280"
                />
              </TouchableOpacity>
            </View>
            <Text className="text-gray-400 text-xs mt-2 pl-1">
              Min 8 chars, uppercase, lowercase, number, special char
            </Text>
          </View>

          {/* SIGN UP */}
          <TouchableOpacity
            className={`rounded-xl py-4 mb-8 ${isLoading ? 'bg-gray-400' : 'bg-brand-primary'}`}
            onPress={handleSignup}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white text-center text-base font-semibold">
                SIGN UP
              </Text>
            )}
          </TouchableOpacity>

          {/* GOOGLE & APPLE SIGN IN */}
          <View className="gap-y-3 mb-6">
            <TouchableOpacity
              className="border-2 border-gray-100 rounded-xl py-3.5 flex-row items-center justify-center bg-white"
              onPress={handleGoogleSignIn}
              disabled={isLoading}
            >
              <AntDesign name="google" size={24} color="#EA4335" style={{ marginRight: 12 }} />
              <Text className="text-gray-700 font-semibold text-base">
                Sign up with Google
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="border-2 border-gray-100 rounded-xl py-3.5 flex-row items-center justify-center bg-black"
              onPress={handleAppleSignIn}
              disabled={isLoading}
            >
              <Ionicons name="logo-apple" size={24} color="#FFFFFF" style={{ marginRight: 12 }} />
              <Text className="text-white font-semibold text-base">
                Sign up with Apple
              </Text>
            </TouchableOpacity>
          </View>

          {/* LOGIN LINK */}
          <View className="flex-row justify-center mb-8">
            <Text className="text-gray-600 text-sm">
              Already have an account?
            </Text>
            <TouchableOpacity onPress={handleLogin} disabled={isLoading} className="ml-1">
              <Text className="text-brand-primary text-sm font-bold underline">
                Login
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
