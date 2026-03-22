import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

type Job = {
  id: string;
  title: string;
  hospital: string;
  location: string;
  experience: string;
  salary: string;
  avatar?: string | null;
  status: string;
  views: number;
  specialization: string;
  dates: string;
  applicants: number;
  description: string;
  qualifications: string[];
  skills: string[];
  shiftTime: string;
  shiftType: string;
  facilities: {
    meals: boolean;
    transport: boolean;
    accommodation?: boolean; // Backend key
    stay?: boolean; // Legacy key
    insurance: boolean;
  };
  requirements?: {
    minimumExperience?: number;
    qualifications?: string[];
    skills?: string[];
  };
};

type Props = {
  job: Job;
  applicationStats?: { [key: string]: number };
};

function SectionHeader({
  icon,
  title,
  right,
}: {
  icon: React.ReactNode;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center">
        <View className="h-12 w-12 rounded-2xl bg-blue-50 items-center justify-center mr-3">
          {icon}
        </View>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111827', fontFamily: 'DMSans-Bold' }}>{title}</Text>
      </View>
      {right ? right : null}
    </View>
  );
}

function SkillChip({ label }: { label: string }) {
  return (
    <View className="border border-blue-200 bg-blue-50 rounded-full px-3 py-2 mr-2 mb-2">
      <View className="flex-row items-center">
        <Ionicons name="checkmark-circle" size={14} color="#1e3a8a" />
        <Text style={{ color: '#1e3a8a', fontWeight: '600', marginLeft: 8, fontSize: 12, fontFamily: 'DMSans-SemiBold' }}>{label}</Text>
      </View>
    </View>
  );
}

function parseYears(experience: string): number {
  const m = experience?.match(/\d+/);
  if (!m) return 0;
  return Number(m[0]) || 0;
}

