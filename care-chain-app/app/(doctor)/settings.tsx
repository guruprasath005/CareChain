import { useRouter } from 'expo-router';
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Image,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useDoctorProfile } from '../../hooks';

export default function SettingsMenuScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { profile } = useDoctorProfile();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: logout
        },
      ]
    );
  };

  const displayName = profile?.displayName || profile?.name || user?.fullName || 'User';
  const displayEmail = profile?.email || user?.email || 'email@example.com';
  const completionValue: any = (profile as any)?.profileCompletion;
  const profileCompletion = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        typeof completionValue === 'number'
          ? completionValue
          : typeof completionValue?.percentage === 'number'
            ? completionValue.percentage
            : 0
      )
    )
  );

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Backdrop */}
      <View className="flex-1 bg-black px-4 py-6">
        {/* Panel */}
        <View className="w-full max-w-xl self-center">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-white text-2xl font-bold">Menu</Text>

            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                activeOpacity={0.85}
                className="h-12 w-12 rounded-2xl bg-gray-800 items-center justify-center"
                onPress={() => {
                  // Keep behavior minimal for now
                }}
              >
                <Ionicons name="notifications-outline" size={24} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                className="h-12 w-12 rounded-2xl bg-gray-800 items-center justify-center"
                onPress={() => router.back()}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Profile card with cyan border */}
          <View className="rounded-3xl border-2 border-cyan-400 bg-gray-800 p-5 mb-6">
            <Pressable
              className="flex-row items-center justify-between mb-4"
              onPress={() => router.push('/(doctor)/profile')}
            >
              <View className="flex-row items-center flex-1">
                <View className="h-16 w-16 rounded-full overflow-hidden bg-gray-600">
                  <Image
                    source={profile?.avatar ? { uri: profile.avatar } : require('../assets/images/logo.png')}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                </View>

                <View className="ml-4 flex-1">
                  <Text className="text-white text-lg font-semibold">{displayName}</Text>
                  <Text className="text-gray-300 text-sm">{displayEmail}</Text>
                </View>
              </View>

              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </Pressable>

            {/* Profile completion section */}
            <View className="rounded-2xl bg-gray-700 p-4 mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-white text-sm font-medium">Profile Completion</Text>
                <Text className="text-white text-sm font-medium">{profileCompletion}%</Text>
              </View>
              <View className="h-2 w-full rounded-full bg-gray-600 overflow-hidden mb-2">
                <View 
                  className="h-2 rounded-full" 
                  style={{ width: `${profileCompletion}%`, backgroundColor: '#05B016' }} 
                />
              </View>
              <Text className="text-gray-300 text-xs">
                Complete your profile to get better job matches
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              className="rounded-2xl bg-blue-600 py-4 items-center"
              onPress={() => {
                router.push('/(doctor)/editProfile');
              }}
            >
              <Text className="text-white text-base font-semibold">Edit Your Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Menu items */}
          <View className="space-y-6">
            <MenuItem icon="home-outline" label="Home" onPress={() => router.push('/(doctor)/(tabs)/home')} />
            <MenuItem
              icon="options-outline"
              label="Career Preferences"
              onPress={() => router.push('/(doctor)/careerPreferences')}
            />
            <MenuItem
              icon="document-text-outline"
              label="My Documents"
              onPress={() => {
                router.push('/(doctor)/myDocuments');
              }}
            />
            <MenuItem
              icon="color-palette-outline"
              label="Appearance"
              onPress={() => {
                // Placeholder
              }}
            />
            <MenuItem
              icon="log-out-outline"
              label="Logout"
              onPress={handleLogout}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      className="rounded-2xl bg-gray-800 px-5 py-4 flex-row items-center"
      onPress={onPress}
    >
      <View className="h-10 w-10 rounded-xl bg-gray-700 items-center justify-center mr-4">
        <Ionicons name={icon} size={20} color="#fff" />
      </View>
      <Text className="text-white text-base font-medium">{label}</Text>
    </Pressable>
  );
}
