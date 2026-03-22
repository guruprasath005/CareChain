import React from 'react';
import { View, Text, Image, StatusBar, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';

export default function App() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.brand.secondary} />

      <View className="flex-1 justify-between px-8 pb-6">

        {/* Logo */}
        <View className="items-end mt-10">
          <Image
            source={require('../assets/images/logo.png')}
            className="w-32 h-24"
            resizeMode="contain"
          />
          <Text className="text-lg text-gray-700">Care Chain</Text>
        </View>

        {/* Text + Button */}
        <View className="items-start">
          <Text className="text-4xl font-bold text-[#1e3a8a]">
            Your{'\n'}
            <Text className="underline">Medical Career</Text>{'\n'}
            Starts Here!
          </Text>

          <Text className="text-base text-gray-600 mt-6">
            Discover roles that match your passion and profession.
          </Text>

          {/* Button */}
          <View className="mt-12 self-end">
            <TouchableOpacity
              onPress={() => router.push('/(auth)/login')}
              activeOpacity={0.8}
            >
              <View className="w-16 h-16 bg-[#1e3a8a] rounded-full items-center justify-center shadow-lg">
                <Text className="text-white text-3xl">{'>'}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

      </View>
    </SafeAreaView>
  );
}
