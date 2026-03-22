import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  ImageBackground,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useDoctorProfile, DoctorProfile } from '@/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { doctorApi } from '@/services/api';
import { MEDICAL_SPECIALIZATIONS } from '@/constants/medicalSpecializations';
import { INDIAN_STATES, getCitiesByState } from '@/constants/indianStatesAndCities';
import { StateCitySelector } from '@/app/_components/StateCitySelector';
import { createAvatarFormData } from '@/utils/upload';

type SectionKey = 'personal' | 'education' | 'licensure' | 'skills' | 'experience' | 'jobPreference' | null;
type ProfileSectionKey =
  | 'personal'
  | 'education'
  | 'licensure'
  | 'skills'
  | 'experience'
  | 'preferences'
  | 'documents';

// Helper to get profile completion percentage
const getProfileCompletion = (profile: DoctorProfile | null) => {
  if (!profile) return { percentage: 0 };
  const completion = profile.profileCompletion;
  if (typeof completion === 'number') return { percentage: completion };
  if (completion && typeof completion === 'object') {
    return { percentage: completion.percentage || 0 };
  }
  return { percentage: 0 };
};

const getProfileSections = (profile: DoctorProfile | null | undefined) => {
  const sections = profile?.profileCompletionDetails?.sections;
  if (sections && typeof sections === 'object') return sections;

  const completion: any = profile?.profileCompletion;
  if (completion && typeof completion === 'object' && completion.sections && typeof completion.sections === 'object') {
    return completion.sections;
  }
  return undefined;
};

const isSectionComplete = (profile: DoctorProfile | null | undefined, section: ProfileSectionKey) => {
  const sections: any = getProfileSections(profile);
  const fromBackend = sections?.[section];
  const infer = () => {
    switch (section) {
      case 'personal':
        return Boolean(
          profile?.firstName &&
          profile?.lastName &&
          profile?.gender &&
          (profile?.location?.city || profile?.address?.city) &&
          (profile?.location?.state || profile?.address?.state)
        );
      case 'education':
        return (profile?.education?.length || 0) > 0;
      case 'skills':
        return (profile?.skills?.length || 0) > 0;
      case 'experience':
        return (profile?.experience?.length || 0) > 0;
      case 'preferences':
        return Boolean(
          profile?.jobPreferences &&
          (
            profile.jobPreferences.expectedHourlyRate ||
            profile.jobPreferences.expectedDailyRate ||
            (profile.jobPreferences.preferredLocations?.length || 0) > 0
          )
        );
      case 'licensure':
        return Boolean((sections as any)?.licensure);
      case 'documents':
        return Boolean((sections as any)?.documents);
      default:
        return false;
    }
  };

  // If backend says true, trust it. If it says false, still infer to avoid stale flags.
  if (fromBackend === true) return true;
  return infer();
};

const toDateOrNull = (value: any): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatDateLabel = (value: Date | null | undefined) => {
  if (!value) return 'Select date';
  return value.toISOString().slice(0, 10);
};

