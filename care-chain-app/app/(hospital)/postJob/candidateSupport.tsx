import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'react-native';
import { Colors } from '@/constants/Colors';

export default function CandidateSupportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [transportation, setTransportation] = useState(params.transportation === 'true');
  const [accommodation, setAccommodation] = useState(params.accommodation === 'true');
  const [meals, setMeals] = useState(params.meals === 'true');
  const [insurance, setInsurance] = useState(params.insurance === 'true');

  const handleNext = () => {
    router.push({
      pathname: '/(hospital)/postJob/requirements',
      params: {
        ...params,
        transportation: transportation.toString(),
        accommodation: accommodation.toString(),
        meals: meals.toString(),
        insurance: insurance.toString(),
      },
    });
  };

  const handlePrevious = () => {
    // Pass back current state + existing params so nothing is lost
    router.push({
      pathname: '/(hospital)/postJob/jobDetails',
      params: {
        ...params,
        transportation: transportation.toString(),
        accommodation: accommodation.toString(),
        meals: meals.toString(),
        insurance: insurance.toString(),
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.brand.secondary} />
      <View className="px-5 mt-4">
        <View className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="absolute right-4 top-4 z-10"
          >
            <Ionicons name="close" size={24} color="#1f2937" />
          </TouchableOpacity>

          <Text className="text-xl font-semibold text-gray-900 mb-1">Job Facilities</Text>
          <Text className="text-sm text-gray-500 mb-6">
            Add candidate support and set the shift plan.
          </Text>

          <View className="flex-row items-center mb-6">
            <View className="w-8 h-8 rounded-full bg-green-500 items-center justify-center">
              <Ionicons name="checkmark" size={16} color="white" />
            </View>
            <View className="flex-1 h-0.5 bg-green-500 mx-2" />
            <View className="w-8 h-8 rounded-full bg-brand-primary items-center justify-center">
              <Text className="text-white font-semibold text-sm">2</Text>
            </View>
            <View className="flex-1 h-0.5 bg-gray-200 mx-2" />
            <View className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center">
              <Text className="text-gray-400 font-semibold text-sm">3</Text>
            </View>
            <View className="flex-1 h-0.5 bg-gray-200 mx-2" />
            <View className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center">
              <Text className="text-gray-400 font-semibold text-sm">4</Text>
            </View>
          </View>

          <View className="flex-row mb-4">
            <Text className="text-xs text-gray-600 flex-1">Job Details</Text>
            <Text className="text-xs text-gray-900 font-medium flex-1 text-center">
              Candidate Support
            </Text>
            <Text className="text-xs text-gray-400 flex-1 text-center">Requirements</Text>
            <Text className="text-xs text-gray-400 flex-1 text-right">Review</Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <View className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <Text className="text-base font-semibold text-gray-900 mb-4">
            Candidate Support Information
          </Text>

          <Text className="text-sm text-gray-700 mb-4">Candidate Support</Text>

          <View className="flex-row gap-3 mb-3">
            <View className="flex-1 border border-gray-200 rounded-xl p-4">
              <View className="flex-row items-center mb-2">
                <MaterialIcons name="directions-car" size={20} color="#6b7280" />
                <Text className="text-sm font-medium text-gray-900 ml-2">
                  Transportation
                </Text>
              </View>
              <Text className="text-xs text-gray-500 mb-3">
                Will Transport be provided for the candidate?
              </Text>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-gray-700">Yes/No</Text>
                <Switch
                  value={transportation}
                  onValueChange={setTransportation}
                  trackColor={{ false: '#d1d5db', true: '#10b981' }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>

            <View className="flex-1 border border-gray-200 rounded-xl p-4">
              <View className="flex-row items-center mb-2">
                <MaterialIcons name="hotel" size={20} color="#6b7280" />
                <Text className="text-sm font-medium text-gray-900 ml-2">
                  Accommodation
                </Text>
              </View>
              <Text className="text-xs text-gray-500 mb-3">
                Will Accommodation be provided for the...
              </Text>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-gray-700">Yes/No</Text>
                <Switch
                  value={accommodation}
                  onValueChange={setAccommodation}
                  trackColor={{ false: '#d1d5db', true: '#10b981' }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>
          </View>

          <View className="border border-gray-200 rounded-xl p-4">
            <View className="flex-row items-center mb-2">
              <MaterialIcons name="restaurant" size={20} color="#6b7280" />
              <Text className="text-sm font-medium text-gray-900 ml-2">Meals</Text>
            </View>
            <Text className="text-xs text-gray-500 mb-3">
              Will Meals be provided for the candidate?
            </Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-gray-700">Yes/No</Text>
              <Switch
                value={meals}
                onValueChange={setMeals}
                trackColor={{ false: '#d1d5db', true: '#10b981' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          <View className="border border-gray-200 rounded-xl p-4 mt-3">
            <View className="flex-row items-center mb-2">
              <MaterialIcons name="security" size={20} color="#6b7280" />
              <Text className="text-sm font-medium text-gray-900 ml-2">Insurance</Text>
            </View>
            <Text className="text-xs text-gray-500 mb-3">
              Will Insurance be provided for the candidate?
            </Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-gray-700">Yes/No</Text>
              <Switch
                value={insurance}
                onValueChange={setInsurance}
                trackColor={{ false: '#d1d5db', true: '#10b981' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
        </View>

        <View className="flex-row gap-3 mb-8">
          <TouchableOpacity
            onPress={handlePrevious}
            className="flex-1 bg-white border border-gray-300 rounded-xl py-4"
            activeOpacity={0.8}
          >
            <Text className="text-gray-900 text-center font-semibold text-base">
              Previous
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleNext}
            className="flex-1 bg-brand-primary rounded-xl py-4"
            activeOpacity={0.8}
          >
            <Text className="text-white text-center font-semibold text-base">Next</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
