import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { usePostJob, useHospitalProfile, usePostedJobs } from '@/hooks';
import { StatusBar } from 'react-native';
import { Colors } from '@/constants/Colors';

export default function ReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { postJob, isLoading: postLoading } = usePostJob();
  const { updateJob, loading: updateLoading } = usePostedJobs();
  const { profile: hospitalProfile } = useHospitalProfile();
  const [error, setError] = useState<string | null>(null);

  const {
    jobId = '',
    mode = 'create',
    jobTitle = '',
    jobDescription = '',
    jobType = '',
    salary = '',
    startDate = '',
    endDate = '',
    shiftStartTime = '',
    shiftEndTime = '',
    transportation = 'false',
    accommodation = 'false',
    meals = 'false',
    insurance = 'false',
    qualifications = '',
    customQualification = '',
    skills = '',
    customSkill = '',
    experience = '',
    specialization = '',
    city = '',
    state = '',
    pincode = '',
    salaryType = 'monthly',
  } = params;

  const isEditMode = mode === 'edit' && jobId;

  const qualMap: { [key: string]: string } = {
    md: 'MD (Medical Doctor)',
    do: 'DO (Doctor of Osteopathy)',
    mbbs: 'MBBS (Bachelor of Medicine)',
  };

  const skillMap: { [key: string]: string } = {
    surgical: 'Surgical Procedures',
    diagnostic: 'Diagnostic Skills',
    'patient-care': 'Patient Care',
    emergency: 'Emergency Response',
  };

  const selectedQuals =
    typeof qualifications === 'string' && qualifications
      ? qualifications.split(',').map((id) => qualMap[id] || id)
      : [];
  if (customQualification && typeof customQualification === 'string') {
    selectedQuals.push(customQualification);
  }

  const selectedSkills =
    typeof skills === 'string' && skills
      ? skills.split(',').map((id) => skillMap[id] || id)
      : [];
  if (customSkill && typeof customSkill === 'string') {
    selectedSkills.push(customSkill);
  }

  // Map frontend job type to backend enum
  const mapJobType = (type: string): string => {
    const mapping: { [key: string]: string } = {
      'Full Time': 'full_time',
      'Part Time': 'part_time',
      'Contract': 'contract',
      'Locum Tenens': 'locum_tenens',
      'Per Diem': 'per_diem',
    };
    return mapping[type] || 'full_time';
  };

  // Parse experience string to years
  const parseExperience = (exp: string): number => {
    if (!exp) return 1;
    const match = exp.match(/(\d+)/);
    if (match) return parseInt(match[1]);
    if (exp.toLowerCase().includes('less')) return 0;
    return 1;
  };

  // Format time string to HH:MM
  const formatShiftTime = (timeStr: string): string => {
    if (!timeStr) return '09:00';
    // Handle Date.toTimeString() format like "07:00:00 GMT+0530"
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      return `${match[1].padStart(2, '0')}:${match[2]}`;
    }
    return '09:00';
  };

  const handlePostJob = async () => {
    setError(null);

    // Validate required fields
    if (!jobTitle || (jobTitle as string).trim().length < 5) {
      Alert.alert('Error', 'Job title must be at least 5 characters');
      return;
    }
    if (!jobDescription || (jobDescription as string).trim().length < 50) {
      Alert.alert('Error', 'Job description must be at least 50 characters');
      return;
    }
    if (!salary || parseInt(salary as string) <= 0) {
      Alert.alert('Error', 'Please enter a valid salary amount');
      return;
    }

    // Resolve location: prefer params, fallback to hospital profile
    const resolvedCity =
      (city as string)?.trim() ||
      hospitalProfile?.location?.city ||
      hospitalProfile?.address?.city ||
      '';

    const resolvedState =
      (state as string)?.trim() ||
      hospitalProfile?.location?.state ||
      hospitalProfile?.address?.state ||
      undefined;

    const resolvedAddress =
      hospitalProfile?.location?.street ||
      hospitalProfile?.address?.street ||
      undefined;

    const resolvedPincode =
      (pincode as string)?.trim() ||
      hospitalProfile?.location?.pincode ||
      hospitalProfile?.address?.pincode ||
      undefined;

    // Resolve specialization: prefer params, fallback to title
    const resolvedSpecialization =
      (specialization as string)?.trim() || (jobTitle as string).trim();

    // Build job data matching backend validator expectations
    const jobData = {
      title: (jobTitle as string).trim(),
      description: (jobDescription as string).trim(),
      specialization: resolvedSpecialization,
      jobType: mapJobType(jobType as string),
      publish: true, // Auto-publish job so it's visible to doctors immediately
      duration: {
        startDate: startDate as string || new Date().toISOString(),
        endDate: endDate as string || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      },
      shift: {
        startTime: formatShiftTime(shiftStartTime as string),
        endTime: formatShiftTime(shiftEndTime as string),
        shiftType: 'day',
      },
      // Provide hospital city if we have it; backend will also fall back to hospital profile.
      location:
        resolvedCity && resolvedCity.trim().length > 0
          ? {
            city: resolvedCity,
            state: resolvedState,
            address: resolvedAddress,
            pincode: resolvedPincode,
          }
          : undefined,
      compensation: {
        type: salaryType as string,
        amount: parseInt(salary as string),
      },
      facilities: {
        transport: transportation === 'true',
        accommodation: accommodation === 'true',
        meals: meals === 'true',
        insurance: insurance === 'true',
      },
      requirements: {
        minimumExperience: parseExperience(experience as string),
        qualifications: selectedQuals,
        skills: selectedSkills,
      },
    };

    let result;

    if (isEditMode) {
      result = await updateJob(jobId as string, jobData);
    } else {
      result = await postJob(jobData);
    }

    if (result.success) {
      if (isEditMode) {
        Alert.alert('Success', 'Job updated successfully');
        router.push('/(hospital)/(tabs)/jobs');
      } else {
        // Extract job ID from result
        // @ts-ignore
        const createdJobId = result.job?.id || result.job?._id;
        router.push({
          pathname: '/(hospital)/postJob/success',
          params: {
            jobId: createdJobId,
            jobTitle: jobTitle
          }
        });
      }
    } else {
      setError(result.error || `Failed to ${isEditMode ? 'update' : 'post'} job`);
      Alert.alert('Error', result.error || `Failed to ${isEditMode ? 'update' : 'post'} job. Please try again.`);
    }
  };

  const handlePrevious = () => {
    router.back();
  };

  const handleEditJobDetails = () => {
    router.push({
      pathname: '/(hospital)/postJob/jobDetails',
      params: { ...params },
    });
  };

  const handleEditCandidateSupport = () => {
    router.push({
      pathname: '/(hospital)/postJob/candidateSupport',
      params: { ...params },
    });
  };

  const handleEditRequirements = () => {
    router.push({
      pathname: '/(hospital)/postJob/requirements',
      params: { ...params },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.brand.secondary} />
      <View className="px-5 mt-4">
        <View className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
          <TouchableOpacity
            onPress={() => router.push('/(hospital)/(tabs)/jobs')}
            className="absolute right-4 top-4 z-10"
          >
            <Ionicons name="close" size={24} color="#1f2937" />
          </TouchableOpacity>

          <Text className="text-xl font-semibold text-gray-900 mb-1">
            Job Posting Summary
          </Text>
          <Text className="text-sm text-gray-500 mb-6">
            Review and confirm your job information.
          </Text>

          <View className="flex-row items-center mb-6">
            <View className="w-8 h-8 rounded-full bg-green-500 items-center justify-center">
              <Ionicons name="checkmark" size={16} color="white" />
            </View>
            <View className="flex-1 h-0.5 bg-green-500 mx-2" />
            <View className="w-8 h-8 rounded-full bg-green-500 items-center justify-center">
              <Ionicons name="checkmark" size={16} color="white" />
            </View>
            <View className="flex-1 h-0.5 bg-green-500 mx-2" />
            <View className="w-8 h-8 rounded-full bg-green-500 items-center justify-center">
              <Ionicons name="checkmark" size={16} color="white" />
            </View>
            <View className="flex-1 h-0.5 bg-green-500 mx-2" />
            <View className="w-8 h-8 rounded-full bg-brand-primary items-center justify-center">
              <Text className="text-white font-semibold text-sm">4</Text>
            </View>
          </View>

          <View className="flex-row mb-4">
            <Text className="text-xs text-gray-600 flex-1">Job Details</Text>
            <Text className="text-xs text-gray-600 flex-1 text-center">
              Candidate Support
            </Text>
            <Text className="text-xs text-gray-600 flex-1 text-center">Requirements</Text>
            <Text className="text-xs text-gray-900 font-medium flex-1 text-right">
              Review
            </Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <View className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-base font-semibold text-gray-900">Job Details</Text>
            <TouchableOpacity
              className="flex-row items-center"
              onPress={handleEditJobDetails}
            >
              <MaterialIcons name="edit" size={16} color={Colors.brand.tertiary} />
              <Text className="text-brand-tertiary text-sm ml-1">Edit</Text>
            </TouchableOpacity>
          </View>

          <View className="mb-3">
            <Text className="text-xs text-gray-500 mb-1">Job Title</Text>
            <Text className="text-sm text-gray-900">{jobTitle || 'Not specified'}</Text>
          </View>

          <View className="mb-3">
            <Text className="text-xs text-gray-500 mb-1">Job Description</Text>
            <Text className="text-sm text-gray-900" numberOfLines={2}>
              {jobDescription || 'Not specified'}
            </Text>
          </View>

          <View className="mb-3">
            <Text className="text-xs text-gray-500 mb-1">Job Type</Text>
            <Text className="text-sm text-gray-900">{jobType || 'Not specified'}</Text>
          </View>

          <View className="mb-3">
            <Text className="text-xs text-gray-500 mb-1">Specialization</Text>
            <Text className="text-sm text-gray-900">{specialization || jobTitle || 'Not specified'}</Text>
          </View>

          <View className="mb-3">
            <Text className="text-xs text-gray-500 mb-1">Location</Text>
            <Text className="text-sm text-gray-900">
              {city || hospitalProfile?.location?.city || hospitalProfile?.address?.city || 'Not specified'}
              {(state || hospitalProfile?.location?.state || hospitalProfile?.address?.state) &&
                `, ${state || hospitalProfile?.location?.state || hospitalProfile?.address?.state}`}
              {(pincode || hospitalProfile?.location?.pincode || hospitalProfile?.address?.pincode) &&
                ` - ${pincode || hospitalProfile?.location?.pincode || hospitalProfile?.address?.pincode}`}
            </Text>
          </View>

          <View className="mb-3">
            <Text className="text-xs text-gray-500 mb-1">Salary</Text>
            <Text className="text-sm text-gray-900">
              {salary ? `₹${salary} ${salaryType === 'hourly' ? '/hr' : salaryType === 'daily' ? '/day' : salaryType === 'per_patient' ? '/patient' : '/month'}` : 'Not specified'}
            </Text>
          </View>

          <View>
            <Text className="text-xs text-gray-500 mb-1">Work Schedule</Text>
            <Text className="text-sm text-gray-900">
              {startDate ? new Date(startDate as string).toLocaleDateString() : 'Start date'} – {endDate ? new Date(endDate as string).toLocaleDateString() : 'End date'}
            </Text>
            <Text className="text-xs text-gray-500 mt-0.5">
              {shiftStartTime ? formatShiftTime(shiftStartTime as string) : 'Start time'} – {shiftEndTime ? formatShiftTime(shiftEndTime as string) : 'End time'}
            </Text>
          </View>
        </View>

        <View className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-base font-semibold text-gray-900">Candidate Support</Text>
            <TouchableOpacity
              className="flex-row items-center"
              onPress={handleEditCandidateSupport}
            >
              <MaterialIcons name="edit" size={16} color={Colors.brand.tertiary} />
              <Text className="text-brand-tertiary text-sm ml-1">Edit</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center mb-3">
            <MaterialIcons name="directions-car" size={18} color="#6b7280" />
            <Text className="text-sm text-gray-900 ml-2 flex-1">Transportation</Text>
            <Text
              className={`text-sm font-medium ${transportation === 'true' ? 'text-green-600' : 'text-red-600'
                }`}
            >
              {transportation === 'true' ? 'Provided' : 'Not Provided'}
            </Text>
          </View>

          <View className="flex-row items-center mb-3">
            <MaterialIcons name="hotel" size={18} color="#6b7280" />
            <Text className="text-sm text-gray-900 ml-2 flex-1">Accommodation</Text>
            <Text
              className={`text-sm font-medium ${accommodation === 'true' ? 'text-green-600' : 'text-red-600'
                }`}
            >
              {accommodation === 'true' ? 'Provided' : 'Not Provided'}
            </Text>
          </View>

          <View className="flex-row items-center">
            <MaterialIcons name="restaurant" size={18} color="#6b7280" />
            <Text className="text-sm text-gray-900 ml-2 flex-1">Meals</Text>
            <Text
              className={`text-sm font-medium ${meals === 'true' ? 'text-green-600' : 'text-red-600'
                }`}
            >
              {meals === 'true' ? 'Provided' : 'Not Provided'}
            </Text>
          </View>

          <View className="flex-row items-center mt-3">
            <MaterialIcons name="security" size={18} color="#6b7280" />
            <Text className="text-sm text-gray-900 ml-2 flex-1">Insurance</Text>
            <Text
              className={`text-sm font-medium ${insurance === 'true' ? 'text-green-600' : 'text-red-600'
                }`}
            >
              {insurance === 'true' ? 'Provided' : 'Not Provided'}
            </Text>
          </View>
        </View>

        <View className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-base font-semibold text-gray-900">Job Requirements</Text>
            <TouchableOpacity
              className="flex-row items-center"
              onPress={handleEditRequirements}
            >
              <MaterialIcons name="edit" size={16} color={Colors.brand.tertiary} />
              <Text className="text-brand-tertiary text-sm ml-1">Edit</Text>
            </TouchableOpacity>
          </View>

          <View className="mb-3">
            <Text className="text-xs text-gray-500 mb-1">Required Qualifications</Text>
            <Text className="text-sm text-gray-900">
              {selectedQuals.length > 0 ? selectedQuals.join(', ') : 'Not specified'}
            </Text>
          </View>

          <View className="mb-3">
            <Text className="text-xs text-gray-500 mb-1">Required Skills</Text>
            <Text className="text-sm text-gray-900">
              {selectedSkills.length > 0 ? selectedSkills.join(', ') : 'Not specified'}
            </Text>
          </View>

          <View>
            <Text className="text-xs text-gray-500 mb-1">Experience Required</Text>
            <Text className="text-sm text-gray-900">{experience || 'Not specified'}</Text>
          </View>
        </View>

        <View className="bg-blue-50 rounded-2xl p-4 mb-6 flex-row">
          <Ionicons name="bulb-outline" size={20} color="#3b82f6" />
          <View className="flex-1 ml-3">
            <Text className="text-sm font-medium text-gray-900 mb-1">Helpful Tips</Text>
            <Text className="text-xs text-gray-600 leading-5">
              Please review all details carefully before publishing. Once live, this job post
              will be visible to eligible candidates on the platform.
            </Text>
          </View>
        </View>

        <View className="flex-row gap-3 mb-8">
          <TouchableOpacity
            onPress={handlePrevious}
            className="flex-1 bg-white border border-gray-300 rounded-xl py-4"
            activeOpacity={0.8}
            disabled={postLoading || updateLoading}
          >
            <Text className="text-gray-900 text-center font-semibold text-base">
              Previous
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePostJob}
            className="flex-1 bg-brand-primary rounded-xl py-4"
            activeOpacity={0.8}
            disabled={postLoading || updateLoading}
          >
            {(postLoading || updateLoading) ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white text-center font-semibold text-base">
                {isEditMode ? 'Update Job' : 'Post Job'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
