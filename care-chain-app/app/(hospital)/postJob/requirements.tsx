import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown } from 'react-native-element-dropdown';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CUSTOM_QUALS_KEY = 'hospital_custom_qualifications';
const CUSTOM_SKILLS_KEY = 'hospital_custom_skills';

const DEFAULT_QUALIFICATIONS = [
  { id: 'md', label: 'MD (Medical Doctor)' },
  { id: 'do', label: 'DO (Doctor of Osteopathy)' },
  { id: 'mbbs', label: 'MBBS (Bachelor of Medicine)' },
];

const DEFAULT_SKILLS = [
  { id: 'surgical', label: 'Surgical Procedures' },
  { id: 'diagnostic', label: 'Diagnostic Skills' },
  { id: 'patient-care', label: 'Patient Care' },
  { id: 'emergency', label: 'Emergency Response' },
];

export default function RequirementsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [selectedQualifications, setSelectedQualifications] = useState<string[]>(
    params.qualifications ? (params.qualifications as string).split(',') : []
  );
  const [customQualification, setCustomQualification] = useState((params.customQualification as string) || '');
  const [selectedSkills, setSelectedSkills] = useState<string[]>(
    params.skills ? (params.skills as string).split(',') : []
  );
  const [customSkill, setCustomSkill] = useState((params.customSkill as string) || '');
  const [experience, setExperience] = useState((params.experience as string) || 'One Year');
  const [isFocus, setIsFocus] = useState(false);

  const experienceData = [
    { label: 'Less than 1 Year', value: 'Less than 1 Year' },
    { label: 'One Year', value: 'One Year' },
    { label: 'Two Years', value: 'Two Years' },
    { label: '3-5 Years', value: '3-5 Years' },
    { label: '5+ Years', value: '5+ Years' },
  ];

  // Helper to parse initial custom items from params
  const getInitialQualifications = () => {
    const defaultIds = DEFAULT_QUALIFICATIONS.map(q => q.id);
    const paramQuals = params.qualifications ? (params.qualifications as string).split(',') : [];

    // Filter out standard IDs from params
    const customQuals = paramQuals.filter(id => !defaultIds.includes(id));

    return [
      ...DEFAULT_QUALIFICATIONS,
      ...customQuals.map(id => ({ id, label: id })) // Assume ID is label for custom ones
    ];
  };

  const [availableQualifications, setAvailableQualifications] = useState(getInitialQualifications());

  // Helper to parse initial custom skills from params
  const getInitialSkills = () => {
    const defaultIds = DEFAULT_SKILLS.map(s => s.id);
    const paramSkills = params.skills ? (params.skills as string).split(',') : [];
    const customSkills = paramSkills.filter(id => !defaultIds.includes(id));

    return [
      ...DEFAULT_SKILLS,
      ...customSkills.map(id => ({ id, label: id }))
    ];
  };

  const [availableSkills, setAvailableSkills] = useState(getInitialSkills());

  // Load saved custom items on mount
  React.useEffect(() => {
    const loadSavedItems = async () => {
      try {
        const savedQuals = await AsyncStorage.getItem(CUSTOM_QUALS_KEY);
        const savedSkills = await AsyncStorage.getItem(CUSTOM_SKILLS_KEY);

        if (savedQuals) {
          const parsedQuals = JSON.parse(savedQuals);
          setAvailableQualifications(prev => {
            // Filter out items that exist in PREV (state) OR exist in DEFAULTS (by label or ID)
            const newQuals = parsedQuals.filter((q: any) => {
              const existsInState = prev.some(p => p.id === q.id || p.label.toLowerCase() === q.label.toLowerCase());
              const existsInDefaults = DEFAULT_QUALIFICATIONS.some(d => d.id === q.id || d.label.toLowerCase() === q.label.toLowerCase());
              // Matches standard abbreviation? e.g. 'mbbs'
              const matchesAbbrev = DEFAULT_QUALIFICATIONS.some(d => d.id.toLowerCase() === q.label.toLowerCase());

              return !existsInState && !existsInDefaults && !matchesAbbrev;
            });
            return [...prev, ...newQuals];
          });
        }

        if (savedSkills) {
          const parsedSkills = JSON.parse(savedSkills);
          setAvailableSkills(prev => {
            const newSkills = parsedSkills.filter((s: any) => {
              const existsInState = prev.some(p => p.id === s.id || p.label.toLowerCase() === s.label.toLowerCase());
              const existsInDefaults = DEFAULT_SKILLS.some(d => d.id === s.id || d.label.toLowerCase() === s.label.toLowerCase());
              return !existsInState && !existsInDefaults;
            });
            return [...prev, ...newSkills];
          });
        }
      } catch (error) {
        console.error('Failed to load custom items', error);
      }
    };
    loadSavedItems();
  }, []);

  const toggleQualification = (id: string) => {
    setSelectedQualifications((prev) =>
      prev.includes(id) ? prev.filter((q) => q !== id) : [...prev, id]
    );
  };

  const toggleSkill = (id: string) => {
    setSelectedSkills((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleAddQualification = () => {
    const label = customQualification.trim();
    if (!label) return;

    // Check if already exists in available qualifications (by Label or ID)
    // Also check against DEFAULT constants explicitly
    const existsInDefaults = DEFAULT_QUALIFICATIONS.some(d =>
      d.label.toLowerCase() === label.toLowerCase() ||
      d.id.toLowerCase() === label.toLowerCase() // e.g. typing 'mbbs' matches id 'mbbs'
    );

    if (existsInDefaults) {
      const def = DEFAULT_QUALIFICATIONS.find(d => d.label.toLowerCase() === label.toLowerCase() || d.id.toLowerCase() === label.toLowerCase());
      if (def && !selectedQualifications.includes(def.id)) {
        setSelectedQualifications(prev => [...prev, def.id]);
      }
      setCustomQualification('');
      return;
    }

    if (availableQualifications.some(q => q.label.toLowerCase() === label.toLowerCase())) {
      // If exists but not selected, select it
      const existing = availableQualifications.find(q => q.label.toLowerCase() === label.toLowerCase());
      if (existing && !selectedQualifications.includes(existing.id)) {
        setSelectedQualifications(prev => [...prev, existing.id]);
      }
      setCustomQualification('');
      return;
    }

    // Use label as ID, strictly replacing commas to avoid parsing issues in URL parameters
    const newId = label.replace(/,/g, ' ');

    const newItem = { id: newId, label: label };

    setAvailableQualifications((prev) => {
      const updated = [...prev, newItem];
      // Save only custom ones (those not in default list) or just append to storage
      // Simpler: store all custom ones.
      // We need to identify strictly custom ones to save, or just save the newItem.
      // Let's just append the new item to the stored list.
      AsyncStorage.getItem(CUSTOM_QUALS_KEY).then(stored => {
        const current = stored ? JSON.parse(stored) : [];
        if (!current.some((c: any) => c.id === newItem.id)) {
          AsyncStorage.setItem(CUSTOM_QUALS_KEY, JSON.stringify([...current, newItem]));
        }
      });
      return updated;
    });
    setSelectedQualifications((prev) => [...prev, newId]);
    setCustomQualification('');
  };

  const handleAddSkill = () => {
    const label = customSkill.trim();
    if (!label) return;

    // Check for defaults first
    const existsInDefaults = DEFAULT_SKILLS.some(d =>
      d.label.toLowerCase() === label.toLowerCase() ||
      d.id.toLowerCase() === label.toLowerCase()
    );

    if (existsInDefaults) {
      const def = DEFAULT_SKILLS.find(d => d.label.toLowerCase() === label.toLowerCase() || d.id.toLowerCase() === label.toLowerCase());
      if (def && !selectedSkills.includes(def.id)) {
        setSelectedSkills(prev => [...prev, def.id]);
      }
      setCustomSkill('');
      return;
    }

    // Check if already exists
    if (availableSkills.some(s => s.label.toLowerCase() === label.toLowerCase())) {
      const existing = availableSkills.find(s => s.label.toLowerCase() === label.toLowerCase());
      if (existing && !selectedSkills.includes(existing.id)) {
        setSelectedSkills(prev => [...prev, existing.id]);
      }
      setCustomSkill('');
      return;
    }

    const newId = label.replace(/,/g, ' ');

    const newItem = { id: newId, label: label };

    setAvailableSkills((prev) => {
      const updated = [...prev, newItem];
      AsyncStorage.getItem(CUSTOM_SKILLS_KEY).then(stored => {
        const current = stored ? JSON.parse(stored) : [];
        if (!current.some((c: any) => c.id === newItem.id)) {
          AsyncStorage.setItem(CUSTOM_SKILLS_KEY, JSON.stringify([...current, newItem]));
        }
      });
      return updated;
    });
    setSelectedSkills((prev) => [...prev, newId]);
    setCustomSkill('');
  };

  const handleNext = () => {
    router.push({
      pathname: '/(hospital)/postJob/review',
      params: {
        ...params,
        qualifications: selectedQualifications.join(','),
        // We generally don't need to pass customQualification string if we've added it to the list
        // But for backward compatibility or if backend expects it separately, we can leave it or just ignore it.
        // The prompt implies "add it and save it". If we add to list, it becomes part of selectedQualifications.
        // We should ensure the review screen handles custom IDs or labels correctly.
        // For now, I'll clear the custom input so we don't need to pass the partial text.
        customQualification: '',
        skills: selectedSkills.join(','),
        customSkill: '',
        experience,
      },
    });
  };

  const handlePrevious = () => {
    router.push({
      pathname: '/(hospital)/postJob/candidateSupport',
      params: {
        ...params,
        qualifications: selectedQualifications.join(','),
        customQualification: '',
        skills: selectedSkills.join(','),
        customSkill: '',
        experience,
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

          <Text className="text-xl font-semibold text-gray-900 mb-1">
            Job Requirements
          </Text>
          <Text className="text-sm text-gray-500 mb-6">
            Specify the qualifications and skills needed
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
            <View className="w-8 h-8 rounded-full bg-brand-primary items-center justify-center">
              <Text className="text-white font-semibold text-sm">3</Text>
            </View>
            <View className="flex-1 h-0.5 bg-gray-200 mx-2" />
            <View className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center">
              <Text className="text-gray-400 font-semibold text-sm">4</Text>
            </View>
          </View>

          <View className="flex-row mb-4">
            <Text className="text-xs text-gray-600 flex-1">Job Details</Text>
            <Text className="text-xs text-gray-600 flex-1 text-center">
              Candidate Support
            </Text>
            <Text className="text-xs text-gray-900 font-medium flex-1 text-center">
              Requirements
            </Text>
            <Text className="text-xs text-gray-400 flex-1 text-right">Review</Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <View className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <Text className="text-base font-semibold text-gray-900 mb-4">
            Candidate Skill Information
          </Text>

          <Text className="text-sm text-gray-700 mb-3">Required Qualifications</Text>

          {availableQualifications.map((qual) => (
            <TouchableOpacity
              key={qual.id}
              onPress={() => toggleQualification(qual.id)}
              className="flex-row items-center border border-gray-200 rounded-lg px-4 py-3 mb-3"
              activeOpacity={0.7}
            >
              <View
                className={`w-5 h-5 rounded-full border-2 items-center justify-center mr-3 ${selectedQualifications.includes(qual.id)
                  ? 'border-brand-primary bg-brand-primary'
                  : 'border-gray-300'
                  }`}
              >
                {selectedQualifications.includes(qual.id) && (
                  <View className="w-2 h-2 rounded-full bg-white" />
                )}
              </View>
              <Text className="text-gray-900 text-sm flex-1">{qual.label}</Text>
            </TouchableOpacity>
          ))}

          <View className="flex-row items-center mb-5 gap-2">
            <TextInput
              value={customQualification}
              onChangeText={setCustomQualification}
              placeholder="Add New Qualification"
              placeholderTextColor="#9ca3af"
              className="flex-1 border border-gray-200 rounded-lg px-4 py-3 text-gray-900"
            />
            <TouchableOpacity
              onPress={handleAddQualification}
              className={`h-[50px] px-4 rounded-lg flex-row items-center justify-center ${customQualification.trim() ? 'bg-brand-primary' : 'bg-gray-300'
                }`}
              disabled={!customQualification.trim()}
            >
              <Ionicons name="add" size={24} color="white" />
              <Text className="text-white font-semibold ml-1">Add</Text>
            </TouchableOpacity>
          </View>

          <Text className="text-sm text-gray-700 mb-3">Required Skills</Text>

          {availableSkills.map((skill) => (
            <TouchableOpacity
              key={skill.id}
              onPress={() => toggleSkill(skill.id)}
              className="flex-row items-center border border-gray-200 rounded-lg px-4 py-3 mb-3"
              activeOpacity={0.7}
            >
              <View
                className={`w-5 h-5 rounded-full border-2 items-center justify-center mr-3 ${selectedSkills.includes(skill.id)
                  ? 'border-brand-primary bg-brand-primary'
                  : 'border-gray-300'
                  }`}
              >
                {selectedSkills.includes(skill.id) && (
                  <View className="w-2 h-2 rounded-full bg-white" />
                )}
              </View>
              <Text className="text-gray-900 text-sm flex-1">{skill.label}</Text>
            </TouchableOpacity>
          ))}

          <View className="flex-row items-center mb-5 gap-2">
            <TextInput
              value={customSkill}
              onChangeText={setCustomSkill}
              placeholder="Add New Skill"
              placeholderTextColor="#9ca3af"
              className="flex-1 border border-gray-200 rounded-lg px-4 py-3 text-gray-900"
            />
            <TouchableOpacity
              onPress={handleAddSkill}
              className={`h-[50px] px-4 rounded-lg flex-row items-center justify-center ${customSkill.trim() ? 'bg-brand-primary' : 'bg-gray-300'
                }`}
              disabled={!customSkill.trim()}
            >
              <Ionicons name="add" size={24} color="white" />
              <Text className="text-white font-semibold ml-1">Add</Text>
            </TouchableOpacity>
          </View>

          <Text className="text-sm text-gray-700 mb-2">Experience</Text>
          <Dropdown
            style={[styles.dropdown, isFocus && { borderColor: 'blue' }]}
            placeholderStyle={styles.placeholderStyle}
            selectedTextStyle={styles.selectedTextStyle}
            inputSearchStyle={styles.inputSearchStyle}
            iconStyle={styles.iconStyle}
            data={experienceData}
            search={false}
            maxHeight={300}
            labelField="label"
            valueField="value"
            placeholder={!isFocus ? 'Select Experience' : '...'}
            value={experience}
            onFocus={() => setIsFocus(true)}
            onBlur={() => setIsFocus(false)}
            onChange={item => {
              setExperience(item.value);
              setIsFocus(false);
            }}
          />
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

const styles = StyleSheet.create({
  dropdown: {
    height: 50,
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  placeholderStyle: {
    fontSize: 14,
    color: '#9ca3af',
  },
  selectedTextStyle: {
    fontSize: 14,
    color: '#111827',
  },

  iconStyle: {
    width: 20,
    height: 20,
  },
  inputSearchStyle: {
    height: 40,
    fontSize: 14,
  },
});