export default function EditProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string }>();
  const { profile, isLoading, refresh, updatePersonalInfo, addEducation, addExperience, addSkill } = useDoctorProfile();
  const { refreshUser } = useAuth();
  const [editProfile, setEditProfile] = useState<any>(null);
  const [loadingEditProfile, setLoadingEditProfile] = useState(false);
  const [expandedSection, setExpandedSection] = useState<SectionKey>(null);

  // Auto-expand section from params
  useEffect(() => {
    if (params.section) {
      setExpandedSection(params.section as SectionKey);
    }
  }, [params.section]);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const [datePicker, setDatePicker] = useState<{ key: string | null; visible: boolean }>({
    key: null,
    visible: false,
  });

  // Personal Info Form State
  const [personalInfo, setPersonalInfo] = useState({
    firstName: '',
    lastName: '',
    gender: '',
    specialization: '',
    bio: '',
    address: { street: '', city: '', state: '', pincode: '', country: 'India' },
  });

  const [aadhaarNumber, setAadhaarNumber] = useState('');

  type LicenseForm = {
    registrationNumber: string;
    issuingAuthority: string;
    validFrom: Date | null;
    validTill: Date | null;
  };

  const emptyLicenseForm: LicenseForm = {
    registrationNumber: '',
    issuingAuthority: '',
    validFrom: null,
    validTill: null,
  };

  const [newLicense, setNewLicense] = useState<LicenseForm>(emptyLicenseForm);
  const [editingLicenseId, setEditingLicenseId] = useState<string | null>(null);
  const [licenseEdit, setLicenseEdit] = useState<LicenseForm>(emptyLicenseForm);

  // New Education Form State
  const [newEducation, setNewEducation] = useState({
    institution: '',
    degree: '',
    specialization: '',
    startYear: '',
    endYear: '',
  });

  const [editingEducationId, setEditingEducationId] = useState<string | null>(null);
  const [educationEdit, setEducationEdit] = useState({
    institution: '',
    degree: '',
    specialization: '',
    startYear: '',
    endYear: '',
  });

  // New Skill Form State
  const [newSkill, setNewSkill] = useState({
    name: '',
    level: 'intermediate' as 'beginner' | 'intermediate' | 'advanced' | 'expert',
    certifyingAuthority: '',
    validTill: null as Date | null,
    experienceYears: '',
  });

  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [skillEdit, setSkillEdit] = useState({
    name: '',
    level: 'intermediate' as 'beginner' | 'intermediate' | 'advanced' | 'expert',
    certifyingAuthority: '',
    validTill: null as Date | null,
    experienceYears: '',
  });

  // New Experience Form State
  const [newExperience, setNewExperience] = useState({
    role: '',
    institution: '',
    department: '',
    startDate: null as Date | null,
    endDate: null as Date | null,
    isCurrent: false,
  });

  const [editingExperienceId, setEditingExperienceId] = useState<string | null>(null);
  const [experienceEdit, setExperienceEdit] = useState({
    role: '',
    institution: '',
    department: '',
    startDate: null as Date | null,
    endDate: null as Date | null,
    isCurrent: false,
  });

  // Preferences Form State
  const [preferences, setPreferences] = useState({
    jobTypes: [] as string[],
    minRate: '',
    rateUnit: 'per_hour', // 'per_hour', 'per_day', 'per_month', 'per_patient'
    travelRadius: 10,
    preferredCity: '',
    preferredState: '',
    experienceYears: '',
    jobStatus: 'available', // 'available' | 'open_to_work' | 'not_available'
    willingToRelocate: false,
  });

  // Autocomplete state
  const [specializationSuggestions, setSpecializationSuggestions] = useState<string[]>([]);
  const [showSpecializationDropdown, setShowSpecializationDropdown] = useState(false);
  const [availableCities, setAvailableCities] = useState<string[]>([]);

  // Phone OTP state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [phoneSavedNumber, setPhoneSavedNumber] = useState('');
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
  const [verifyingPhoneOtp, setVerifyingPhoneOtp] = useState(false);
  const [showPhoneOtpInput, setShowPhoneOtpInput] = useState(false);

  // Education with document state
  const [pendingEducationDoc, setPendingEducationDoc] = useState<any>(null);

  // Skill with document state
  const [pendingSkillDoc, setPendingSkillDoc] = useState<any>(null);

  // License with document state
  const [pendingLicenseDoc, setPendingLicenseDoc] = useState<any>(null);

  // Experience with document state
  const [pendingExperienceDoc, setPendingExperienceDoc] = useState<any>(null);

  const refreshEditProfile = async () => {
    try {
      setLoadingEditProfile(true);
      const res = await doctorApi.getEditProfile();
      if (res?.success) {
        const data = (res as any).data || res;
        const doctor = data?.profile || data?.doctor || data;
        if (doctor) setEditProfile(doctor);
      }
    } catch (e) {
      // Non-blocking: edit DTO is optional for core screen
      console.warn('Failed to load edit profile DTO', e);
    } finally {
      setLoadingEditProfile(false);
    }
  };

  // Load profile data into forms
  useEffect(() => {
    if (profile) {
      // Initialize firstName and lastName
      let firstName = profile.firstName || '';
      let lastName = profile.lastName || '';

      // If firstName/lastName are empty, try to split from name or displayName
      if (!firstName && !lastName) {
        const fullName = profile.name || profile.displayName || '';
        const nameParts = fullName.trim().split(' ');
        if (nameParts.length > 0) {
          firstName = nameParts[0];
          lastName = nameParts.slice(1).join(' ');
        }
      }

      setPersonalInfo({
        firstName,
        lastName,
        gender: profile.gender || '',
        specialization: profile.specialization || '',
        bio: profile.bio || '',
        address: {
          street: profile.address?.street || '',
          city: profile.location?.city || profile.address?.city || '',
          state: profile.location?.state || profile.address?.state || '',
          pincode: profile.address?.pincode || profile.address?.postalCode || '',
          country: profile.address?.country || 'India',
        },
      });

      // Set available cities based on current state
      const currentState = profile.location?.state || profile.address?.state || '';
      if (currentState) {
        const cities = getCitiesByState(currentState);
        setAvailableCities(cities);
      }

      // Set phone info
      if (profile.phoneNumber) {
        setPhoneSavedNumber(profile.phoneNumber);
        setIsPhoneVerified(profile.isPhoneVerified || false);
      }

      const prefs = profile.jobPreferences;
      if (prefs) {
        const jobTypes: string[] = [];
        if (prefs.longTermJobs) jobTypes.push('Long Term');
        if (prefs.shortTermJobs) jobTypes.push('Short Term');

        const firstLoc = prefs.preferredLocations?.[0];

        let rate = '';
        let unit = prefs.paymentPreference || 'per_hour';

        if (unit === 'per_month' || (prefs as any).expectedMonthlyRate) {
          rate = String((prefs as any).expectedMonthlyRate || '');
          unit = 'per_month';
        } else if (unit === 'per_patient' || (prefs as any).expectedPerPatientRate) {
          rate = String((prefs as any).expectedPerPatientRate || '');
          unit = 'per_patient';
        } else if (unit === 'per_day' || prefs.expectedDailyRate) {
          rate = String(prefs.expectedDailyRate || '');
          unit = 'per_day';
        } else {
          rate = String(prefs.expectedHourlyRate || '');
          unit = 'per_hour';
        }

        setPreferences({
          jobTypes,
          minRate: rate,
          rateUnit: unit,
          travelRadius: typeof firstLoc?.maxDistance === 'number' ? firstLoc.maxDistance : 10,
          preferredCity: firstLoc?.city || '',
          preferredState: firstLoc?.state || '',
          experienceYears: typeof (prefs as any).experienceYears === 'number' ? String((prefs as any).experienceYears) : '',
          jobStatus: (prefs as any).jobStatus || 'available',
          willingToRelocate: (prefs as any).willingToRelocate || false,
        });
      }
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    void refreshEditProfile();
  }, [profile?.email]);

  useEffect(() => {
    if (!editProfile) return;

    const aadhaarMasked = editProfile?.personal?.aadhaar?.maskedNumber;
    if (typeof aadhaarMasked === 'string' && !aadhaarNumber) {
      // Keep input blank (we don't want to re-show sensitive number), but this prevents confusing empty UI.
      setAadhaarNumber('');
    }

    // Load phone info from editProfile
    const phoneInfo = editProfile?.phone;
    if (phoneInfo) {
      if (phoneInfo.number) {
        setPhoneSavedNumber(phoneInfo.number);
      }
      setIsPhoneVerified(phoneInfo.isVerified || false);
    }

    const prefs = editProfile?.jobPreferences;
    if (prefs) {
      const jobTypes: string[] = [];
      if (prefs.longTermJobs) jobTypes.push('Long Term');
      if (prefs.shortTermJobs) jobTypes.push('Short Term');

      const firstLoc = prefs.preferredLocations?.[0];
      setPreferences((prev) => ({
        ...prev,
        jobTypes,
        minRate: typeof prefs.expectedHourlyRate === 'number' ? String(prefs.expectedHourlyRate) : '',
        travelRadius: typeof firstLoc?.maxDistance === 'number' ? firstLoc.maxDistance : prev.travelRadius,
        preferredCity: firstLoc?.city || prev.preferredCity,
        preferredState: firstLoc?.state || prev.preferredState,
        experienceYears: typeof prefs.experienceYears === 'number' ? String(prefs.experienceYears) : prev.experienceYears,
        jobStatus: prefs.jobStatus || prev.jobStatus || 'available',
        willingToRelocate: prefs.willingToRelocate ?? prev.willingToRelocate ?? false,
      }));
    }
  }, [editProfile]);

  const toggleSection = (section: SectionKey) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      multiple: false,
      copyToCacheDirectory: true,
    });

    if (result.canceled) return null;
    const asset = result.assets?.[0];
    if (!asset?.uri) return null;
    return asset;
  };

  const openDatePicker = (key: string) => {
    setDatePicker({ key, visible: true });
  };

  const onDatePicked = (key: string | null, date?: Date) => {
    if (!key || !date) return;
    switch (key) {
      case 'experienceStart':
        setNewExperience((prev) => ({ ...prev, startDate: date }));
        break;
      case 'experienceEnd':
        setNewExperience((prev) => ({ ...prev, endDate: date }));
        break;
      case 'skillValidTill':
        setNewSkill((prev) => ({ ...prev, validTill: date }));
        break;
      case 'skillEditValidTill':
        setSkillEdit((prev) => ({ ...prev, validTill: date }));
        break;
      case 'licenseNewValidFrom':
        setNewLicense((prev) => ({ ...prev, validFrom: date }));
        break;
      case 'licenseNewValidTill':
        setNewLicense((prev) => ({ ...prev, validTill: date }));
        break;
      case 'licenseEditValidFrom':
        setLicenseEdit((prev) => ({ ...prev, validFrom: date }));
        break;
      case 'licenseEditValidTill':
        setLicenseEdit((prev) => ({ ...prev, validTill: date }));
        break;
      case 'experienceEditStart':
        setExperienceEdit((prev) => ({ ...prev, startDate: date }));
        break;
      case 'experienceEditEnd':
        setExperienceEdit((prev) => ({ ...prev, endDate: date }));
        break;
      default:
        break;
    }
  };

  // ============ Avatar Upload ============
  const handleAvatarUpload = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploadingAvatar(true);
        const asset = result.assets[0];

        // Use utility to create FormData with correct extension/mime-type
        const formData = createAvatarFormData(
          asset.uri,
          asset.mimeType || 'image/jpeg'
        );

        const response = await doctorApi.uploadAvatar(formData);

        if (response.success) {
          Alert.alert('Success', 'Avatar updated successfully');
          await refresh();
        } else {
          Alert.alert('Error', response.message || 'Failed to upload avatar');
        }
      }
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      Alert.alert('Error', err.message || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ============ Save Personal Info ============
  const handleSavePersonalInfo = async () => {
    // Validation
    if (!personalInfo.firstName || !personalInfo.lastName) {
      Alert.alert('Required', 'Please enter both first name and last name');
      return;
    }

    if (!personalInfo.specialization) {
      Alert.alert('Required', 'Please enter your specialization');
      return;
    }

    if (!personalInfo.gender) {
      Alert.alert('Required', 'Please select your gender');
      return;
    }

    try {
      setSaving(true);
      const response = await doctorApi.updatePersonalInfo({
        firstName: personalInfo.firstName,
        lastName: personalInfo.lastName,
        gender: personalInfo.gender,
        specialization: personalInfo.specialization,
        bio: personalInfo.bio,
        address: personalInfo.address,
      });

      if (response.success) {
        Alert.alert('Success', 'Personal info updated successfully');
        await refresh();
        await refreshUser();
        setExpandedSection(null);
      } else {
        Alert.alert('Error', response.message || 'Failed to update');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAadhaar = async () => {
    if (!aadhaarNumber || aadhaarNumber.replace(/\s/g, '').length < 12) {
      Alert.alert('Required', 'Please enter a valid Aadhaar number');
      return;
    }

    try {
      setSaving(true);
      const response = await doctorApi.updateAadhaarInfo(aadhaarNumber.replace(/\s/g, ''));
      if (response.success) {
        Alert.alert('Success', 'Aadhaar updated successfully');
        setAadhaarNumber('');
        await refreshEditProfile();
        await refresh();
      } else {
        Alert.alert('Error', response.message || 'Failed to update Aadhaar');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update Aadhaar');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadAadhaarDocument = async () => {
    try {
      const asset = await pickDocument();
      if (!asset) return;

      setUploadingKey('aadhaar');
      const formData = new FormData();
      formData.append('document', {
        uri: asset.uri,
        type: asset.mimeType || 'application/octet-stream',
        name: asset.name || 'aadhaar_document',
      } as any);

      const response = await doctorApi.uploadAadhaarDocument(formData);
      if (response.success) {
        Alert.alert('Success', 'Aadhaar document uploaded');
        await refreshEditProfile();
        await refresh();
      } else {
        Alert.alert('Error', response.message || 'Failed to upload');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to upload document');
    } finally {
      setUploadingKey(null);
    }
  };

  // ============ Phone OTP Verification ============
  const handleSendPhoneOtp = async () => {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid', 'Please enter a valid 10-digit phone number');
      return;
    }

    try {
      setSendingPhoneOtp(true);
      const response = await doctorApi.sendPhoneOtp(cleanPhone);
      if (response.success) {
        Alert.alert('OTP Sent', 'An OTP has been sent to your phone number');
        setShowPhoneOtpInput(true);
      } else {
        Alert.alert('Error', response.message || 'Failed to send OTP');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send OTP');
    } finally {
      setSendingPhoneOtp(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (!phoneOtp || phoneOtp.length !== 6) {
      Alert.alert('Invalid', 'Please enter a valid 6-digit OTP');
      return;
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');

    try {
      setVerifyingPhoneOtp(true);
      const response = await doctorApi.verifyPhoneOtp(cleanPhone, phoneOtp);
      if (response.success) {
        Alert.alert('Success', 'Phone number verified successfully');
        setPhoneSavedNumber(cleanPhone);
        setIsPhoneVerified(true);
        setPhoneNumber('');
        setPhoneOtp('');
        setShowPhoneOtpInput(false);
        await refreshEditProfile();
        await refresh();
      } else {
        Alert.alert('Error', response.message || 'Failed to verify OTP');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to verify OTP');
    } finally {
      setVerifyingPhoneOtp(false);
    }
  };

  // ============ Add Education with Document ============
  const handleAddEducationWithDoc = async () => {
    if (!newEducation.institution || !newEducation.degree) {
      Alert.alert('Required', 'Please fill institution and degree');
      return;
    }

    if (!pendingEducationDoc) {
      Alert.alert('Document Required', 'Please upload a marksheet/certificate before saving');
      return;
    }

    try {
      setSaving(true);
      // First add education
      const response = await doctorApi.addEducation({
        institution: newEducation.institution,
        degree: newEducation.degree,
        specialization: newEducation.specialization || undefined,
        startYear: parseInt(newEducation.startYear) || undefined,
        endYear: parseInt(newEducation.endYear) || undefined,
      });

      if (response.success) {
        // Get the new education ID and upload document
        const newEduId = response.data?.profile?.education?.slice(-1)?.[0]?.id;
        if (newEduId && pendingEducationDoc) {
          const formData = new FormData();
          formData.append('document', {
            uri: pendingEducationDoc.uri,
            type: pendingEducationDoc.mimeType || 'application/octet-stream',
            name: pendingEducationDoc.name || 'education_document',
          } as any);

          await doctorApi.uploadEducationDocument(newEduId, formData);
        }

        Alert.alert('Success', 'Education added with document');
        setNewEducation({ institution: '', degree: '', specialization: '', startYear: '', endYear: '' });
        setPendingEducationDoc(null);
        await refresh();
        await refreshEditProfile();
      } else {
        Alert.alert('Error', response.message || 'Failed to add');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add education');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectEducationDoc = async () => {
    const asset = await pickDocument();
    if (asset) {
      setPendingEducationDoc(asset);
    }
  };

  // ============ Add License with Document ============
  const handleAddLicenseWithDoc = async () => {
    if (!newLicense.registrationNumber || !newLicense.issuingAuthority) {
      Alert.alert('Required', 'Please fill registration number and issuing authority');
      return;
    }
    if (!newLicense.validFrom) {
      Alert.alert('Required', 'Please select valid from date');
      return;
    }

    if (!pendingLicenseDoc) {
      Alert.alert('Document Required', 'Please upload license document before saving');
      return;
    }

    try {
      setSaving(true);
      const response = await doctorApi.addLicense({
        registrationNumber: newLicense.registrationNumber,
        issuingAuthority: newLicense.issuingAuthority,
        validFrom: newLicense.validFrom.toISOString(),
        validTill: newLicense.validTill ? newLicense.validTill.toISOString() : undefined,
      });

      if (response.success) {
        // Get the new license ID and upload document
        const newLicenseId = response.data?.profile?.licenses?.slice(-1)?.[0]?.id;
        if (newLicenseId && pendingLicenseDoc) {
          const formData = new FormData();
          formData.append('document', {
            uri: pendingLicenseDoc.uri,
            type: pendingLicenseDoc.mimeType || 'application/octet-stream',
            name: pendingLicenseDoc.name || 'license_document',
          } as any);

          await doctorApi.uploadLicenseDocument(newLicenseId, formData);
        }

        Alert.alert('Success', 'License added with document');
        setNewLicense(emptyLicenseForm);
        setPendingLicenseDoc(null);
        await refresh();
        await refreshEditProfile();
      } else {
        Alert.alert('Error', response.message || 'Failed to add');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add license');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectLicenseDoc = async () => {
    const asset = await pickDocument();
    if (asset) {
      setPendingLicenseDoc(asset);
    }
  };

  // ============ Add Skill with Document ============
  const handleAddSkillWithDoc = async () => {
    if (!newSkill.name) {
      Alert.alert('Required', 'Please enter skill name');
      return;
    }

    if (!pendingSkillDoc) {
      Alert.alert('Document Required', 'Please upload certificate before saving');
      return;
    }

    try {
      setSaving(true);
      const response = await doctorApi.addSkill({
        name: newSkill.name,
        level: newSkill.level,
        certifyingAuthority: newSkill.certifyingAuthority || undefined,
        validTill: newSkill.validTill ? newSkill.validTill.toISOString() : undefined,
        experienceYears: newSkill.experienceYears ? Number(newSkill.experienceYears) : undefined,
      });

      if (response.success) {
        // Get the new skill ID and upload document
        const newSkillId = response.data?.profile?.skills?.slice(-1)?.[0]?.id;
        if (newSkillId && pendingSkillDoc) {
          const formData = new FormData();
          formData.append('document', {
            uri: pendingSkillDoc.uri,
            type: pendingSkillDoc.mimeType || 'application/octet-stream',
            name: pendingSkillDoc.name || 'skill_certificate',
          } as any);

          await doctorApi.uploadSkillCertificate(newSkillId, formData);
        }

        Alert.alert('Success', 'Skill added with certificate');
        setNewSkill({
          name: '',
          level: 'intermediate',
          certifyingAuthority: '',
          validTill: null,
          experienceYears: '',
        });
        setPendingSkillDoc(null);
        await refresh();
        await refreshEditProfile();
      } else {
        Alert.alert('Error', response.message || 'Failed to add');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add skill');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectSkillDoc = async () => {
    const asset = await pickDocument();
    if (asset) {
      setPendingSkillDoc(asset);
    }
  };

  // ============ Add Experience with Document ============
  const handleAddExperienceWithDoc = async () => {
    if (!newExperience.role || !newExperience.institution) {
      Alert.alert('Required', 'Please fill role and institution');
      return;
    }

    if (!newExperience.startDate) {
      Alert.alert('Required', 'Please select start date');
      return;
    }

    if (!pendingExperienceDoc) {
      Alert.alert('Document Required', 'Please upload experience letter/document before saving');
      return;
    }

    try {
      setSaving(true);
      const response = await doctorApi.addExperience({
        role: newExperience.role,
        institution: newExperience.institution,
        department: newExperience.department || undefined,
        startDate: newExperience.startDate.toISOString(),
        endDate: newExperience.isCurrent ? undefined : newExperience.endDate ? newExperience.endDate.toISOString() : undefined,
        isCurrent: newExperience.isCurrent,
      });

      if (response.success) {
        // Get the new experience ID and upload document
        const newExpId = response.data?.profile?.experience?.slice(-1)?.[0]?.id;
        if (newExpId && pendingExperienceDoc) {
          const formData = new FormData();
          formData.append('document', {
            uri: pendingExperienceDoc.uri,
            type: pendingExperienceDoc.mimeType || 'application/octet-stream',
            name: pendingExperienceDoc.name || 'experience_document',
          } as any);

          await doctorApi.uploadExperienceDocument(newExpId, formData);
        }

        Alert.alert('Success', 'Experience added with document');
        setNewExperience({
          role: '',
          institution: '',
          department: '',
          startDate: null,
          endDate: null,
          isCurrent: false,
        });
        setPendingExperienceDoc(null);
        await refresh();
        await refreshEditProfile();
      } else {
        Alert.alert('Error', response.message || 'Failed to add');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add experience');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectExperienceDoc = async () => {
    const asset = await pickDocument();
    if (asset) {
      setPendingExperienceDoc(asset);
    }
  };

  // ============ Add Education ============
  const handleAddEducation = async () => {
    if (!newEducation.institution || !newEducation.degree) {
      Alert.alert('Required', 'Please fill institution and degree');
      return;
    }

    try {
      setSaving(true);
      const response = await doctorApi.addEducation({
        institution: newEducation.institution,
        degree: newEducation.degree,
        specialization: newEducation.specialization || undefined,
        startYear: parseInt(newEducation.startYear) || undefined,
        endYear: parseInt(newEducation.endYear) || undefined,
      });

      if (response.success) {
        Alert.alert('Success', 'Education added successfully. You can upload a marksheet via the Upload button.');
        setNewEducation({ institution: '', degree: '', specialization: '', startYear: '', endYear: '' });
        await refresh();
        await refreshEditProfile();
      } else {
        Alert.alert('Error', response.message || 'Failed to add');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add education');
    } finally {
      setSaving(false);
    }
  };

  const startEditEducation = (edu: any) => {
    if (!edu?.id) return;
    setEditingEducationId(edu.id);
    setEducationEdit({
      institution: edu.institution || '',
      degree: edu.degree || '',
      specialization: edu.specialization || '',
      startYear: edu.startYear ? String(edu.startYear) : '',
      endYear: edu.endYear ? String(edu.endYear) : '',
    });
  };

  const cancelEditEducation = () => {
    setEditingEducationId(null);
  };

  const handleSaveEducationEdit = async () => {
    if (!editingEducationId) return;
    if (!educationEdit.institution || !educationEdit.degree) {
      Alert.alert('Required', 'Please fill institution and degree');
      return;
    }

    try {
      setSaving(true);
      const response = await doctorApi.updateEducation(editingEducationId, {
        institution: educationEdit.institution,
        degree: educationEdit.degree,
        specialization: educationEdit.specialization || undefined,
        startYear: parseInt(educationEdit.startYear) || undefined,
        endYear: parseInt(educationEdit.endYear) || undefined,
      });

      if (response.success) {
        setEditingEducationId(null);
        await refresh();
        await refreshEditProfile();
      } else {
        Alert.alert('Error', response.message || 'Failed to update');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update education');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadEducationDocument = async (educationId: string) => {
    try {
      const asset = await pickDocument();
      if (!asset) return;

      setUploadingKey(`edu:${educationId}`);
      const formData = new FormData();
      formData.append('document', {
        uri: asset.uri,
        type: asset.mimeType || 'application/octet-stream',
        name: asset.name || 'education_document',
      } as any);

      const response = await doctorApi.uploadEducationDocument(educationId, formData);
      if (response.success) {
        Alert.alert('Success', 'Education document uploaded');

        // Optimistic Update
        const documentUrl = (response.data as any)?.documentUrl;
        if (editProfile && editProfile.education) {
          const updatedEducation = editProfile.education.map((e: any) =>
            e.id === educationId ? { ...e, documentUrl: documentUrl || 'uploaded', isVerified: false } : e
          );
          setEditProfile({ ...editProfile, education: updatedEducation });
        }

        await refreshEditProfile();
        await refresh();
      } else {
        Alert.alert('Error', response.message || 'Failed to upload');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to upload document');
    } finally {
      setUploadingKey(null);
    }
  };

  // ============ Add Skill ============
  const handleAddSkill = async () => {
    if (!newSkill.name) {
      Alert.alert('Required', 'Please enter skill name');
      return;
    }

    try {
      setSaving(true);
      const response = await doctorApi.addSkill({
        name: newSkill.name,
        level: newSkill.level,
        certifyingAuthority: newSkill.certifyingAuthority || undefined,
        validTill: newSkill.validTill ? newSkill.validTill.toISOString() : undefined,
        experienceYears: newSkill.experienceYears ? Number(newSkill.experienceYears) : undefined,
      });

      if (response.success) {
        Alert.alert('Success', 'Skill added successfully. You can upload a certificate via the Upload button.');
        setNewSkill({
          name: '',
          level: 'intermediate',
          certifyingAuthority: '',
          validTill: null,
          experienceYears: '',
        });
        await refresh();
        await refreshEditProfile();
      } else {
        Alert.alert('Error', response.message || 'Failed to add');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add skill');
    } finally {
      setSaving(false);
    }
  };

  const startEditSkill = (skill: any) => {
    if (!skill?.id) return;
    setEditingSkillId(skill.id);
    setSkillEdit({
      name: skill.name || '',
      level: skill.level || 'intermediate',
      certifyingAuthority: skill.certifyingAuthority || '',
      validTill: toDateOrNull(skill.validTill),
      experienceYears: typeof skill.experienceYears === 'number' ? String(skill.experienceYears) : '',
    });
  };

  const cancelEditSkill = () => {
    setEditingSkillId(null);
  };

  const handleSaveSkillEdit = async () => {
    if (!editingSkillId) return;
    if (!skillEdit.name) {
      Alert.alert('Required', 'Please enter skill name');
      return;
    }

    try {
      setSaving(true);
      const response = await doctorApi.updateSkill(editingSkillId, {
        name: skillEdit.name,
        level: skillEdit.level,
        certifyingAuthority: skillEdit.certifyingAuthority || undefined,
        validTill: skillEdit.validTill ? skillEdit.validTill.toISOString() : undefined,
        experienceYears: skillEdit.experienceYears ? Number(skillEdit.experienceYears) : undefined,
      });

      if (response.success) {
        setEditingSkillId(null);
        await refresh();
        await refreshEditProfile();
      } else {
        Alert.alert('Error', response.message || 'Failed to update');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update skill');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadSkillCertificate = async (skillId: string) => {
    try {
      const asset = await pickDocument();
      if (!asset) return;

      setUploadingKey(`skill:${skillId}`);
      const formData = new FormData();
      formData.append('document', {
        uri: asset.uri,
        type: asset.mimeType || 'application/octet-stream',
        name: asset.name || 'certificate',
      } as any);

      const response = await doctorApi.uploadSkillCertificate(skillId, formData);
      if (response.success) {
        Alert.alert('Success', 'Certificate uploaded');

        // Optimistic update
        const certificateUrl = (response.data as any)?.certificateUrl;
        if (editProfile && editProfile.skills) {
          const updatedSkills = editProfile.skills.map((s: any) =>
            s.id === skillId ? { ...s, certificate: certificateUrl || 'uploaded' } : s
          );
          setEditProfile({ ...editProfile, skills: updatedSkills });
        }

        await refreshEditProfile();
      } else {
        Alert.alert('Error', response.message || 'Failed to upload');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to upload certificate');
    } finally {
      setUploadingKey(null);
    }
  };

  // ============ Add Experience ============
  const handleAddExperience = async () => {
    if (!newExperience.role || !newExperience.institution) {
      Alert.alert('Required', 'Please fill role and institution');
      return;
    }

    if (!newExperience.startDate) {
      Alert.alert('Required', 'Please select start date');
      return;
    }

    try {
      setSaving(true);
      const response = await doctorApi.addExperience({
        role: newExperience.role,
        institution: newExperience.institution,
        department: newExperience.department || undefined,
        startDate: newExperience.startDate.toISOString(),
        endDate: newExperience.isCurrent ? undefined : newExperience.endDate ? newExperience.endDate.toISOString() : undefined,
        isCurrent: newExperience.isCurrent,
      });

      if (response.success) {
        Alert.alert('Success', 'Experience added successfully. You can upload a document via the Upload button.');
        setNewExperience({
          role: '',
          institution: '',
          department: '',
          startDate: null,
          endDate: null,
          isCurrent: false,
        });

        // Handle document upload if selected
        if (pendingExperienceDoc) {
          // Logic for immediate doc upload if we had the ID, but we need the new ID.
          // Usually backend returns the profile with new Experience.
        }

        await refresh();
        await refreshEditProfile();
      } else {
        Alert.alert('Error', response.message || 'Failed to add');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add experience');
    } finally {
      setSaving(false);
    }
  };

  const startEditExperience = (exp: any) => {
    if (!exp?.id) return;
    setEditingExperienceId(exp.id);
    setExperienceEdit({
      role: exp.role || '',
      institution: exp.institution || '',
      department: exp.department || '',
      startDate: toDateOrNull(exp.startDate),
      endDate: toDateOrNull(exp.endDate),
      isCurrent: Boolean(exp.isCurrent),
    });
  };

  const cancelEditExperience = () => {
    setEditingExperienceId(null);
  };

  const handleSaveExperienceEdit = async () => {
    if (!editingExperienceId) return;
    if (!experienceEdit.role || !experienceEdit.institution) {
      Alert.alert('Required', 'Please fill role and institution');
      return;
    }
    if (!experienceEdit.startDate) {
      Alert.alert('Required', 'Please select start date');
      return;
    }

    try {
      setSaving(true);
      const response = await doctorApi.updateExperience(editingExperienceId, {
        role: experienceEdit.role,
        institution: experienceEdit.institution,
        department: experienceEdit.department || undefined,
        startDate: experienceEdit.startDate.toISOString(),
        endDate: experienceEdit.isCurrent ? undefined : experienceEdit.endDate ? experienceEdit.endDate.toISOString() : undefined,
        isCurrent: experienceEdit.isCurrent,
      });

      if (response.success) {
        setEditingExperienceId(null);
        await refresh();
        await refreshEditProfile();
      } else {
        Alert.alert('Error', response.message || 'Failed to update');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update experience');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadExperienceDocument = async (experienceId: string) => {
    try {
      const asset = await pickDocument();
      if (!asset) return;

      setUploadingKey(`exp:${experienceId}`);
      const formData = new FormData();
      formData.append('document', {
        uri: asset.uri,
        type: asset.mimeType || 'application/octet-stream',
        name: asset.name || 'experience_document',
      } as any);
      if (asset.name) formData.append('title', asset.name);
      if (typeof asset.size === 'number') formData.append('size', String(asset.size));

      const response = await doctorApi.uploadExperienceDocument(experienceId, formData);
      if (response.success) {
        Alert.alert('Success', 'Document uploaded');

        // Optimistic Update
        const documents = (response.data as any)?.documents || [{ url: 'uploaded' }]; // Fallback
        if (editProfile && editProfile.experience) {
          const updatedExp = editProfile.experience.map((e: any) =>
            e.id === experienceId ? { ...e, documents: documents, isVerified: false } : e
          );
          setEditProfile({ ...editProfile, experience: updatedExp });
        }

        await refreshEditProfile();
        await refresh();
      } else {
        Alert.alert('Error', response.message || 'Failed to upload');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to upload document');
    } finally {
      setUploadingKey(null);
    }
  };

  // ============ Licenses ============
  const handleUploadLicenseDocument = async (licenseId: string) => {
    try {
      const asset = await pickDocument();
      if (!asset) return;

      setUploadingKey(`license:${licenseId}`);
      const formData = new FormData();
      formData.append('document', {
        uri: asset.uri,
        type: asset.mimeType || 'application/octet-stream',
        name: asset.name || 'license_document',
      } as any);

      const response = await doctorApi.uploadLicenseDocument(licenseId, formData);
      if (response.success) {
        Alert.alert('Success', 'License document uploaded');

        // Optimistic Update
        const documentUrl = (response.data as any)?.documentUrl;
        if (editProfile && editProfile.licensure?.licenses) {
          const updatedLicenses = editProfile.licensure.licenses.map((l: any) =>
            l.id === licenseId ? { ...l, documentUrl: documentUrl || 'uploaded', isVerified: false } : l
          );
          setEditProfile({ ...editProfile, licensure: { ...editProfile.licensure, licenses: updatedLicenses } });
        }

        await refreshEditProfile();
        await refresh();
      } else {
        Alert.alert('Error', response.message || 'Failed to upload');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to upload document');
    } finally {
      setUploadingKey(null);
    }
  };

  const handleAddLicense = async () => {
    if (!newLicense.registrationNumber || !newLicense.issuingAuthority) {
      Alert.alert('Required', 'Please fill registration number and issuing authority');
      return;
    }
    if (!newLicense.validFrom) {
      Alert.alert('Required', 'Please select valid from date');
      return;
    }

    try {
      setSaving(true);
      const response = await doctorApi.addLicense({
        registrationNumber: newLicense.registrationNumber,
        issuingAuthority: newLicense.issuingAuthority,
        validFrom: newLicense.validFrom.toISOString(),
        validTill: newLicense.validTill ? newLicense.validTill.toISOString() : undefined,
      });

      if (response.success) {
        Alert.alert('Success', 'License added successfully. You can upload a document via the Upload button.');
        setNewLicense(emptyLicenseForm);
        await refresh();
        await refreshEditProfile();
      } else {
        Alert.alert('Error', response.message || 'Failed to add');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add license');
    } finally {
      setSaving(false);
    }
  };

  const startEditLicense = (license: any) => {
    if (!license?.id) return;
    setEditingLicenseId(license.id);
    setLicenseEdit({
      registrationNumber: license.registrationNumber || '',
      issuingAuthority: license.issuingAuthority || '',
      validFrom: toDateOrNull(license.validFrom),
      validTill: toDateOrNull(license.validTill),
    });
  };

  const cancelEditLicense = () => {
    setEditingLicenseId(null);
  };

  const handleSaveLicenseEdit = async () => {
    if (!editingLicenseId) return;
    if (!licenseEdit.registrationNumber || !licenseEdit.issuingAuthority) {
      Alert.alert('Required', 'Please fill registration number and issuing authority');
      return;
    }
    if (!licenseEdit.validFrom) {
      Alert.alert('Required', 'Please select valid from date');
      return;
    }

    try {
      setSaving(true);
      const response = await doctorApi.updateLicense(editingLicenseId, {
        registrationNumber: licenseEdit.registrationNumber,
        issuingAuthority: licenseEdit.issuingAuthority,
        validFrom: licenseEdit.validFrom.toISOString(),
        validTill: licenseEdit.validTill ? licenseEdit.validTill.toISOString() : undefined,
      });

      if (response.success) {
        setEditingLicenseId(null);
        await refresh();
        await refreshEditProfile();
      } else {
        Alert.alert('Error', response.message || 'Failed to update');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update license');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLicense = async (licenseId: string) => {
    Alert.alert('Delete license?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setSaving(true);
            const response = await doctorApi.deleteLicense(licenseId);
            if (response.success) {
              await refresh();
              await refreshEditProfile();
            } else {
              Alert.alert('Error', response.message || 'Failed to delete');
            }
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete license');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  // ============ Save Preferences ============
  const handleSavePreferences = async () => {
    try {
      setSaving(true);

      const hasShortTerm =
        preferences.jobTypes.includes('Short Term') || preferences.jobTypes.includes('Locum');
      const hasLongTerm = preferences.jobTypes.includes('Long Term');

      const payload: any = {
        shortTermJobs: hasShortTerm,
        longTermJobs: hasLongTerm,
        paymentPreference: preferences.rateUnit,
        expectedHourlyRate: preferences.rateUnit === 'per_hour' && preferences.minRate ? Number(preferences.minRate) : null,
        expectedDailyRate: preferences.rateUnit === 'per_day' && preferences.minRate ? Number(preferences.minRate) : null,
        expectedMonthlyRate: preferences.rateUnit === 'per_month' && preferences.minRate ? Number(preferences.minRate) : null,
        expectedPerPatientRate: preferences.rateUnit === 'per_patient' && preferences.minRate ? Number(preferences.minRate) : null,
        experienceYears: preferences.experienceYears ? Number(preferences.experienceYears) : undefined,
        jobStatus: preferences.jobStatus,
        willingToRelocate: preferences.willingToRelocate,
      };

      if (preferences.preferredCity || preferences.preferredState) {
        payload.preferredLocations = [
          {
            city: preferences.preferredCity || undefined,
            state: preferences.preferredState || undefined,
            maxDistance: preferences.travelRadius,
          },
        ];
      }

      const response = await doctorApi.updatePreferences({
        ...payload,
      });

      if (response.success) {
        Alert.alert('Success', 'Preferences updated successfully');
        await refresh();
        await refreshEditProfile();
        setExpandedSection(null);
      } else {
        Alert.alert('Error', response.message || 'Failed to update');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const profileCompletion = getProfileCompletion(profile);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#1A1464" />
        <Text className="mt-3 text-gray-500">Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="light-content" backgroundColor="#1e3a8a" />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header with Avatar */}
        <ImageBackground
          source={require('../assets/images/top-bg_.png')}
          resizeMode="cover"
          className="rounded-b-3xl overflow-hidden"
        >
          <View className="px-4 pt-4 pb-5">
            <Pressable
              className="h-11 w-11 rounded-xl bg-white/10 border border-white/20 items-center justify-center"
              onPress={() => router.back()}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>

            <View className="mt-3 items-center">
              {/* Avatar with upload button */}
              <Pressable onPress={handleAvatarUpload} disabled={uploadingAvatar}>
                <View className="h-24 w-24 rounded-full border-2 border-white/50 items-center justify-center">
                  <View className="h-20 w-20 rounded-full overflow-hidden bg-white/10">
                    {uploadingAvatar ? (
                      <View className="h-full w-full items-center justify-center">
                        <ActivityIndicator color="#fff" />
                      </View>
                    ) : (
                      <Image
                        source={profile?.avatar ? { uri: profile.avatar } : require('../assets/images/logo.png')}
                        className="h-full w-full"
                        resizeMode="cover"
                      />
                    )}
                  </View>
                  <View className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-white items-center justify-center">
                    <Ionicons name="camera" size={14} color="#1e3a8a" />
                  </View>
                </View>
              </Pressable>

              <Text className="mt-3 text-white text-xl font-semibold">
                {profile?.displayName || profile?.name || 'Doctor'}
              </Text>
              {(() => {
                const subtitle = [profile?.specialization, profile?.designation].filter(Boolean).join(' • ');
                return subtitle ? <Text className="mt-1 text-blue-100 text-xs">{subtitle}</Text> : null;
              })()}

              {/* Profile Completion */}
              <View className="mt-3 w-full rounded-2xl bg-white/10 border border-white/15 px-4 py-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-white font-semibold">Profile Completion</Text>
                  <Text className="text-white font-semibold">{Math.round(profileCompletion.percentage)}%</Text>
                </View>
                <View className="mt-2 h-2 w-full rounded-full bg-white/20 overflow-hidden">
                  <View
                    className="h-2 rounded-full bg-green-500"
                    style={{ width: `${profileCompletion.percentage}%` }}
                  />
                </View>
              </View>
            </View>
          </View>
        </ImageBackground>

        <View className="px-4 py-5">
          {/* Personal Info Section */}
          <SectionCard
            icon="person"
            title="Personal Info"
            status={isSectionComplete(profile, 'personal') ? 'completed' : 'warning'}
            expanded={expandedSection === 'personal'}
            onToggle={() => toggleSection('personal')}
          >
            <View className="pt-3">
              {/* Avatar in form */}
              <View className="items-center mb-4">
                <Pressable onPress={handleAvatarUpload} disabled={uploadingAvatar}>
                  <View className="h-16 w-16 rounded-full overflow-hidden bg-gray-100">
                    {uploadingAvatar ? (
                      <View className="h-full w-full items-center justify-center">
                        <ActivityIndicator color="#1e3a8a" />
                      </View>
                    ) : (
                      <Image
                        source={profile?.avatar ? { uri: profile.avatar } : require('../assets/images/logo.png')}
                        className="h-full w-full"
                        resizeMode="cover"
                      />
                    )}
                  </View>
                </Pressable>
                <Pressable
                  className="mt-3 px-4 py-2 rounded-xl bg-blue-900"
                  onPress={handleAvatarUpload}
                  disabled={uploadingAvatar}
                >
                  <Text className="text-white text-xs font-semibold">
                    {uploadingAvatar ? 'Uploading...' : 'Change Photo'}
                  </Text>
                </Pressable>
              </View>

              <View className="flex-row gap-3">
                <FormField
                  label="First Name"
                  value={personalInfo.firstName}
                  onChangeText={(text) => setPersonalInfo({ ...personalInfo, firstName: text })}
                  placeholder="First name"
                  flex
                />
                <FormField
                  label="Last Name"
                  value={personalInfo.lastName}
                  onChangeText={(text) => setPersonalInfo({ ...personalInfo, lastName: text })}
                  placeholder="Last name"
                  flex
                />
              </View>

              <View className="mt-3">
                <Text className="text-gray-500 text-xs mb-2">Gender</Text>
                <View className="flex-row gap-2">
                  {(['male', 'female', 'other', 'prefer_not_to_say'] as const).map((g) => (
                    <Pressable
                      key={g}
                      className={`flex-1 py-3 rounded-xl ${personalInfo.gender === g ? 'bg-blue-900' : 'bg-gray-100'}`}
                      onPress={() => setPersonalInfo({ ...personalInfo, gender: g })}
                    >
                      <Text
                        className={`text-xs font-semibold text-center capitalize ${personalInfo.gender === g ? 'text-white' : 'text-gray-600'}`}
                      >
                        {g.replace('_', ' ')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Specialization with Autocomplete */}
              <View className="mt-3">
                <Text className="text-gray-500 text-xs mb-2">
                  Specialization <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  value={personalInfo.specialization}
                  onChangeText={(text) => {
                    setPersonalInfo({ ...personalInfo, specialization: text });
                    // Filter suggestions
                    if (text.length > 0) {
                      const filtered = MEDICAL_SPECIALIZATIONS.filter(spec =>
                        spec.toLowerCase().includes(text.toLowerCase())
                      );
                      setSpecializationSuggestions(filtered.slice(0, 5));
                      setShowSpecializationDropdown(true);
                    } else {
                      setShowSpecializationDropdown(false);
                    }
                  }}
                  onFocus={() => {
                    if (personalInfo.specialization.length > 0) {
                      const filtered = MEDICAL_SPECIALIZATIONS.filter(spec =>
                        spec.toLowerCase().includes(personalInfo.specialization.toLowerCase())
                      );
                      setSpecializationSuggestions(filtered.slice(0, 5));
                      setShowSpecializationDropdown(true);
                    }
                  }}
                  placeholder="e.g. Cardiology, ICU Nurse"
                  className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-gray-900"
                  placeholderTextColor="#9ca3af"
                />
                {showSpecializationDropdown && specializationSuggestions.length > 0 && (
                  <View className="mt-1 rounded-xl bg-white border border-gray-200 overflow-hidden">
                    {specializationSuggestions.map((suggestion, index) => (
                      <Pressable
                        key={index}
                        className="px-4 py-3 border-b border-gray-100"
                        onPress={() => {
                          setPersonalInfo({ ...personalInfo, specialization: suggestion });
                          setShowSpecializationDropdown(false);
                        }}
                      >
                        <Text className="text-gray-900">{suggestion}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              <View className="mt-3">
                <Text className="text-gray-500 text-xs mb-2">Profile Overview (Bio)</Text>
                <TextInput
                  value={personalInfo.bio}
                  onChangeText={(text) => setPersonalInfo({ ...personalInfo, bio: text })}
                  placeholder="Write a short bio about yourself..."
                  multiline
                  numberOfLines={4}
                  className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-gray-900 min-h-[100px]"
                  placeholderTextColor="#9ca3af"
                  style={{ textAlignVertical: 'top' }}
                />
              </View>

              <FormField
                label="Email"
                value={profile?.email || ''}
                placeholder="Email"
                editable={false}
                verified
              />

              <FormField
                label="Street Address"
                value={personalInfo.address.street}
                onChangeText={(text) =>
                  setPersonalInfo({ ...personalInfo, address: { ...personalInfo.address, street: text } })
                }
                placeholder="Street address"
              />

              <View className="mt-3">
                <StateCitySelector
                  state={personalInfo.address.state}
                  city={personalInfo.address.city}
                  onStateChange={(state) => {
                    setPersonalInfo({
                      ...personalInfo,
                      address: { ...personalInfo.address, state, city: '' }
                    });
                    setAvailableCities(getCitiesByState(state));
                  }}
                  onCityChange={(city) => {
                    setPersonalInfo({
                      ...personalInfo,
                      address: { ...personalInfo.address, city }
                    });
                  }}
                />
              </View>

              <FormField
                label="Pincode"
                value={personalInfo.address.pincode}
                onChangeText={(text) =>
                  setPersonalInfo({ ...personalInfo, address: { ...personalInfo.address, pincode: text } })
                }
                placeholder="e.g., 600001"
                keyboardType="numeric"
              />

              <View className="mt-5 rounded-xl bg-gray-50 border border-gray-100 px-4 py-4">
                <Text className="text-gray-900 font-semibold">Aadhaar</Text>
                <Text className="mt-1 text-gray-500 text-xs">
                  {editProfile?.personal?.aadhaar?.maskedNumber
                    ? `Saved: ${editProfile.personal.aadhaar.maskedNumber}`
                    : 'No Aadhaar number saved'}
                </Text>

                <FormField
                  label="Aadhaar Number"
                  value={aadhaarNumber}
                  onChangeText={setAadhaarNumber}
                  placeholder="Enter 12-digit Aadhaar"
                  keyboardType="numeric"
                />

                <View className="flex-row gap-3 mt-4">
                  <Pressable
                    className="flex-1 rounded-xl bg-blue-900 py-3 items-center"
                    onPress={handleSaveAadhaar}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text className="text-white font-semibold">Save Aadhaar</Text>
                    )}
                  </Pressable>
                  <Pressable
                    className="flex-1 rounded-xl border border-gray-200 py-3 items-center"
                    onPress={handleUploadAadhaarDocument}
                    disabled={uploadingKey === 'aadhaar'}
                  >
                    {uploadingKey === 'aadhaar' ? (
                      <ActivityIndicator color="#111827" size="small" />
                    ) : (
                      <Text className="text-gray-900 font-semibold">
                        {editProfile?.personal?.aadhaar?.documentUrl ? 'Replace Doc' : 'Upload Doc'}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>

              {/* Phone Verification Section */}
              <View className="mt-5 rounded-xl bg-gray-50 border border-gray-100 px-4 py-4">
                <Text className="text-gray-900 font-semibold">Phone Number</Text>
                <Text className="mt-1 text-gray-500 text-xs">
                  {phoneSavedNumber
                    ? `Saved: +91 ${phoneSavedNumber.slice(0, 5)}XXXXX`
                    : 'No phone number saved'}
                  {isPhoneVerified && (
                    <Text className="text-green-600"> ✓ Verified</Text>
                  )}
                </Text>

                {!showPhoneOtpInput ? (
                  <>
                    <View className="mt-3">
                      <Text className="text-gray-500 text-xs mb-2">Enter Phone Number</Text>
                      <View className="flex-row items-center">
                        <View className="rounded-l-xl bg-gray-100 border border-r-0 border-gray-200 px-3 py-3">
                          <Text className="text-gray-600">+91</Text>
                        </View>
                        <TextInput
                          value={phoneNumber}
                          onChangeText={setPhoneNumber}
                          placeholder="10-digit number"
                          keyboardType="phone-pad"
                          maxLength={10}
                          className="flex-1 rounded-r-xl bg-gray-50 border border-gray-100 px-4 py-3 text-gray-900"
                          placeholderTextColor="#9ca3af"
                        />
                      </View>
                    </View>
                    <Pressable
                      className="mt-4 rounded-xl bg-blue-900 py-3 items-center"
                      onPress={handleSendPhoneOtp}
                      disabled={sendingPhoneOtp || phoneNumber.replace(/\D/g, '').length !== 10}
                    >
                      {sendingPhoneOtp ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text className="text-white font-semibold">Send OTP</Text>
                      )}
                    </Pressable>
                  </>
                ) : (
                  <>
                    <View className="mt-3">
                      <Text className="text-gray-500 text-xs mb-2">Enter OTP sent to +91 {phoneNumber}</Text>
                      <TextInput
                        value={phoneOtp}
                        onChangeText={setPhoneOtp}
                        placeholder="6-digit OTP"
                        keyboardType="number-pad"
                        maxLength={6}
                        className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-gray-900 text-center text-lg tracking-widest"
                        placeholderTextColor="#9ca3af"
                      />
                    </View>
                    <View className="flex-row gap-3 mt-4">
                      <Pressable
                        className="flex-1 rounded-xl border border-gray-200 py-3 items-center"
                        onPress={() => {
                          setShowPhoneOtpInput(false);
                          setPhoneOtp('');
                        }}
                      >
                        <Text className="text-gray-900 font-semibold">Change Number</Text>
                      </Pressable>
                      <Pressable
                        className="flex-1 rounded-xl bg-blue-900 py-3 items-center"
                        onPress={handleVerifyPhoneOtp}
                        disabled={verifyingPhoneOtp || phoneOtp.length !== 6}
                      >
                        {verifyingPhoneOtp ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text className="text-white font-semibold">Verify OTP</Text>
                        )}
                      </Pressable>
                    </View>
                    <Pressable
                      className="mt-3 items-center"
                      onPress={handleSendPhoneOtp}
                      disabled={sendingPhoneOtp}
                    >
                      <Text className="text-blue-600 text-xs">
                        {sendingPhoneOtp ? 'Sending...' : 'Resend OTP'}
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>

              <View className="flex-row gap-3 mt-4">
                <Pressable
                  className="flex-1 rounded-xl border border-gray-200 py-3 items-center"
                  onPress={() => setExpandedSection(null)}
                >
                  <Text className="text-gray-900 font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  className="flex-1 rounded-xl bg-blue-900 py-3 items-center"
                  onPress={handleSavePersonalInfo}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text className="text-white font-semibold">Save</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </SectionCard>

          {/* Education Section */}
          <SectionCard
            icon="school"
            title="Education"
            status={isSectionComplete(profile, 'education') ? 'completed' : 'warning'}
            expanded={expandedSection === 'education'}
            onToggle={() => toggleSection('education')}
          >
            <View className="pt-3">
              {/* Existing Education */}
              {(editProfile?.education || profile?.education || []).map((edu: any, idx: number) => {
                const id = edu?.id;
                const isEditing = Boolean(id && editingEducationId === id);

                return (
                  <View key={id || idx} className="mb-3 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                    {isEditing ? (
                      <>
                        <Text className="text-gray-900 font-semibold mb-2">Edit Education</Text>

                        <FormField
                          label="Institution"
                          value={educationEdit.institution}
                          onChangeText={(text) => setEducationEdit({ ...educationEdit, institution: text })}
                          placeholder="University/College name"
                        />
                        <FormField
                          label="Degree"
                          value={educationEdit.degree}
                          onChangeText={(text) => setEducationEdit({ ...educationEdit, degree: text })}
                          placeholder="MD, MBBS, etc."
                        />
                        <FormField
                          label="Specialization"
                          value={educationEdit.specialization}
                          onChangeText={(text) => setEducationEdit({ ...educationEdit, specialization: text })}
                          placeholder="Optional"
                        />

                        <View className="flex-row gap-3">
                          <FormField
                            label="Start Year"
                            value={educationEdit.startYear}
                            onChangeText={(text) => setEducationEdit({ ...educationEdit, startYear: text })}
                            placeholder="2010"
                            flex
                            keyboardType="numeric"
                          />
                          <FormField
                            label="End Year"
                            value={educationEdit.endYear}
                            onChangeText={(text) => setEducationEdit({ ...educationEdit, endYear: text })}
                            placeholder="2014"
                            flex
                            keyboardType="numeric"
                          />
                        </View>

                        <View className="mt-3 flex-row items-center justify-between">
                          <Text className="text-gray-500 text-xs">
                            {edu.documentUrl ? 'Marksheet uploaded' : 'No marksheet uploaded'}
                          </Text>
                          {id ? (
                            <View className="flex-row gap-2">
                              {!edu.documentUrl ? (
                                <Pressable
                                  className="px-3 py-2 rounded-xl bg-white border border-gray-200"
                                  onPress={() => handleUploadEducationDocument(id)}
                                  disabled={uploadingKey === `edu:${id}`}
                                >
                                  {uploadingKey === `edu:${id}` ? (
                                    <ActivityIndicator size="small" color="#111827" />
                                  ) : (
                                    <Text className="text-gray-900 text-xs font-semibold">Upload</Text>
                                  )}
                                </Pressable>
                              ) : null}
                            </View>
                          ) : null}
                        </View>

                        <View className="flex-row gap-3 mt-4">
                          <Pressable
                            className="flex-1 rounded-xl border border-gray-200 py-3 items-center"
                            onPress={cancelEditEducation}
                          >
                            <Text className="text-gray-900 font-semibold">Cancel</Text>
                          </Pressable>
                          <Pressable
                            className="flex-1 rounded-xl bg-blue-900 py-3 items-center"
                            onPress={handleSaveEducationEdit}
                            disabled={saving}
                          >
                            {saving ? (
                              <ActivityIndicator color="#fff" size="small" />
                            ) : (
                              <Text className="text-white font-semibold">Save</Text>
                            )}
                          </Pressable>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text className="text-gray-900 font-semibold">{edu.institution}</Text>
                        <Text className="text-gray-600 text-xs mt-1">
                          {edu.degree}
                          {edu.specialization ? ` - ${edu.specialization}` : ''}
                        </Text>
                        {edu.startYear || edu.endYear ? (
                          <Text className="text-gray-400 text-xs mt-1">
                            {[edu.startYear, edu.endYear].filter(Boolean).join(' - ')}
                          </Text>
                        ) : null}

                        {id ? (
                          <View className="mt-3 flex-row items-center justify-between">
                            <Text className="text-gray-500 text-xs">
                              {edu.documentUrl ? 'Marksheet uploaded' : 'No marksheet uploaded'}
                            </Text>
                            <View className="flex-row gap-2">
                              <Pressable
                                className="px-3 py-2 rounded-xl bg-white border border-gray-200"
                                onPress={() => startEditEducation(edu)}
                              >
                                <Text className="text-gray-900 text-xs font-semibold">Edit</Text>
                              </Pressable>
                              {!edu.documentUrl ? (
                                <Pressable
                                  className="px-3 py-2 rounded-xl bg-white border border-gray-200"
                                  onPress={() => handleUploadEducationDocument(id)}
                                  disabled={uploadingKey === `edu:${id}`}
                                >
                                  {uploadingKey === `edu:${id}` ? (
                                    <ActivityIndicator size="small" color="#111827" />
                                  ) : (
                                    <Text className="text-gray-900 text-xs font-semibold">Upload</Text>
                                  )}
                                </Pressable>
                              ) : null}
                            </View>
                          </View>
                        ) : null}
                      </>
                    )}
                  </View>
                );
              })}

              <Text className="text-gray-500 text-xs mb-2 mt-3">Add New Education</Text>

              <FormField
                label="Institution"
                value={newEducation.institution}
                onChangeText={(text) => setNewEducation({ ...newEducation, institution: text })}
                placeholder="University/College name"
              />
              <FormField
                label="Degree"
                value={newEducation.degree}
                onChangeText={(text) => setNewEducation({ ...newEducation, degree: text })}
                placeholder="MD, MBBS, etc."
              />
              <FormField
                label="Specialization"
                value={newEducation.specialization}
                onChangeText={(text) => setNewEducation({ ...newEducation, specialization: text })}
                placeholder="Optional"
              />

              <View className="flex-row gap-3">
                <FormField
                  label="Start Year"
                  value={newEducation.startYear}
                  onChangeText={(text) => setNewEducation({ ...newEducation, startYear: text })}
                  placeholder="2010"
                  flex
                  keyboardType="numeric"
                />
                <FormField
                  label="End Year"
                  value={newEducation.endYear}
                  onChangeText={(text) => setNewEducation({ ...newEducation, endYear: text })}
                  placeholder="2014"
                  flex
                  keyboardType="numeric"
                />
              </View>

              {/* Document Upload for New Education */}
              <View className="mt-4 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-blue-900 font-semibold text-xs">
                      Upload Marksheet/Certificate <Text className="text-red-500">*</Text>
                    </Text>
                    <Text className="text-blue-600 text-[10px] mt-1">
                      {pendingEducationDoc ? pendingEducationDoc.name : 'Required before saving'}
                    </Text>
                  </View>
                  <Pressable
                    className={`px-4 py-2 rounded-xl ${pendingEducationDoc ? 'bg-green-600' : 'bg-blue-900'}`}
                    onPress={handleSelectEducationDoc}
                  >
                    <Text className="text-white text-xs font-semibold">
                      {pendingEducationDoc ? 'Change' : 'Select'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View className="flex-row gap-3 mt-4">
                <Pressable
                  className="flex-1 rounded-xl border border-gray-200 py-3 items-center"
                  onPress={() => {
                    setExpandedSection(null);
                    setPendingEducationDoc(null);
                  }}
                >
                  <Text className="text-gray-900 font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  className={`flex-1 rounded-xl py-3 items-center ${pendingEducationDoc ? 'bg-blue-900' : 'bg-gray-300'}`}
                  onPress={handleAddEducationWithDoc}
                  disabled={saving || !pendingEducationDoc}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text className={`font-semibold ${pendingEducationDoc ? 'text-white' : 'text-gray-500'}`}>
                      Add Education
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </SectionCard>

          {/* Licensure Section */}
          <SectionCard
            icon="ribbon"
            title="Licensure"
            status={isSectionComplete(profile, 'licensure') ? 'completed' : 'warning'}
            expanded={expandedSection === 'licensure'}
            onToggle={() => toggleSection('licensure')}
          >
            <View className="pt-3">
              <Text className="text-gray-500 text-xs mb-2">Current Licenses</Text>

              {(editProfile?.licensure?.licenses || []).length > 0 ? (
                <View className="mb-4">
                  {(editProfile?.licensure?.licenses || []).map((lic: any) => {
                    const isEditing = Boolean(lic?.id && editingLicenseId === lic.id);
                    return (
                      <View key={lic.id} className="mb-3 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                        {isEditing ? (
                          <>
                            <Text className="text-gray-900 font-semibold mb-2">Edit License</Text>
                            <FormField
                              label="Registration Number"
                              value={licenseEdit.registrationNumber}
                              onChangeText={(text) => setLicenseEdit((p) => ({ ...p, registrationNumber: text }))}
                              placeholder="Enter registration number"
                            />
                            <FormField
                              label="Issuing Authority"
                              value={licenseEdit.issuingAuthority}
                              onChangeText={(text) => setLicenseEdit((p) => ({ ...p, issuingAuthority: text }))}
                              placeholder="Authority"
                            />

                            <Text className="text-gray-500 text-xs mt-4 mb-2">Valid From</Text>
                            <Pressable
                              className="rounded-xl bg-white border border-gray-200 px-4 py-3"
                              onPress={() => openDatePicker('licenseEditValidFrom')}
                            >
                              <Text className="text-gray-900">{formatDateLabel(licenseEdit.validFrom)}</Text>
                            </Pressable>

                            <Text className="text-gray-500 text-xs mt-4 mb-2">Valid Till (optional)</Text>
                            <Pressable
                              className="rounded-xl bg-white border border-gray-200 px-4 py-3"
                              onPress={() => openDatePicker('licenseEditValidTill')}
                            >
                              <Text className="text-gray-900">{formatDateLabel(licenseEdit.validTill)}</Text>
                            </Pressable>

                            <View className="mt-3 flex-row items-center justify-between">
                              <Text className="text-gray-500 text-xs">
                                {lic.documentUrl ? 'Document uploaded' : 'No document uploaded'}
                              </Text>
                              {!lic.documentUrl ? (
                                <Pressable
                                  className="px-3 py-2 rounded-xl bg-white border border-gray-200"
                                  onPress={() => handleUploadLicenseDocument(lic.id)}
                                  disabled={uploadingKey === `license:${lic.id}`}
                                >
                                  {uploadingKey === `license:${lic.id}` ? (
                                    <ActivityIndicator size="small" color="#111827" />
                                  ) : (
                                    <Text className="text-gray-900 text-xs font-semibold">Upload Doc</Text>
                                  )}
                                </Pressable>
                              ) : null}
                            </View>

                            <View className="flex-row gap-3 mt-4">
                              <Pressable
                                className="flex-1 rounded-xl border border-gray-200 py-3 items-center"
                                onPress={cancelEditLicense}
                              >
                                <Text className="text-gray-900 font-semibold">Cancel</Text>
                              </Pressable>
                              <Pressable
                                className="flex-1 rounded-xl bg-blue-900 py-3 items-center"
                                onPress={handleSaveLicenseEdit}
                                disabled={saving}
                              >
                                {saving ? (
                                  <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                  <Text className="text-white font-semibold">Save</Text>
                                )}
                              </Pressable>
                            </View>
                          </>
                        ) : (
                          <>
                            <View className="flex-row items-center justify-between">
                              <Text className="text-gray-900 font-semibold">{lic.registrationNumber || 'License'}</Text>
                              <View className="flex-row gap-2">
                                <Pressable
                                  className="px-3 py-2 rounded-xl bg-white border border-gray-200"
                                  onPress={() => startEditLicense(lic)}
                                >
                                  <Text className="text-gray-900 text-xs font-semibold">Edit</Text>
                                </Pressable>
                                {!lic.documentUrl ? (
                                  <Pressable
                                    className="px-3 py-2 rounded-xl bg-white border border-gray-200"
                                    onPress={() => handleUploadLicenseDocument(lic.id)}
                                    disabled={uploadingKey === `license:${lic.id}`}
                                  >
                                    {uploadingKey === `license:${lic.id}` ? (
                                      <ActivityIndicator size="small" color="#111827" />
                                    ) : (
                                      <Text className="text-gray-900 text-xs font-semibold">Upload</Text>
                                    )}
                                  </Pressable>
                                ) : null}
                                <Pressable
                                  className="px-3 py-2 rounded-xl bg-white border border-gray-200"
                                  onPress={() => handleDeleteLicense(lic.id)}
                                >
                                  <Ionicons name="trash" size={14} color="#111827" />
                                </Pressable>
                              </View>
                            </View>
                            {lic.issuingAuthority ? (
                              <Text className="text-gray-500 text-xs mt-1">Authority: {lic.issuingAuthority}</Text>
                            ) : null}
                            {(lic.validFrom || lic.validTill) ? (
                              <Text className="text-gray-500 text-xs mt-1">
                                Validity: {[lic.validFrom ? String(lic.validFrom).slice(0, 10) : null, lic.validTill ? String(lic.validTill).slice(0, 10) : null]
                                  .filter(Boolean)
                                  .join(' - ')}
                              </Text>
                            ) : null}
                            <Text className="text-gray-400 text-xs mt-1">
                              {lic.documentUrl ? 'Document uploaded' : 'No document uploaded'}
                            </Text>
                          </>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text className="text-gray-400 text-xs mb-4">No licenses added yet</Text>
              )}

              <Text className="text-gray-500 text-xs mb-2">Add New License</Text>
              <FormField
                label="Registration Number"
                value={newLicense.registrationNumber}
                onChangeText={(text) => setNewLicense((p) => ({ ...p, registrationNumber: text }))}
                placeholder="Enter registration number"
              />
              <FormField
                label="Issuing Authority"
                value={newLicense.issuingAuthority}
                onChangeText={(text) => setNewLicense((p) => ({ ...p, issuingAuthority: text }))}
                placeholder="Authority"
              />

              <Text className="text-gray-500 text-xs mt-4 mb-2">Valid From</Text>
              <Pressable
                className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3"
                onPress={() => openDatePicker('licenseNewValidFrom')}
              >
                <Text className="text-gray-900">{formatDateLabel(newLicense.validFrom)}</Text>
              </Pressable>

              <Text className="text-gray-500 text-xs mt-4 mb-2">Valid Till (optional)</Text>
              <Pressable
                className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3"
                onPress={() => openDatePicker('licenseNewValidTill')}
              >
                <Text className="text-gray-900">{formatDateLabel(newLicense.validTill)}</Text>
              </Pressable>

              {/* License Document Upload (Required) */}
              <Text className="text-gray-500 text-xs mt-4 mb-2">Upload License Document (Required)</Text>
              <View className="flex-row items-center gap-3">
                <View className="flex-1">
                  <Text className={`text-xs ${pendingLicenseDoc ? 'text-green-600' : 'text-orange-500'}`}>
                    {pendingLicenseDoc ? pendingLicenseDoc.name : 'Required before saving'}
                  </Text>
                </View>
                <Pressable
                  className={`px-4 py-2 rounded-xl ${pendingLicenseDoc ? 'bg-green-600' : 'bg-blue-900'}`}
                  onPress={handleSelectLicenseDoc}
                >
                  <Text className="text-white text-xs font-semibold">
                    {pendingLicenseDoc ? 'Change' : 'Select'}
                  </Text>
                </Pressable>
              </View>

              <View className="flex-row gap-3 mt-5">
                <Pressable
                  className="flex-1 rounded-xl border border-gray-200 py-3 items-center"
                  onPress={() => {
                    setExpandedSection(null);
                    setPendingLicenseDoc(null);
                  }}
                >
                  <Text className="text-gray-900 font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  className={`flex-1 rounded-xl py-3 items-center ${pendingLicenseDoc ? 'bg-blue-900' : 'bg-gray-300'}`}
                  onPress={handleAddLicenseWithDoc}
                  disabled={saving || !pendingLicenseDoc}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text className={`font-semibold ${pendingLicenseDoc ? 'text-white' : 'text-gray-500'}`}>
                      Add License
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </SectionCard>

          {/* Skills Section */}
          <SectionCard
            icon="aperture"
            title="Skills & Certification"
            status={isSectionComplete(profile, 'skills') ? 'completed' : 'warning'}
            expanded={expandedSection === 'skills'}
            onToggle={() => toggleSection('skills')}
          >
            <View className="pt-3">
              {/* Existing Skills */}
              <Text className="text-gray-500 text-xs mb-2">Current Skills</Text>
              {editProfile?.skills && editProfile.skills.length > 0 ? (
                <View className="mb-4">
                  {editProfile.skills.map((skill: any) => {
                    const isEditing = Boolean(skill?.id && editingSkillId === skill.id);

                    return (
                      <View key={skill.id} className="mb-3 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                        {isEditing ? (
                          <>
                            <Text className="text-gray-900 font-semibold mb-2">Edit Skill</Text>
                            <FormField
                              label="Skill Name"
                              value={skillEdit.name}
                              onChangeText={(text) => setSkillEdit((p) => ({ ...p, name: text }))}
                              placeholder="e.g., Echocardiography"
                            />
                            <FormField
                              label="Certifying Authority"
                              value={skillEdit.certifyingAuthority}
                              onChangeText={(text) => setSkillEdit((p) => ({ ...p, certifyingAuthority: text }))}
                              placeholder="Optional"
                            />

                            <Text className="text-gray-500 text-xs mt-4 mb-2">Valid Till (optional)</Text>
                            <Pressable
                              className="rounded-xl bg-white border border-gray-200 px-4 py-3"
                              onPress={() => openDatePicker('skillEditValidTill')}
                            >
                              <Text className="text-gray-900">{formatDateLabel(skillEdit.validTill)}</Text>
                            </Pressable>

                            <FormField
                              label="Experience (years)"
                              value={skillEdit.experienceYears}
                              onChangeText={(text) => setSkillEdit((p) => ({ ...p, experienceYears: text }))}
                              placeholder="Optional"
                              keyboardType="numeric"
                            />

                            <View className="mt-3">
                              <Text className="text-gray-500 text-xs mb-2">Level</Text>
                              <View className="flex-row gap-2">
                                {(['beginner', 'intermediate', 'advanced', 'expert'] as const).map((level) => (
                                  <Pressable
                                    key={level}
                                    className={`flex-1 py-2 rounded-xl ${skillEdit.level === level ? 'bg-blue-900' : 'bg-gray-100'
                                      }`}
                                    onPress={() => setSkillEdit((p) => ({ ...p, level }))}
                                  >
                                    <Text
                                      className={`text-[10px] font-semibold text-center capitalize ${skillEdit.level === level ? 'text-white' : 'text-gray-600'
                                        }`}
                                    >
                                      {level}
                                    </Text>
                                  </Pressable>
                                ))}
                              </View>
                            </View>

                            <View className="mt-3 flex-row items-center justify-between">
                              <Text className="text-gray-400 text-xs">
                                {skill.certificate ? 'Certificate uploaded' : 'No certificate uploaded'}
                              </Text>
                              {!skill.certificate ? (
                                <Pressable
                                  className="px-3 py-2 rounded-xl bg-white border border-gray-200"
                                  onPress={() => handleUploadSkillCertificate(skill.id)}
                                  disabled={uploadingKey === `skill:${skill.id}`}
                                >
                                  {uploadingKey === `skill:${skill.id}` ? (
                                    <ActivityIndicator size="small" color="#111827" />
                                  ) : (
                                    <Text className="text-gray-900 text-xs font-semibold">Upload Cert</Text>
                                  )}
                                </Pressable>
                              ) : null}
                            </View>

                            <View className="flex-row gap-3 mt-4">
                              <Pressable
                                className="flex-1 rounded-xl border border-gray-200 py-3 items-center"
                                onPress={cancelEditSkill}
                              >
                                <Text className="text-gray-900 font-semibold">Cancel</Text>
                              </Pressable>
                              <Pressable
                                className="flex-1 rounded-xl bg-blue-900 py-3 items-center"
                                onPress={handleSaveSkillEdit}
                                disabled={saving}
                              >
                                {saving ? (
                                  <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                  <Text className="text-white font-semibold">Save</Text>
                                )}
                              </Pressable>
                            </View>
                          </>
                        ) : (
                          <>
                            <View className="flex-row items-center justify-between">
                              <Text className="text-gray-900 font-semibold">{skill.name}</Text>
                              <View className="flex-row gap-2">
                                <Pressable
                                  className="px-3 py-2 rounded-xl bg-white border border-gray-200"
                                  onPress={() => startEditSkill(skill)}
                                >
                                  <Text className="text-gray-900 text-xs font-semibold">Edit</Text>
                                </Pressable>
                                {!skill.certificate ? (
                                  <Pressable
                                    className="px-3 py-2 rounded-xl bg-white border border-gray-200"
                                    onPress={() => handleUploadSkillCertificate(skill.id)}
                                    disabled={uploadingKey === `skill:${skill.id}`}
                                  >
                                    {uploadingKey === `skill:${skill.id}` ? (
                                      <ActivityIndicator size="small" color="#111827" />
                                    ) : (
                                      <Text className="text-gray-900 text-xs font-semibold">Upload Cert</Text>
                                    )}
                                  </Pressable>
                                ) : null}
                              </View>
                            </View>
                            <Text className="text-gray-600 text-xs mt-1 capitalize">Level: {skill.level}</Text>
                            {skill.certifyingAuthority ? (
                              <Text className="text-gray-500 text-xs mt-1">Authority: {skill.certifyingAuthority}</Text>
                            ) : null}
                            {skill.validTill ? (
                              <Text className="text-gray-500 text-xs mt-1">
                                Valid till: {new Date(skill.validTill).toISOString().slice(0, 10)}
                              </Text>
                            ) : null}
                            {typeof skill.experienceYears === 'number' ? (
                              <Text className="text-gray-500 text-xs mt-1">Experience: {skill.experienceYears} years</Text>
                            ) : null}
                            <Text className="text-gray-400 text-xs mt-1">
                              {skill.certificate ? 'Certificate uploaded' : 'No certificate uploaded'}
                            </Text>
                          </>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text className="text-gray-400 text-xs mb-4">No skills added yet</Text>
              )}

              <Text className="text-gray-500 text-xs mb-2">Add New Skill</Text>

              <FormField
                label="Skill Name"
                value={newSkill.name}
                onChangeText={(text) => setNewSkill({ ...newSkill, name: text })}
                placeholder="e.g., Echocardiography"
              />

              <FormField
                label="Certifying Authority"
                value={newSkill.certifyingAuthority}
                onChangeText={(text) => setNewSkill({ ...newSkill, certifyingAuthority: text })}
                placeholder="Optional"
              />

              <Text className="text-gray-500 text-xs mt-4 mb-2">Valid Till (optional)</Text>
              <Pressable
                className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3"
                onPress={() => openDatePicker('skillValidTill')}
              >
                <Text className="text-gray-900">{formatDateLabel(newSkill.validTill)}</Text>
              </Pressable>

              <FormField
                label="Experience (years)"
                value={newSkill.experienceYears}
                onChangeText={(text) => setNewSkill({ ...newSkill, experienceYears: text })}
                placeholder="Optional"
                keyboardType="numeric"
              />

              <View className="mt-3">
                <Text className="text-gray-500 text-xs mb-2">Level</Text>
                <View className="flex-row gap-2">
                  {(['beginner', 'intermediate', 'advanced', 'expert'] as const).map((level) => (
                    <Pressable
                      key={level}
                      className={`flex-1 py-2 rounded-xl ${newSkill.level === level ? 'bg-blue-900' : 'bg-gray-100'
                        }`}
                      onPress={() => setNewSkill({ ...newSkill, level })}
                    >
                      <Text
                        className={`text-[10px] font-semibold text-center capitalize ${newSkill.level === level ? 'text-white' : 'text-gray-600'
                          }`}
                      >
                        {level}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Skill Certificate Upload (Required) */}
              <Text className="text-gray-500 text-xs mt-4 mb-2">Upload Certificate (Required)</Text>
              <View className="flex-row items-center gap-3">
                <View className="flex-1">
                  <Text className={`text-xs ${pendingSkillDoc ? 'text-green-600' : 'text-orange-500'}`}>
                    {pendingSkillDoc ? pendingSkillDoc.name : 'Required before saving'}
                  </Text>
                </View>
                <Pressable
                  className={`px-4 py-2 rounded-xl ${pendingSkillDoc ? 'bg-green-600' : 'bg-blue-900'}`}
                  onPress={handleSelectSkillDoc}
                >
                  <Text className="text-white text-xs font-semibold">
                    {pendingSkillDoc ? 'Change' : 'Select'}
                  </Text>
                </Pressable>
              </View>

              <View className="flex-row gap-3 mt-4">
                <Pressable
                  className="flex-1 rounded-xl border border-gray-200 py-3 items-center"
                  onPress={() => {
                    setExpandedSection(null);
                    setPendingSkillDoc(null);
                  }}
                >
                  <Text className="text-gray-900 font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  className={`flex-1 rounded-xl py-3 items-center ${pendingSkillDoc ? 'bg-blue-900' : 'bg-gray-300'}`}
                  onPress={handleAddSkillWithDoc}
                  disabled={saving || !pendingSkillDoc}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text className={`font-semibold ${pendingSkillDoc ? 'text-white' : 'text-gray-500'}`}>
                      Add Skill
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </SectionCard>

          {/* Experience Section */}
          <SectionCard
            icon="briefcase"
            title="Work Experience"
            status={isSectionComplete(profile, 'experience') ? 'completed' : 'warning'}
            expanded={expandedSection === 'experience'}
            onToggle={() => toggleSection('experience')}
          >
            <View className="mb-3 px-4 py-2 bg-blue-50 border border-blue-100 rounded-lg flex-row items-center justify-between">
              <Text className="text-blue-900 text-xs font-semibold">Total Calculated Experience</Text>
              <Text className="text-blue-900 text-sm font-bold">{profile?.yearsOfExperience || 0} Years</Text>
            </View>
            <View className="pt-3">
              {/* Platform Stats */}
              <Text className="text-gray-900 font-semibold mb-3">On-Platform Stats</Text>
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                  <Text className="text-gray-500 text-[10px]">Jobs Completed</Text>
                  <Text className="mt-1 text-gray-900 text-xl font-semibold">
                    {profile?.stats?.jobsCompleted || 0}
                  </Text>
                </View>
                <View className="flex-1 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                  <Text className="text-gray-500 text-[10px]">Attendance Rate</Text>
                  <Text className="mt-1 text-gray-900 text-xl font-semibold">
                    {profile?.stats?.attendanceRate || 0}%
                  </Text>
                </View>
              </View>

              {/* Existing off-platform experience */}
              {editProfile?.experience && editProfile.experience.length > 0 ? (
                <View className="mb-6">
                  <Text className="text-gray-500 text-xs mb-2">Off-Platform Experience</Text>
                  {editProfile.experience.map((exp: any) => (
                    <View key={exp.id} className="mb-3 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                      {editingExperienceId === exp.id ? (
                        <>
                          <Text className="text-gray-900 font-semibold mb-2">Edit Experience</Text>
                          <FormField
                            label="Role Title"
                            value={experienceEdit.role}
                            onChangeText={(text) => setExperienceEdit((p) => ({ ...p, role: text }))}
                            placeholder="e.g., Senior Cardiologist"
                          />
                          <FormField
                            label="Institution"
                            value={experienceEdit.institution}
                            onChangeText={(text) => setExperienceEdit((p) => ({ ...p, institution: text }))}
                            placeholder="Hospital name"
                          />
                          <FormField
                            label="Department"
                            value={experienceEdit.department}
                            onChangeText={(text) => setExperienceEdit((p) => ({ ...p, department: text }))}
                            placeholder="e.g., Cardiology"
                          />

                          <View className="mt-3 flex-row items-center justify-between">
                            <Text className="text-gray-500 text-xs">Currently working here</Text>
                            <Pressable
                              className={`h-8 w-14 rounded-full ${experienceEdit.isCurrent ? 'bg-green-500' : 'bg-gray-200'} px-1 justify-center`}
                              onPress={() => setExperienceEdit((p) => ({ ...p, isCurrent: !p.isCurrent }))}
                            >
                              <View
                                className={`h-6 w-6 rounded-full bg-white ${experienceEdit.isCurrent ? 'ml-auto' : ''}`}
                              />
                            </Pressable>
                          </View>

                          <Text className="text-gray-500 text-xs mt-4 mb-2">Start Date</Text>
                          <Pressable
                            className="rounded-xl bg-white border border-gray-200 px-4 py-3"
                            onPress={() => openDatePicker('experienceEditStart')}
                          >
                            <Text className="text-gray-900">{formatDateLabel(experienceEdit.startDate)}</Text>
                          </Pressable>

                          {!experienceEdit.isCurrent ? (
                            <>
                              <Text className="text-gray-500 text-xs mt-4 mb-2">End Date (optional)</Text>
                              <Pressable
                                className="rounded-xl bg-white border border-gray-200 px-4 py-3"
                                onPress={() => openDatePicker('experienceEditEnd')}
                              >
                                <Text className="text-gray-900">{formatDateLabel(experienceEdit.endDate)}</Text>
                              </Pressable>
                            </>
                          ) : null}

                          <View className="mt-3 flex-row items-center justify-between">
                            <Text className="text-gray-400 text-xs">
                              {exp.documents && exp.documents.length > 0
                                ? `${exp.documents.length} document(s) uploaded`
                                : 'No documents uploaded'}
                            </Text>
                            {!(exp.documents && exp.documents.length > 0) ? (
                              <Pressable
                                className="px-3 py-2 rounded-xl bg-white border border-gray-200"
                                onPress={() => handleUploadExperienceDocument(exp.id)}
                                disabled={uploadingKey === `exp:${exp.id}`}
                              >
                                {uploadingKey === `exp:${exp.id}` ? (
                                  <ActivityIndicator size="small" color="#111827" />
                                ) : (
                                  <Text className="text-gray-900 text-xs font-semibold">Upload Doc</Text>
                                )}
                              </Pressable>
                            ) : null}
                          </View>

                          <View className="flex-row gap-3 mt-4">
                            <Pressable
                              className="flex-1 rounded-xl border border-gray-200 py-3 items-center"
                              onPress={cancelEditExperience}
                            >
                              <Text className="text-gray-900 font-semibold">Cancel</Text>
                            </Pressable>
                            <Pressable
                              className="flex-1 rounded-xl bg-blue-900 py-3 items-center"
                              onPress={handleSaveExperienceEdit}
                              disabled={saving}
                            >
                              {saving ? (
                                <ActivityIndicator color="#fff" size="small" />
                              ) : (
                                <Text className="text-white font-semibold">Save</Text>
                              )}
                            </Pressable>
                          </View>
                        </>
                      ) : (
                        <>
                          <View className="flex-row items-center justify-between">
                            <Text className="text-gray-900 font-semibold">{exp.role}</Text>
                            <View className="flex-row gap-2">
                              <Pressable
                                className="px-3 py-2 rounded-xl bg-white border border-gray-200"
                                onPress={() => startEditExperience(exp)}
                              >
                                <Text className="text-gray-900 text-xs font-semibold">Edit</Text>
                              </Pressable>
                              {!(exp.documents && exp.documents.length > 0) ? (
                                <Pressable
                                  className="px-3 py-2 rounded-xl bg-white border border-gray-200"
                                  onPress={() => handleUploadExperienceDocument(exp.id)}
                                  disabled={uploadingKey === `exp:${exp.id}`}
                                >
                                  {uploadingKey === `exp:${exp.id}` ? (
                                    <ActivityIndicator size="small" color="#111827" />
                                  ) : (
                                    <Text className="text-gray-900 text-xs font-semibold">Upload Doc</Text>
                                  )}
                                </Pressable>
                              ) : null}
                            </View>
                          </View>
                          <Text className="text-gray-600 text-xs mt-1">{exp.institution}</Text>
                          {exp.department ? <Text className="text-gray-500 text-xs mt-1">{exp.department}</Text> : null}
                          {(exp.startDate || exp.endDate) ? (
                            <Text className="text-gray-500 text-xs mt-1">
                              {[
                                exp.startDate ? String(exp.startDate).slice(0, 10) : null,
                                exp.isCurrent ? 'Present' : exp.endDate ? String(exp.endDate).slice(0, 10) : null,
                              ]
                                .filter(Boolean)
                                .join(' - ')}
                            </Text>
                          ) : null}
                          <Text className="text-gray-400 text-xs mt-1">
                            {exp.documents && exp.documents.length > 0
                              ? `${exp.documents.length} document(s) uploaded`
                              : 'No documents uploaded'}
                          </Text>
                        </>
                      )}
                    </View>
                  ))}
                </View>
              ) : null}

              <Text className="text-gray-900 font-semibold mb-3">Add Off-Platform Experience</Text>

              <FormField
                label="Role Title"
                value={newExperience.role}
                onChangeText={(text) => setNewExperience({ ...newExperience, role: text })}
                placeholder="e.g., Senior Cardiologist"
              />
              <FormField
                label="Institution"
                value={newExperience.institution}
                onChangeText={(text) => setNewExperience({ ...newExperience, institution: text })}
                placeholder="Hospital name"
              />
              <FormField
                label="Department"
                value={newExperience.department}
                onChangeText={(text) => setNewExperience({ ...newExperience, department: text })}
                placeholder="e.g., Cardiology"
              />

              <View className="mt-3 flex-row items-center justify-between">
                <Text className="text-gray-500 text-xs">Currently working here</Text>
                <Pressable
                  className={`h-8 w-14 rounded-full ${newExperience.isCurrent ? 'bg-green-500' : 'bg-gray-200'} px-1 justify-center`}
                  onPress={() => setNewExperience((p) => ({ ...p, isCurrent: !p.isCurrent }))}
                >
                  <View
                    className={`h-6 w-6 rounded-full bg-white ${newExperience.isCurrent ? 'ml-auto' : ''}`}
                  />
                </Pressable>
              </View>

              <Text className="text-gray-500 text-xs mt-4 mb-2">Start Date</Text>
              <Pressable
                className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3"
                onPress={() => openDatePicker('experienceStart')}
              >
                <Text className="text-gray-900">{formatDateLabel(newExperience.startDate)}</Text>
              </Pressable>

              {!newExperience.isCurrent ? (
                <>
                  <Text className="text-gray-500 text-xs mt-4 mb-2">End Date (optional)</Text>
                  <Pressable
                    className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3"
                    onPress={() => openDatePicker('experienceEnd')}
                  >
                    <Text className="text-gray-900">{formatDateLabel(newExperience.endDate)}</Text>
                  </Pressable>
                </>
              ) : null}

              {/* Experience Document Upload (Required) */}
              <Text className="text-gray-500 text-xs mt-4 mb-2">Upload Experience Letter/Document (Required)</Text>
              <View className="flex-row items-center gap-3">
                <View className="flex-1">
                  <Text className={`text-xs ${pendingExperienceDoc ? 'text-green-600' : 'text-orange-500'}`}>
                    {pendingExperienceDoc ? pendingExperienceDoc.name : 'Required before saving'}
                  </Text>
                </View>
                <Pressable
                  className={`px-4 py-2 rounded-xl ${pendingExperienceDoc ? 'bg-green-600' : 'bg-blue-900'}`}
                  onPress={handleSelectExperienceDoc}
                >
                  <Text className="text-white text-xs font-semibold">
                    {pendingExperienceDoc ? 'Change' : 'Select'}
                  </Text>
                </Pressable>
              </View>

              <View className="flex-row gap-3 mt-4">
                <Pressable
                  className="flex-1 rounded-xl border border-gray-200 py-3 items-center"
                  onPress={() => {
                    setExpandedSection(null);
                    setPendingExperienceDoc(null);
                  }}
                >
                  <Text className="text-gray-900 font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  className={`flex-1 rounded-xl py-3 items-center ${pendingExperienceDoc ? 'bg-blue-900' : 'bg-gray-300'}`}
                  onPress={handleAddExperienceWithDoc}
                  disabled={saving || !pendingExperienceDoc}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text className={`font-semibold ${pendingExperienceDoc ? 'text-white' : 'text-gray-500'}`}>
                      Add Experience
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </SectionCard>

          {/* Job Preferences Section */}
          <SectionCard
            icon="settings"
            title="Job Preferences"
            status={isSectionComplete(profile, 'preferences') ? 'completed' : 'warning'}
            expanded={expandedSection === 'jobPreference'}
            onToggle={() => toggleSection('jobPreference')}
          >
            <View className="pt-3">
              <Text className="text-gray-900 font-semibold mb-2">Current Job Status</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {[
                  { label: 'Available', value: 'available' },
                  { label: 'Not Available', value: 'not_available' },
                ].map((status) => (
                  <Pressable
                    key={status.value}
                    className={`rounded-xl px-3 py-2 border ${preferences.jobStatus === status.value
                      ? 'bg-blue-900 border-blue-900'
                      : 'bg-white border-gray-200'
                      }`}
                    onPress={() => setPreferences({ ...preferences, jobStatus: status.value })}
                  >
                    <Text
                      className={`text-xs font-semibold ${preferences.jobStatus === status.value ? 'text-white' : 'text-gray-600'
                        }`}
                    >
                      {status.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                className="flex-row items-center mb-4"
                onPress={() => setPreferences({ ...preferences, willingToRelocate: !preferences.willingToRelocate })}
              >
                <View className={`h-5 w-5 rounded border items-center justify-center mr-2 ${preferences.willingToRelocate ? 'bg-blue-900 border-blue-900' : 'bg-white border-gray-300'
                  }`}>
                  {preferences.willingToRelocate && <Ionicons name="checkmark" size={14} color="white" />}
                </View>
                <Text className="text-gray-900 font-medium">Willing to Relocate</Text>
              </Pressable>

              <Text className="text-gray-900 font-semibold mb-2">Expected Rate</Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {[
                  { label: 'Hourly', value: 'per_hour' },
                  { label: 'Daily', value: 'per_day' },
                  { label: 'Monthly', value: 'per_month' },
                  { label: 'Per Patient', value: 'per_patient' },
                ].map((unit) => (
                  <Pressable
                    key={unit.value}
                    className={`rounded-xl px-3 py-2 border ${preferences.rateUnit === unit.value
                      ? 'bg-blue-900 border-blue-900'
                      : 'bg-white border-gray-200'
                      }`}
                    onPress={() => setPreferences({ ...preferences, rateUnit: unit.value })}
                  >
                    <Text
                      className={`text-xs font-semibold ${preferences.rateUnit === unit.value ? 'text-white' : 'text-gray-600'
                        }`}
                    >
                      {unit.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <FormField
                label={`Rate Amount (₹)`}
                value={preferences.minRate}
                onChangeText={(text) => setPreferences({ ...preferences, minRate: text })}
                placeholder="e.g. 500"
                keyboardType="numeric"
              />

              <FormField
                label="Years of Experience"
                value={preferences.experienceYears}
                onChangeText={(text) => setPreferences({ ...preferences, experienceYears: text })}
                placeholder="e.g., 4"
                keyboardType="numeric"
              />

              <Text className="text-gray-900 font-semibold mt-4 mb-3">Job Type</Text>
              <View className="flex-row gap-3 mb-4">
                {['Long Term', 'Short Term', 'Locum'].map((type) => (
                  <Pressable
                    key={type}
                    className={`flex-1 rounded-xl px-2 py-2 ${preferences.jobTypes.includes(type) ? 'bg-blue-900' : 'bg-gray-100'
                      }`}
                    onPress={() => {
                      const types = preferences.jobTypes.includes(type)
                        ? preferences.jobTypes.filter((t) => t !== type)
                        : [...preferences.jobTypes, type];
                      setPreferences({ ...preferences, jobTypes: types });
                    }}
                  >
                    <Text
                      className={`text-xs font-semibold text-center ${preferences.jobTypes.includes(type) ? 'text-white' : 'text-gray-600'
                        }`}
                    >
                      {type}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text className="text-gray-900 font-semibold mb-3">Travel Radius</Text>
              <View className="flex-row gap-2 mb-4">
                {[5, 10, 15, 20, 50].map((radius) => (
                  <Pressable
                    key={radius}
                    className={`px-4 py-2 rounded-xl ${preferences.travelRadius === radius ? 'bg-blue-900' : 'bg-gray-100'
                      }`}
                    onPress={() => setPreferences({ ...preferences, travelRadius: radius })}
                  >
                    <Text
                      className={`text-xs font-semibold ${preferences.travelRadius === radius ? 'text-white' : 'text-gray-600'
                        }`}
                    >
                      {radius}km
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text className="text-gray-900 font-semibold mt-4 mb-2">Preferred Location</Text>
              <StateCitySelector
                state={preferences.preferredState}
                city={preferences.preferredCity}
                onStateChange={(state) => {
                  setPreferences({ ...preferences, preferredState: state, preferredCity: '' });
                }}
                onCityChange={(city) => {
                  setPreferences({ ...preferences, preferredCity: city });
                }}
              />

              <View className="flex-row gap-3 mt-4">
                <Pressable
                  className="flex-1 rounded-xl border border-gray-200 py-3 items-center"
                  onPress={() => setExpandedSection(null)}
                >
                  <Text className="text-gray-900 font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  className="flex-1 rounded-xl bg-blue-900 py-3 items-center"
                  onPress={handleSavePreferences}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text className="text-white font-semibold">Save Preferences</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </SectionCard>

          <View className="h-10" />
        </View>
      </ScrollView>

      {datePicker.visible ? (
        <DateTimePicker
          value={(() => {
            switch (datePicker.key) {
              case 'experienceStart':
                return newExperience.startDate || new Date();
              case 'experienceEnd':
                return newExperience.endDate || new Date();
              case 'skillValidTill':
                return newSkill.validTill || new Date();
              case 'skillEditValidTill':
                return skillEdit.validTill || new Date();
              case 'licenseNewValidFrom':
                return newLicense.validFrom || new Date();
              case 'licenseNewValidTill':
                return newLicense.validTill || new Date();
              case 'licenseEditValidFrom':
                return licenseEdit.validFrom || new Date();
              case 'licenseEditValidTill':
                return licenseEdit.validTill || new Date();
              case 'experienceEditStart':
                return experienceEdit.startDate || new Date();
              case 'experienceEditEnd':
                return experienceEdit.endDate || new Date();
              default:
                return new Date();
            }
          })()}
          mode="date"
          display="default"
          onChange={(event: any, selectedDate?: Date) => {
            // Android fires twice; iOS uses dismiss on cancel.
            setDatePicker({ key: null, visible: false });
            if (event?.type === 'dismissed') return;
            if (selectedDate) onDatePicked(datePicker.key, selectedDate);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ============ Section Card Component ============
function SectionCard({
  icon,
  title,
  status,
  expanded,
  onToggle,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  status: 'completed' | 'warning';
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-3 rounded-2xl bg-white border border-gray-100 overflow-hidden">
      <Pressable className="flex-row items-center justify-between px-4 py-4" onPress={onToggle}>
        <View className="flex-row items-center flex-1">
          <View className="h-11 w-11 rounded-2xl bg-blue-50 items-center justify-center">
            <Ionicons name={icon} size={20} color="#1e3a8a" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-gray-900 font-semibold">{title}</Text>
            <View className="mt-1 flex-row items-center">
              <Ionicons
                name={status === 'completed' ? 'checkmark-circle' : 'alert-circle'}
                size={14}
                color={status === 'completed' ? '#16a34a' : '#f59e0b'}
              />
              <Text
                className={`ml-1 text-xs ${status === 'completed' ? 'text-green-600' : 'text-amber-600'}`}
              >
                {status === 'completed' ? 'Completed' : 'Needs Attention'}
              </Text>
            </View>
          </View>
        </View>
        <View className="h-11 w-11 rounded-2xl bg-blue-900 items-center justify-center">
          <Ionicons name={expanded ? 'chevron-down' : 'create-outline'} size={20} color="#fff" />
        </View>
      </Pressable>
      {expanded && <View className="px-4 pb-4">{children}</View>}
    </View>
  );
}

// ============ Form Field Component ============
function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  flex,
  verified,
  editable = true,
  keyboardType = 'default',
}: {
  label: string;
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder: string;
  flex?: boolean;
  verified?: boolean;
  editable?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
}) {
  return (
    <View className={flex ? 'flex-1 mt-3' : 'mt-3'}>
      <Text className="text-gray-500 text-xs mb-2">{label}</Text>
      <View className="flex-row items-center">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          editable={editable}
          keyboardType={keyboardType}
          className={`flex-1 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-gray-900 ${!editable ? 'opacity-60' : ''
            }`}
          placeholderTextColor="#9ca3af"
        />
        {verified && (
          <View className="absolute right-3">
            <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
          </View>
        )}
      </View>
    </View>
  );
}