export default function JobDetailsView({ job, applicationStats = {} }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isNarrow = width < 360;

  const [expanded, setExpanded] = useState(false);
  const overviewText = useMemo(() => {
    if (!job.description) return 'No description provided.';
    if (expanded) return job.description;
    const trimmed = job.description.length > 170 ? `${job.description.slice(0, 170)}...` : job.description;
    return trimmed;
  }, [expanded, job.description]);

  // Use values from requirements if available, otherwise fallback
  const yearsRequired = job.requirements?.minimumExperience ?? parseYears(job.experience);

  // Calculate rejections from applicationStats
  const rejections = applicationStats.rejected || 0;

  const facilities = [
    { key: 'meals', label: 'Meals', icon: 'restaurant-outline' as const, iconColor: '#16A34A', badgeClass: 'bg-green-100' },
    { key: 'transport', label: 'Transport', icon: 'bus-outline' as const, iconColor: '#16A34A', badgeClass: 'bg-green-100' },
    { key: 'accommodation', label: 'Accommodation', icon: 'bed-outline' as const, iconColor: '#DC2626', badgeClass: 'bg-red-100' }, // Changed key to match backend
    { key: 'insurance', label: 'Insurance', icon: 'medkit-outline' as const, iconColor: '#16A34A', badgeClass: 'bg-green-100' },
  ];

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="px-5 pt-5 pb-8">
      <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <View className="p-5">
          <View className="flex-row items-center justify-between">
            <View 
              style={{ 
                backgroundColor: job.status === 'Open' ? 'rgba(55, 255, 0, 0.55)' : '#FEE2E2',
                borderRadius: 9999,
                paddingHorizontal: 16,
                paddingVertical: 8,
                shadowColor: '#000',
                shadowOpacity: 0.2,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 4,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#000000', fontFamily: 'DMSans-Bold' }}>{job.status}</Text>
            </View>

            <View className="flex-row items-center">
              <Ionicons name="eye-outline" size={16} color="#1e3a8a" />
              <Text style={{ color: '#1e3a8a', fontWeight: '600', marginLeft: 8, fontFamily: 'DMSans-SemiBold' }}>{job.views} Views</Text>
            </View>
          </View>

          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827', marginTop: 16, fontFamily: 'DMSans-Bold' }} numberOfLines={2}>
            {job.title}
          </Text>

          <Text style={{ color: '#130160', fontWeight: '600', marginTop: 8, fontFamily: 'DMSans-SemiBold' }} numberOfLines={2}>
            Specialization: {job.specialization}
          </Text>

          <View className="mt-4">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                <Text style={{ color: '#6B7280', marginLeft: 8, fontFamily: 'DMSans-Regular' }}>{job.dates}</Text>
              </View>

              <View className="flex-row items-center">
                <Ionicons name="people-outline" size={16} color="#6B7280" />
                <Text style={{ color: '#6B7280', marginLeft: 8, fontFamily: 'DMSans-Regular' }}>{job.applicants} applicants</Text>
              </View>
            </View>

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <FontAwesome name="rupee" size={16} color="#6B7280" />
                <Text style={{ color: '#6B7280', marginLeft: 8, fontFamily: 'DMSans-Regular' }}>{job.salary.replace('₹', '')}</Text>
              </View>

              <View className="flex-row items-center">
                <Ionicons name="location-outline" size={16} color="#6B7280" />
                <Text style={{ color: '#6B7280', marginLeft: 8, fontFamily: 'DMSans-Regular' }}>{job.location}</Text>
              </View>
            </View>
          </View>
        </View>

        <View className="h-px bg-gray-200" />

        <View className="p-5">
          <SectionHeader
            icon={<Ionicons name="person-outline" size={22} color="#1e3a8a" />}
            title="Job Overview"
          />

          <Text style={{ color: '#6B7280', marginTop: 16, lineHeight: 24, fontFamily: 'DMSans-Regular' }}>{overviewText}</Text>

          {job.description.length > 170 ? (
            <TouchableOpacity activeOpacity={0.8} onPress={() => setExpanded((v) => !v)} className="mt-3 flex-row items-center">
              <Text style={{ color: '#111827', fontWeight: '600', marginRight: 8, fontFamily: 'DMSans-SemiBold' }}>{expanded ? 'Read Less' : 'Read More'}</Text>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#111827" />
            </TouchableOpacity>
          ) : null}
        </View>

        <View className="h-px bg-gray-200" />

        <View className="p-5">
          <SectionHeader
            icon={<Ionicons name="sparkles-outline" size={22} color="#1e3a8a" />}
            title="Mandatory Qualifications"
          />

          <View className="mt-4">
            {job.qualifications.length > 0 ? (
              job.qualifications.map((q) => (
                <View key={q} className="flex-row items-start py-4 border-b border-gray-100">
                  <Ionicons name="checkmark-circle-outline" size={20} color="#1e3a8a" />
                  <Text style={{ color: '#6B7280', marginLeft: 12, flex: 1, lineHeight: 24, fontFamily: 'DMSans-Regular' }}>{q}</Text>
                </View>
              ))
            ) : (
              <Text style={{ color: '#9CA3AF', fontStyle: 'italic', fontFamily: 'DMSans-Regular' }}>No specific qualifications listed.</Text>
            )}
          </View>
        </View>

        <View className="h-px bg-gray-200" />

        <View className="p-5">
          <SectionHeader
            icon={<Ionicons name="clipboard-outline" size={22} color="#1e3a8a" />}
            title="Job Criteria"
          />

          <View className={`mt-5 ${isNarrow ? 'flex-col' : 'flex-row'}`}>
            <View
              className={`${isNarrow ? 'w-full' : ''} bg-white rounded-2xl border border-blue-100 p-3 items-center`}
              style={{
                width: isNarrow ? undefined : '32%',
                shadowColor: '#000',
                shadowOpacity: 0.05,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
              }}
            >
              <View className="h-10 w-10 rounded-2xl bg-blue-50 items-center justify-center">
                <Ionicons name="briefcase-outline" size={20} color="#1e3a8a" />
              </View>
              <Text style={{ fontSize: 32, fontWeight: '800', color: '#6B7280', marginTop: 12, textAlign: 'center', fontFamily: 'DMSans-Bold' }}>{yearsRequired}+</Text>
              <Text style={{ color: '#6B7280', fontWeight: '600', marginTop: 6, textAlign: 'center', fontSize: 10, fontFamily: 'DMSans-SemiBold' }}>YEARS REQUIRED</Text>
            </View>

            <View className={isNarrow ? 'h-4' : 'w-3'} />

            <View
              className={`${isNarrow ? 'w-full' : 'flex-1'} bg-white rounded-2xl border border-blue-100 p-4`}
              style={{
                shadowColor: '#000',
                shadowOpacity: 0.05,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
              }}
            >
              <Text style={{ color: '#6B7280', fontWeight: 'bold', marginBottom: 12, fontFamily: 'DMSans-Bold' }}>SKILLS REQUIRED</Text>
              <View className="flex-row flex-wrap">
                {job.skills.map((s) => (
                  <SkillChip key={s} label={s} />
                ))}
              </View>
            </View>
          </View>
        </View>

        <View className="h-px bg-gray-200" />

        <View className="p-5">
          <Text style={{ color: '#6B7280', fontWeight: 'bold', marginBottom: 16, fontFamily: 'DMSans-Bold' }}>SHIFT & SCHEDULE</Text>

          <View 
            className="bg-white rounded-2xl p-5 flex-row justify-between"
            style={{
              shadowColor: '#64748B',
              shadowOpacity: 0.1,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 3,
            }}
          >
            <View>
              <Text style={{ color: '#6B7280', fontWeight: '600', fontFamily: 'DMSans-SemiBold' }}>Shift Time</Text>
              <Text style={{ color: '#111827', fontWeight: '800', marginTop: 8, fontFamily: 'DMSans-Bold' }}>{job.shiftTime}</Text>
            </View>

            <View>
              <Text style={{ color: '#6B7280', fontWeight: '600', fontFamily: 'DMSans-SemiBold' }}>Shift Type</Text>
              <View className="flex-row items-center mt-2">
                <Ionicons name={job.shiftType === 'Day Shift' ? 'sunny-outline' : 'moon-outline'} size={18} color="#F59E0B" />
                <Text style={{ color: '#111827', fontWeight: '800', marginLeft: 8, fontFamily: 'DMSans-Bold' }}>{job.shiftType}</Text>
              </View>
            </View>
          </View>
        </View>

        <View className="px-5 pb-6">
          <Text style={{ color: '#6B7280', fontWeight: 'bold', marginBottom: 16, fontFamily: 'DMSans-Bold' }}>FACILITIES</Text>

          <View className="flex-row justify-between">
            {facilities.map((f) => {
              const isAvailable = job.facilities?.[f.key as keyof typeof job.facilities];
              const bgColor = isAvailable ? 'rgba(159, 255, 133, 0.5)' : 'rgba(255, 159, 159, 0.5)';
              const iconColor = isAvailable ? '#15B981' : '#DC2626';

              return (
                <View key={f.key} className="items-center flex-1">
                  <View
                    style={{
                      height: 64,
                      width: 64,
                      borderRadius: 32,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: bgColor,
                      shadowColor: '#000',
                      shadowOpacity: 0.04,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 6 },
                      elevation: 2,
                    }}
                  >
                    <Ionicons name={f.icon} size={26} color={iconColor} />
                  </View>
                  <Text style={{ color: '#6B7280', fontWeight: '600', marginTop: 12, textAlign: 'center', fontSize: 12, fontFamily: 'DMSans-SemiBold' }}>{f.label}</Text>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', marginTop: 4, color: isAvailable ? '#15B981' : '#DC2626', fontFamily: 'DMSans-Bold' }}>
                    {isAvailable ? 'Yes' : 'No'}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View className="px-5 pb-6">
          <View className={`flex-row ${isNarrow ? 'flex-col' : 'items-center'}`}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={{ backgroundColor: '#130160' }}
              className={`${isNarrow ? 'w-full' : 'flex-1'} rounded-xl py-4 items-center justify-center`}
              onPress={() => router.push({ pathname: '/(hospital)/(tabs)/jobApplications/[id]', params: { id: job.id } })}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontFamily: 'DMSans-Bold' }}>View Applicants ({job.applicants})</Text>
            </TouchableOpacity>

            <View className={isNarrow ? 'h-3' : 'w-4'} />

            <View className={`${isNarrow ? 'w-full flex-row' : 'flex-row'}`}>
              <TouchableOpacity
                activeOpacity={0.85}
                className={`${isNarrow ? 'flex-1' : ''} bg-blue-100 rounded-xl h-14 w-14 items-center justify-center`}
                onPress={() => router.push({ pathname: '/(hospital)/postJob/jobDetails', params: { id: job.id, mode: 'edit' } })}
              >
                <Ionicons name="create-outline" size={22} color="#1e3a8a" />
              </TouchableOpacity>

              <View className={isNarrow ? 'w-3' : 'w-3'} />

              <TouchableOpacity
                activeOpacity={0.85}
                className={`${isNarrow ? 'flex-1' : ''} bg-red-100 rounded-xl h-14 w-14 items-center justify-center`}
                onPress={() => {
                  Alert.alert(
                    'Close Job',
                    'Are you sure you want to close this job? You can restore it later from Trash.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Close Job',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            const { hospitalApi } = require('@/services/api');
                            const res = await hospitalApi.closeJob(job.id);
                            if (res.success) {
                              router.replace('/(hospital)/(tabs)/jobs');
                            } else {
                              Alert.alert('Error', 'Failed to close job');
                            }
                          } catch (error) {
                            Alert.alert('Error', 'An error occurred');
                            console.error(error);
                          }
                        }
                      }
                    ]
                  );
                }}
              >
                <Ionicons name="close" size={24} color="#DC2626" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
