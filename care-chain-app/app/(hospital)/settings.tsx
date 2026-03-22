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
import { Colors } from '@/constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { useHospitalProfile } from '../../hooks';

export default function HospitalSettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { profile } = useHospitalProfile();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const displayName = profile?.name || user?.fullName || 'Hospital';
  const displayEmail = user?.email || 'email@example.com';

  return (
    <SafeAreaView className="flex-1" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.brand.secondary} />

      <View className="flex-1 bg-black/60 px-4 py-6">
        <View className="w-full max-w-xl self-center rounded-3xl bg-black px-4 py-5">
          <View className="flex-row items-center justify-between">
            <Text className="text-white text-lg font-semibold">Menu</Text>

            <TouchableOpacity
              activeOpacity={0.85}
              className="h-10 w-10 rounded-xl bg-white/10 items-center justify-center"
              onPress={() => router.back()}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <View className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <Pressable className="flex-row items-center justify-between" onPress={() => router.push('/(hospital)/profile')}>
              <View className="flex-row items-center">
                <View className="h-11 w-11 rounded-full overflow-hidden bg-white/10">
                  <Image
                    source={profile?.avatar ? { uri: profile.avatar } : require('../assets/images/logo.png')}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                </View>

                <View className="ml-3">
                  <Text className="text-white font-semibold">{displayName}</Text>
                  <Text className="text-white/70 text-xs">{displayEmail}</Text>

                  {/* Profile Completion Bar */}
                  {/* @ts-ignore */}
                  <View className="mt-2 w-full">
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-white/60 text-[10px]">Profile Completion</Text>
                      <Text className="text-white/80 text-[10px] font-medium">{profile?.profileCompletion || 0}%</Text>
                    </View>
                    <View className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <View
                        className="h-full bg-brand-primary rounded-full"
                        style={{ width: `${profile?.profileCompletion || 0}%` }}
                      />
                    </View>
                  </View>
                </View>
              </View>

              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </Pressable>
          </View>

          <View className="mt-4">
            <MenuItem icon="person-outline" label="Profile" onPress={() => router.push('/(hospital)/profile')} />
            <MenuItem icon="home-outline" label="Home" onPress={() => router.push('/(hospital)/(tabs)/home')} />
            <MenuItem icon="briefcase-outline" label="Jobs" onPress={() => router.push('/(hospital)/(tabs)/jobs')} />

            <Pressable
              className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 flex-row items-center"
              onPress={handleLogout}
            >
              <View className="h-9 w-9 rounded-xl bg-white/10 items-center justify-center">
                <Ionicons name="log-out-outline" size={18} color="#fff" />
              </View>
              <Text className="ml-3 text-white font-medium">Logout</Text>
            </Pressable>
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
      className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 flex-row items-center"
      onPress={onPress}
    >
      <View className="h-9 w-9 rounded-xl bg-white/10 items-center justify-center">
        <Ionicons name={icon} size={18} color="#fff" />
      </View>
      <Text className="ml-3 text-white font-medium">{label}</Text>
    </Pressable>
  );
}
