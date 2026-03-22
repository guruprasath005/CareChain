// screens/LoginScreen.tsx
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

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(email.trim(), password);

      if (!result.success) {
        Alert.alert('Login Failed', result.error || 'Please try again');
        return;
      }

      // Check if role selection is needed
      if (result.requiresRoleSelection) {
        router.push({
          pathname: '/(auth)/role',
          params: { email: result.email, fullName: result.fullName },
        });
        return;
      }

      // Check if verification is needed
      if (result.requiresVerification) {
        router.push({
          pathname: '/(auth)/emailotp',
          params: { email: result.email, mode: 'verification' },
        });
        return;
      }

      // Login successful - navigate based on role
      const role = result.user?.role;
      if (role === 'hospital') {
        router.replace('/(hospital)/(tabs)/home');
      } else {
        router.replace('/(doctor)/(tabs)/home');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    router.push({
      pathname: '/(auth)/forgotpassword',
    });
  };

  const handleSignUp = () => {
    router.push('/(auth)/signup');
  };

  const handleGoogleSignIn = () => {
    Alert.alert('Coming Soon', 'Google sign in will be available soon');
  };

  const handleAppleSignIn = () => {
    Alert.alert('Coming Soon', 'Apple sign in will be available soon');
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
              Welcome Back
            </Text>
            <Text className="text-white text-center text-base opacity-90 leading-6 px-4">
              Continue your journey of care and connection.{'\n'}
              Log in to rejoin your medical community.
            </Text>
          </View>
        </View>

        {/* FORM */}
        <View className="-mt-12 flex-1 bg-white rounded-t-3xl px-6 pt-8">
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
          <View className="mb-2">
            <Text className="text-gray-700 text-sm font-medium mb-2">
              Password
            </Text>
            <View className="flex-row items-center bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 focus:border-brand-primary">
              <Ionicons name="lock-closed-outline" size={20} color="#6b7280" style={{ marginRight: 10 }} />
              <TextInput
                className="flex-1 text-gray-700 text-base"
                placeholder="Enter your password"
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
          </View>

          {/* FORGOT PASSWORD */}
          <TouchableOpacity
            className="self-end mb-6"
            onPress={handleForgotPassword}
            disabled={isLoading}
          >
            <Text className="text-gray-400 text-sm">
              Forgot Password?
            </Text>
          </TouchableOpacity>

          {/* LOGIN */}
          <TouchableOpacity
            className={`rounded-xl py-4 mb-8 ${isLoading ? 'bg-gray-400' : 'bg-brand-primary'}`}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white text-center text-base font-semibold">
                LOGIN
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
                Sign in with Google
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="border-2 border-gray-100 rounded-xl py-3.5 flex-row items-center justify-center bg-black"
              onPress={handleAppleSignIn}
              disabled={isLoading}
            >
              <Ionicons name="logo-apple" size={24} color="#FFFFFF" style={{ marginRight: 12 }} />
              <Text className="text-white font-semibold text-base">
                Sign in with Apple
              </Text>
            </TouchableOpacity>
          </View>

          {/* SIGN UP */}
          <View className="flex-row justify-center mb-8">
            <Text className="text-gray-600 text-sm">
              You don't have an account yet?
            </Text>
            <TouchableOpacity onPress={handleSignUp} disabled={isLoading} className="ml-1">
              <Text className="text-brand-primary text-sm font-bold underline">
                Sign up
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
