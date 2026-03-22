import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
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
  Switch,
  Modal,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Colors } from '@/constants/Colors';
import { useHospitalProfile, HospitalProfile, HospitalEditProfile } from '@/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { hospitalApi } from '@/services/api';
import { StateCitySelector } from '@/app/_components/StateCitySelector';

type SectionKey = 'general' | 'representative' | 'staffing' | 'infrastructure' | 'credentials' | null;

// Helper to get profile completion percentage
const getProfileCompletion = (profile: HospitalProfile | null) => {
  if (!profile) return { percentage: 0 };
  const completion = profile.profileCompletion;
  if (typeof completion === 'number') return { percentage: completion };
  return { percentage: 0 };
};

import {
  createFormData,
  validateImage,
  validateDocument,
  getOptimizedImageUrl,
  compressImage,
} from '@/utils/upload';

const getProfileSections = (profile: HospitalProfile | null | undefined) => {
  const sections = profile?.profileCompletionDetails?.sections;
  if (sections && typeof sections === 'object') return sections;
  return undefined;
};

const isSectionComplete = (
  profile: HospitalProfile | null | undefined,
  section: 'generalInfo' | 'representativeDetails' | 'staffingDetails' | 'infrastructureDetails' | 'trustVerification'
) => {
  const sections: any = getProfileSections(profile);
  return sections?.[section] === true;
};

export default function HospitalEditProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string }>();
  const { profile, isLoading, refresh, fetchEditProfile, editProfile } = useHospitalProfile();
  const { refreshUser } = useAuth();

  const [expandedSection, setExpandedSection] = useState<SectionKey>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [showHospitalTypeModal, setShowHospitalTypeModal] = useState(false);

  // Phone OTP verification state
  const [phoneOtp, setPhoneOtp] = useState('');
  const [showPhoneOtpInput, setShowPhoneOtpInput] = useState(false);
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
  const [verifyingPhoneOtp, setVerifyingPhoneOtp] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);

  // Representative Email OTP verification state
  const [repEmailOtp, setRepEmailOtp] = useState('');
  const [showRepEmailOtpInput, setShowRepEmailOtpInput] = useState(false);
  const [sendingRepEmailOtp, setSendingRepEmailOtp] = useState(false);
  const [verifyingRepEmailOtp, setVerifyingRepEmailOtp] = useState(false);
  const [isRepEmailVerified, setIsRepEmailVerified] = useState(false);

  // General Info Form State
  const [generalInfo, setGeneralInfo] = useState({
    name: '',
    type: '',
    email: '',
    phone: '',
    website: '',
    description: '',
    address: { street: '', city: '', state: '', pincode: '', country: 'India' },
  });

  // Representative Details Form State
  const [representative, setRepresentative] = useState({
    fullName: '',
    email: '',
    phone: '',
  });

  const [aadhaarNumber, setAadhaarNumber] = useState('');

  // Staffing Details Form State
  const [staffing, setStaffing] = useState({
    totalDoctors: '',
    totalNurses: '',
    totalStaff: '',
  });

  // Infrastructure Details Form State
  const [infrastructure, setInfrastructure] = useState({
    totalBeds: '',
    icuBeds: '',
    nicuPicuBeds: '',
    emergencyBeds: '',
    operationTheaters: '',
  });

  // Facilities Form State
  const [facilities, setFacilities] = useState({
    opFacility: false,
    ipFacility: false,
    ipBeds: '',
    emergency24x7: false,
    icuFacilities: false,
    nicuPicu: false,
    operationTheatre: false,
    diagnosticLab: false,
    labFacilities: [] as string[],
    radiologyDepartment: false,
    imagingFacilities: [] as string[],
    pharmacy: false,
    pharmacyAvailable24x7: false,
    bloodBank: false,
    ambulanceService: false,
    securityAvailable: false,
  });

  // Credentials Form State
  const [credentials, setCredentials] = useState({
    registrationNumber: '',
    accreditations: [] as string[],
    chiefDoctorRegNumber: '',
  });

  const [newAccreditation, setNewAccreditation] = useState('');

  // HOSPITAL TYPES
  const HOSPITAL_TYPES = [
    'government',
    'private',
    'trust',
    'corporate',
    'clinic',
    'nursing_home',
    'multi_specialty',
    'super_specialty',
    'primary_health_center',
    'community_health_center',
    'diagnostic_lab',
    'radiology_centre',
    'pharmacy',
    'others',
  ];

  const parsePhoneToBackend = (value: string) => {
    const cleaned = (value || '').replace(/\s/g, '');
    if (!cleaned) return undefined;

    // Allow inputs like +91XXXXXXXXXX or 91XXXXXXXXXX or XXXXXXXXXX
    const digitsOnly = cleaned.replace(/[^0-9]/g, '');

    let number = digitsOnly;
    if (number.length === 12 && number.startsWith('91')) {
      number = number.slice(2);
    }

    if (!/^[6-9]\d{9}$/.test(number)) {
      return null;
    }

    return { countryCode: '+91', number };
  };

  // ACCREDITATION OPTIONS
  const ACCREDITATION_OPTIONS = ['NABH', 'NABL', 'JCI', 'ISO 9001', 'ISO 14001'];

  // LAB FACILITIES OPTIONS
  const LAB_FACILITIES_OPTIONS = ['Pathology', 'Microbiology', 'Biochemistry', 'Hematology', 'Immunology'];

  // IMAGING FACILITIES OPTIONS
  const IMAGING_OPTIONS = ['X-Ray', 'CT Scan', 'MRI', 'Ultrasound', 'Mammography', 'PET Scan'];

  // Load profile data into forms
  useEffect(() => {
    if (profile) {
      setGeneralInfo({
        name: profile.name || '',
        type: profile.type || '',
        email: profile.email || '',
        phone: profile.phone?.number || '',
        website: profile.website || '',
        description: profile.description || '',
        address: {
          street: profile.address?.street || profile.location?.street || '',
          city: profile.location?.city || profile.address?.city || '',
          state: profile.location?.state || profile.address?.state || '',
          pincode: profile.address?.pincode || profile.address?.postalCode || profile.location?.pincode || '',
          country: profile.address?.country || 'India',
        },
      });

      // Sync phone verification status
      setIsPhoneVerified(profile.phone?.isVerified || false);

      if (profile.representative) {
        setRepresentative({
          fullName: profile.representative.fullName || '',
          email: profile.representative.email || '',
          phone: profile.representative.phone?.number || '',
        });
        // Sync representative email verification status (assuming backend sends emailVerified)
        setIsRepEmailVerified((profile.representative as any).emailVerified || false);
      }

      if (profile.staffing) {
        setStaffing({
          totalDoctors: profile.staffing.totalDoctors?.toString() || '',
          totalNurses: profile.staffing.totalNurses?.toString() || '',
          totalStaff: profile.staffing.totalStaff?.toString() || '',
        });
      }

      if (profile.infrastructure) {
        setInfrastructure({
          totalBeds: profile.infrastructure.totalBeds?.toString() || '',
          icuBeds: profile.infrastructure.icuBeds?.toString() || '',
          nicuPicuBeds: profile.infrastructure.nicuPicuBeds?.toString() || '',
          emergencyBeds: profile.infrastructure.emergencyBeds?.toString() || '',
          operationTheaters: profile.infrastructure.operationTheaters?.toString() || '',
        });
      }

      if (profile.facilities) {
        setFacilities({
          opFacility: profile.facilities.opFacility || false,
          ipFacility: profile.facilities.ipFacility || false,
          ipBeds: profile.facilities.ipBeds?.toString() || '',
          emergency24x7: profile.facilities.emergency24x7 || false,
          icuFacilities: profile.facilities.icuFacilities || false,
          nicuPicu: profile.facilities.nicuPicu || profile.facilities.nicuPicuFacilities || false,
          operationTheatre: profile.facilities.operationTheatre || false,
          diagnosticLab: profile.facilities.diagnosticLab || false,
          labFacilities: profile.facilities.labFacilities || [],
          radiologyDepartment: profile.facilities.radiologyDepartment || false,
          imagingFacilities: profile.facilities.imagingFacilities || [],
          pharmacy: profile.facilities.pharmacy || false,
          pharmacyAvailable24x7: profile.facilities.pharmacyAvailable24x7 || false,
          bloodBank: profile.facilities.bloodBank || false,
          ambulanceService: profile.facilities.ambulanceService || false,
          securityAvailable: profile.facilities.securityAvailable || false,
        });
      }

      if (profile.credentials) {
        setCredentials({
          registrationNumber: profile.credentials.registrationNumber || profile.registrationNumber || '',
          accreditations: profile.credentials.accreditations || [],
          chiefDoctorRegNumber: profile.credentials.chiefDoctorRegNumber || '',
        });
      }
    }
  }, [profile]);

  // Load editProfile data (structured for editing) when available
  // EFFECT DISABLED: Relying on 'profile' (published data) to ensure form loads with current data.
  /*
  useEffect(() => {
    if (!editProfile) return;
  
    // General Info from editProfile
    const gi = editProfile.generalInfo;
    if (gi) {
      setGeneralInfo((prev) => ({
        name: gi.hospitalName || prev.name,
        type: gi.hospitalType || prev.type,
        email: gi.email || prev.email,
        phone: prev.phone, // phone is not in generalInfo
        website: gi.website || prev.website,
        description: gi.description || prev.description,
        address: {
          street: gi.address?.street || prev.address.street,
          city: gi.address?.city || prev.address.city,
          state: gi.address?.state || prev.address.state,
          pincode: gi.address?.pincode || prev.address.pincode,
          country: gi.address?.country || prev.address.country || 'India',
        },
      }));
    }
  
    // Representative from editProfile
    const rep = editProfile.representativeDetails;
    if (rep) {
      setRepresentative((prev) => ({
        fullName: rep.fullName || prev.fullName,
        email: rep.email || prev.email,
        phone: rep.phone?.number || prev.phone,
      }));
    }
  
    // Staffing from editProfile
    const staff = editProfile.staffingDetails;
    if (staff) {
      setStaffing((prev) => ({
        totalDoctors: staff.totalDoctors?.toString() || prev.totalDoctors,
        totalNurses: staff.totalNurses?.toString() || prev.totalNurses,
        totalStaff: staff.totalStaff?.toString() || prev.totalStaff,
      }));
    }
  
    // Infrastructure from editProfile
    const infra = editProfile.infrastructureDetails;
    if (infra) {
      setInfrastructure((prev) => ({
        totalBeds: prev.totalBeds, // Keep from profile, infrastructure is in facilities
        icuBeds: infra.icuBeds?.toString() || prev.icuBeds,
        nicuPicuBeds: infra.nicuPicuBeds?.toString() || prev.nicuPicuBeds,
        emergencyBeds: infra.emergencyBeds?.toString() || prev.emergencyBeds,
        operationTheaters: infra.operationTheaters?.toString() || prev.operationTheaters,
      }));
  
      setFacilities((prev) => ({
        opFacility: infra.opFacility ?? prev.opFacility,
        ipFacility: infra.ipFacility ?? prev.ipFacility,
        ipBeds: infra.ipBeds?.toString() || prev.ipBeds,
        emergency24x7: prev.emergency24x7, // Not in infrastructureDetails
        icuFacilities: infra.icuFacilities ?? prev.icuFacilities,
        nicuPicu: infra.nicuPicuFacilities ?? prev.nicuPicu,
        operationTheatre: infra.operationTheatre ?? prev.operationTheatre,
        diagnosticLab: infra.diagnosticLab ?? prev.diagnosticLab,
        labFacilities: infra.labFacilities || prev.labFacilities,
        radiologyDepartment: infra.radiologyDepartment ?? prev.radiologyDepartment,
        imagingFacilities: infra.imagingFacilities || prev.imagingFacilities,
        pharmacy: infra.pharmacy ?? prev.pharmacy,
        pharmacyAvailable24x7: infra.pharmacyAvailable24x7 ?? prev.pharmacyAvailable24x7,
        bloodBank: prev.bloodBank,
        ambulanceService: prev.ambulanceService,
        securityAvailable: infra.securityAvailable ?? prev.securityAvailable,
      }));
    }
  
    // Credentials from editProfile
    const trust = editProfile.trustVerification;
    if (trust) {
      setCredentials((prev) => ({
        registrationNumber: trust.registrationNumber || prev.registrationNumber,
        accreditations: trust.accreditations || prev.accreditations,
        chiefDoctorRegNumber: trust.chiefDoctorRegNumber || prev.chiefDoctorRegNumber,
      }));
    }
  }, [editProfile]);
  */

  // Fetch edit profile on mount
  useEffect(() => {
    if (profile) {
      void fetchEditProfile();
    }
  }, [profile?.email]);

  // Handle section param from URL
  useEffect(() => {
    if (params.section) {
      const sectionMap: Record<string, SectionKey> = {
        general: 'general',
        representative: 'representative',
        staffing: 'staffing',
        infrastructure: 'infrastructure',
        credentials: 'credentials',
      };
      const section = sectionMap[params.section];
      if (section) {
        setExpandedSection(section);
      }
    }
  }, [params.section]);

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

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) return null;
    return result.assets?.[0] || null;
  };

  // ============ Logo Upload ============
  const handleLogoUpload = async () => {
    try {
      const asset = await pickImage();
      if (!asset) return;

      setUploadingLogo(true);

      // Compress logo
      const compressed = await compressImage(asset.uri, { maxWidth: 800, quality: 0.8 });

      const formData = createFormData(compressed.uri, 'logo', {
        fileName: asset.fileName || `logo_${Date.now()}.jpg`,
        type: 'image/jpeg', // compressImage outputs JPEG by default
      });

      const response = await hospitalApi.uploadLogo(formData);

      if (response.success) {
        Alert.alert('Success', 'Logo updated successfully');
        await refresh();
      } else {
        Alert.alert('Error', response.message || 'Failed to upload logo');
      }
    } catch (err: any) {
      console.error('Logo upload error:', err);
      Alert.alert('Error', err.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  // ============ Phone OTP Verification ============
  const handleSendPhoneOtp = async () => {
    const cleanPhone = generalInfo.phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid', 'Please enter a valid 10-digit phone number');
      return;
    }

    try {
      setSendingPhoneOtp(true);
      const response = await hospitalApi.sendPhoneOtp(cleanPhone);

      if (response.success) {
        setShowPhoneOtpInput(true);
        Alert.alert('OTP Sent', 'A verification code has been sent to your phone number');
        // In dev mode, log the OTP
        if ((response.data as any)?.devOtp) {
          console.log('[DEV] Phone OTP:', (response.data as any).devOtp);
        }
      } else {
        Alert.alert('Error', response.message || response.error || 'Failed to send OTP');
      }
    } catch (err: any) {
      console.error('Send OTP error:', err);
      Alert.alert('Error', err.message || 'Failed to send OTP');
    } finally {
      setSendingPhoneOtp(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (!phoneOtp || phoneOtp.length !== 6) {
      Alert.alert('Invalid', 'Please enter the 6-digit OTP');
      return;
    }

    const cleanPhone = generalInfo.phone.replace(/\D/g, '');

    try {
      setVerifyingPhoneOtp(true);
      const response = await hospitalApi.verifyPhoneOtp(cleanPhone, phoneOtp);

      if (response.success) {
        setIsPhoneVerified(true);
        setShowPhoneOtpInput(false);
        setPhoneOtp('');
        Alert.alert('Success', 'Phone number verified successfully');
        await refresh();
      } else {
        Alert.alert('Error', response.message || response.error || 'Invalid OTP');
      }
    } catch (err: any) {
      console.error('Verify OTP error:', err);
      Alert.alert('Error', err.message || 'Failed to verify OTP');
    } finally {
      setVerifyingPhoneOtp(false);
    }
  };

  // ============ Representative Email OTP Handlers ============
  const handleSendRepEmailOtp = async () => {
    if (!representative.email) {
      Alert.alert('Invalid', 'Please enter a valid email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(representative.email)) {
      Alert.alert('Invalid', 'Please enter a valid email address');
      return;
    }

    try {
      setSendingRepEmailOtp(true);
      const response = await hospitalApi.sendRepresentativeEmailOtp(representative.email);

      if (response.success) {
        setShowRepEmailOtpInput(true);
        Alert.alert('OTP Sent', 'A verification code has been sent to your email');
        // In dev mode, log the OTP
        if ((response.data as any)?.devOtp) {
          console.log('[DEV] Email OTP:', (response.data as any).devOtp);
        }
      } else {
        Alert.alert('Error', response.message || response.error || 'Failed to send OTP');
      }
    } catch (err: any) {
      console.error('Send Email OTP error:', err);
      Alert.alert('Error', err.message || 'Failed to send OTP');
    } finally {
      setSendingRepEmailOtp(false);
    }
  };

  const handleVerifyRepEmailOtp = async () => {
    if (!repEmailOtp || repEmailOtp.length !== 6) {
      Alert.alert('Invalid', 'Please enter the 6-digit OTP');
      return;
    }

    try {
      setVerifyingRepEmailOtp(true);
      const response = await hospitalApi.verifyRepresentativeEmailOtp(representative.email, repEmailOtp);

      if (response.success) {
        setIsRepEmailVerified(true);
        setShowRepEmailOtpInput(false);
        setRepEmailOtp('');
        Alert.alert('Success', 'Email verified successfully');
        // We can optionally refresh to get the updated status from backend, 
        // essentially satisfying the 'add it' part if the backend verification saves it.
        await refresh();
      } else {
        Alert.alert('Error', response.message || response.error || 'Invalid OTP');
      }
    } catch (err: any) {
      console.error('Verify Email OTP error:', err);
      Alert.alert('Error', err.message || 'Failed to verify OTP');
    } finally {
      setVerifyingRepEmailOtp(false);
    }
  };

  // ============ Save General Info ============
  const handleSaveGeneralInfo = async () => {
    try {
      setSaving(true);
      const response = await hospitalApi.updateGeneralInfo({
        hospitalName: generalInfo.name,
        hospitalType: generalInfo.type,
        phone: generalInfo.phone,
        website: generalInfo.website || undefined,
        description: generalInfo.description || undefined,
        address: {
          street: generalInfo.address.street || undefined,
          city: generalInfo.address.city || undefined,
          state: generalInfo.address.state || undefined,
          pincode: generalInfo.address.pincode || undefined,
          country: generalInfo.address.country || undefined,
        },
      });

      if (response.success) {
        Alert.alert('Success', 'General info updated successfully');
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

  // ============ Save Representative Details ============
  const handleSaveRepresentative = async () => {
    try {
      setSaving(true);

      const phone = parsePhoneToBackend(representative.phone);
      if (phone === null) {
        Alert.alert('Invalid phone', 'Please enter a valid 10-digit Indian mobile number');
        return;
      }

      // Verify Email if present
      if (representative.email && !isRepEmailVerified) {
        Alert.alert('Verification Required', 'Please verify the representative email before saving.');
        return;
      }

      const response = await hospitalApi.updateRepresentativeDetails({
        fullName: representative.fullName,
        email: representative.email,
        ...(phone ? { phone } : {}),
      });

      if (response.success) {
        Alert.alert('Success', 'Representative details updated successfully');
        await refresh();
      } else {
        Alert.alert('Error', response.message || 'Failed to update');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ============ Save Representative Aadhaar ============
  const handleSaveRepresentativeAadhaar = async () => {
    if (!aadhaarNumber || aadhaarNumber.replace(/\s/g, '').length < 12) {
      Alert.alert('Required', 'Please enter a valid Aadhaar number');
      return;
    }

    try {
      setSaving(true);
      const response = await hospitalApi.updateRepresentativeAadhaar(aadhaarNumber.replace(/\s/g, ''));
      if (response.success) {
        Alert.alert('Success', 'Aadhaar updated successfully');
        setAadhaarNumber('');
        await fetchEditProfile();
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

  // ============ Upload Representative Aadhaar Document ============
  const handleUploadRepresentativeAadhaarDocument = async () => {
    try {
      const asset = await pickDocument();
      if (!asset) return;

      setUploadingKey('repAadhaar');

      let uploadUri = asset.uri;
      let uploadType = asset.mimeType || 'application/octet-stream';
      let uploadName = asset.name || `aadhaar_${Date.now()}`;

      // Compress if it's an image
      if (asset.mimeType?.startsWith('image/')) {
        const compressed = await compressImage(asset.uri, { maxWidth: 1024, quality: 0.7 });
        uploadUri = compressed.uri;
        uploadType = 'image/jpeg';
        // Ensure name ends in .jpg
        if (!uploadName.toLowerCase().endsWith('.jpg') && !uploadName.toLowerCase().endsWith('.jpeg')) {
          uploadName = uploadName.split('.')[0] + '.jpg';
        }
      }

      const formData = createFormData(uploadUri, 'document', {
        fileName: uploadName,
        type: uploadType,
      });

      const response = await hospitalApi.uploadRepresentativeAadhaarDocument(formData);
      if (response.success) {
        Alert.alert('Success', 'Aadhaar document uploaded');
        await fetchEditProfile();
      } else {
        Alert.alert('Error', response.message || 'Failed to upload');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to upload document');
    } finally {
      setUploadingKey(null);
    }
  };

  // ============ Save Staffing Details ============
  const handleSaveStaffing = async () => {
    try {
      setSaving(true);
      const response = await hospitalApi.updateStaffingDetails({
        totalDoctors: parseInt(staffing.totalDoctors) || 0,
        totalNurses: parseInt(staffing.totalNurses) || 0,
        totalStaff: parseInt(staffing.totalStaff) || undefined,
      });

      if (response.success) {
        Alert.alert('Success', 'Staffing details updated successfully');
        await refresh();
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

  // ============ Save Infrastructure Details ============
  const handleSaveInfrastructure = async () => {
    try {
      setSaving(true);
      const response = await hospitalApi.updateInfrastructureDetails({
        totalBeds: parseInt(infrastructure.totalBeds) || 0,
        icuBeds: parseInt(infrastructure.icuBeds) || undefined,
        nicuPicuBeds: parseInt(infrastructure.nicuPicuBeds) || undefined,
        emergencyBeds: parseInt(infrastructure.emergencyBeds) || undefined,
        operationTheaters: parseInt(infrastructure.operationTheaters) || undefined,
        opFacility: facilities.opFacility,
        ipFacility: facilities.ipFacility,
        ipBeds: parseInt(facilities.ipBeds) || undefined,
        emergency24x7: facilities.emergency24x7,
        icuFacilities: facilities.icuFacilities,
        nicuPicuFacilities: facilities.nicuPicu,
        operationTheatre: facilities.operationTheatre,
        diagnosticLab: facilities.diagnosticLab,
        labFacilities: facilities.labFacilities,
        radiologyDepartment: facilities.radiologyDepartment,
        imagingFacilities: facilities.imagingFacilities,
        pharmacy: facilities.pharmacy,
        pharmacyAvailable24x7: facilities.pharmacyAvailable24x7,
        securityAvailable: facilities.securityAvailable,
      });

      if (response.success) {
        Alert.alert('Success', 'Infrastructure details updated successfully');
        await refresh();
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

  // ============ Upload Infrastructure Photo ============
  const handleUploadInfrastructurePhoto = async () => {
    try {
      const asset = await pickImage();
      if (!asset) return;

      setUploadingKey('infraPhoto');

      // Compress photo
      const compressed = await compressImage(asset.uri, { maxWidth: 1200, quality: 0.7 });

      const formData = createFormData(compressed.uri, 'photo', {
        fileName: asset.fileName || `facility_${Date.now()}.jpg`,
        type: 'image/jpeg',
      });

      const response = await hospitalApi.uploadInfrastructurePhoto(formData);
      if (response.success) {
        Alert.alert('Success', 'Photo uploaded');
        await refresh();
      } else {
        Alert.alert('Error', response.message || 'Failed to upload');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to upload photo');
    } finally {
      setUploadingKey(null);
    }
  };

  // ============ Save Credentials ============
  const handleSaveCredentials = async () => {
    // Validate that Establishment License is uploaded before saving
    if (!editProfile?.trustVerification?.establishmentLicense?.url) {
      Alert.alert(
        'Document Required',
        'Please upload the Establishment License document before saving credentials.'
      );
      return;
    }

    try {
      setSaving(true);
      const response = await hospitalApi.updateCredentials({
        registrationNumber: credentials.registrationNumber,
        accreditations: credentials.accreditations,
        chiefDoctorRegNumber: credentials.chiefDoctorRegNumber || undefined,
      });

      if (response.success) {
        Alert.alert('Success', 'Credentials updated successfully');
        await refresh();
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

  // ============ Upload Credential Document ============
  const handleUploadCredentialDocument = async (docType: 'establishmentLicense' | 'fireSafetyNOC') => {
    try {
      const asset = await pickDocument();
      if (!asset) return;

      setUploadingKey(docType);
      const formData = new FormData();
      formData.append('document', {
        uri: asset.uri,
        type: asset.mimeType || 'application/octet-stream',
        name: asset.name || `${docType}_document`,
      } as any);

      const response = await hospitalApi.uploadCredentialDocument(docType, formData);
      if (response.success) {
        Alert.alert('Success', 'Document uploaded');
        await fetchEditProfile();
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

  // Toggle accreditation
  const toggleAccreditation = (acc: string) => {
    setCredentials((prev) => ({
      ...prev,
      accreditations: prev.accreditations.includes(acc)
        ? prev.accreditations.filter((a) => a !== acc)
        : [...prev.accreditations, acc],
    }));
  };

  // Toggle lab facility
  const toggleLabFacility = (lab: string) => {
    setFacilities((prev) => ({
      ...prev,
      labFacilities: prev.labFacilities.includes(lab)
        ? prev.labFacilities.filter((l) => l !== lab)
        : [...prev.labFacilities, lab],
    }));
  };

  // Toggle imaging facility
  const toggleImagingFacility = (img: string) => {
    setFacilities((prev) => ({
      ...prev,
      imagingFacilities: prev.imagingFacilities.includes(img)
        ? prev.imagingFacilities.filter((i) => i !== img)
        : [...prev.imagingFacilities, img],
    }));
  };

  const displayName = profile?.name || 'Hospital';
  const { percentage } = getProfileCompletion(profile);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" className="text-brand-primary" />
        <Text className="mt-3 text-gray-500">Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.brand.secondary} />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <ImageBackground
          source={require('../assets/images/top-bg_.png')}
          resizeMode="cover"
          className="rounded-b-3xl overflow-hidden"
        >
          <View className="px-4 pt-4 pb-6">
            <View className="flex-row items-center justify-between">
              <Pressable
                className="h-11 w-11 rounded-xl bg-white/10 border border-white/20 items-center justify-center"
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </Pressable>
              <Text className="text-white font-semibold text-base">Edit Profile</Text>
              <View className="h-11 w-11" />
            </View>

            <View className="mt-4 items-center">
              {/* Logo */}
              <Pressable onPress={handleLogoUpload} disabled={uploadingLogo}>
                <View className="h-20 w-20 rounded-full border-2 border-white/50 items-center justify-center">
                  <View className="h-16 w-16 rounded-full overflow-hidden bg-white/10">
                    {uploadingLogo ? (
                      <View className="h-full w-full items-center justify-center">
                        <ActivityIndicator color="#fff" />
                      </View>
                    ) : (
                      <Image
                        source={
                          profile?.logo || profile?.avatar
                            ? { uri: profile?.logo || profile?.avatar }
                            : require('../assets/images/logo.png')
                        }
                        className="h-full w-full"
                        resizeMode="cover"
                      />
                    )}
                  </View>
                  <View className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-brand-tertiary border-2 border-white items-center justify-center">
                    <Ionicons name="camera" size={12} color="#fff" />
                  </View>
                </View>
              </Pressable>

              <Text className="mt-3 text-white text-lg font-bold">{displayName}</Text>

              {/* Profile Completion */}
              <View className="mt-3 w-full">
                <View className="flex-row items-center justify-between">
                  <Text className="text-white/90 text-xs font-semibold">Profile Completion</Text>
                  <Text className="text-white/90 text-xs font-semibold">{percentage}%</Text>
                </View>
                <View className="mt-2 h-2 w-full rounded-full bg-white/20 overflow-hidden">
                  <View
                    className="h-2 rounded-full bg-green-500"
                    style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
                  />
                </View>
              </View>
            </View>
          </View>
        </ImageBackground>

        <View className="px-4 py-5">
          {/* General Info Section */}
          <SectionCard
            icon="business"
            title="General Info"
            status={isSectionComplete(profile, 'generalInfo') ? 'completed' : 'warning'}
            expanded={expandedSection === 'general'}
            onToggle={() => toggleSection('general')}
          >
            <View className="pt-3">
              <FormField
                label="Institution Name"
                value={generalInfo.name}
                onChangeText={(text) => setGeneralInfo({ ...generalInfo, name: text })}
                placeholder="Hospital / Clinic name"
              />

              <View className="mt-4">
                <Text className="text-gray-700 text-xs font-medium mb-1">Hospital Type</Text>
                <Pressable
                  onPress={() => setShowHospitalTypeModal(true)}
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl flex-row justify-between items-center"
                >
                  <Text className={generalInfo.type ? 'text-gray-800' : 'text-gray-400'}>
                    {generalInfo.type
                      ? generalInfo.type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                      : 'Select Hospital Type'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#9ca3af" />
                </Pressable>
              </View>

              {/* Hospital Type Selection Modal */}
              <Modal
                visible={showHospitalTypeModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowHospitalTypeModal(false)}
              >
                <View className="flex-1 justify-center items-center bg-black/50 px-4">
                  <Pressable className="absolute inset-0" onPress={() => setShowHospitalTypeModal(false)} />
                  <View className="bg-white w-full max-h-[70%] rounded-2xl overflow-hidden">
                    <View className="p-4 border-b border-gray-100 flex-row justify-between items-center bg-gray-50">
                      <Text className="text-lg font-semibold text-gray-800">Select Hospital Type</Text>
                      <Pressable onPress={() => setShowHospitalTypeModal(false)} className="p-1">
                        <Ionicons name="close" size={24} color="#6b7280" />
                      </Pressable>
                    </View>

                    <FlatList
                      data={HOSPITAL_TYPES}
                      keyExtractor={(item) => item}
                      showsVerticalScrollIndicator={false}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          className={`p-4 border-b border-gray-50 ${generalInfo.type === item ? 'bg-blue-50' : ''}`}
                          onPress={() => {
                            setGeneralInfo({ ...generalInfo, type: item });
                            setShowHospitalTypeModal(false);
                          }}
                        >
                          <View className="flex-row justify-between items-center">
                            <Text className={`text-base ${generalInfo.type === item ? 'text-brand-tertiary font-medium' : 'text-gray-700'}`}>
                              {item.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                            </Text>
                            {generalInfo.type === item && (
                              <Ionicons name="checkmark" size={20} className="text-brand-tertiary" />
                            )}
                          </View>
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                </View>
              </Modal>

              <FormField
                label="Email"
                value={generalInfo.email}
                onChangeText={(text) => setGeneralInfo({ ...generalInfo, email: text })}
                placeholder="contact@hospital.com"
                keyboardType="email-address"
                editable={false}
              />

              {/* Phone Number with OTP Verification */}
              <View className="mt-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-gray-700 text-xs font-medium">Phone Number</Text>
                  {isPhoneVerified && (
                    <View className="flex-row items-center bg-green-100 px-2 py-1 rounded-full">
                      <Ionicons name="checkmark-circle" size={12} color="#16a34a" />
                      <Text className="ml-1 text-green-700 text-xs font-medium">Verified</Text>
                    </View>
                  )}
                </View>

                <View className="flex-row gap-2 mt-2">
                  <View className="flex-1">
                    <TextInput
                      className="rounded-xl border border-gray-200 px-4 py-3 text-gray-900"
                      value={generalInfo.phone}
                      onChangeText={(text) => {
                        setGeneralInfo({ ...generalInfo, phone: text });
                        // Reset verification status when phone changes
                        if (isPhoneVerified && text !== profile?.phone?.number) {
                          setIsPhoneVerified(false);
                          setShowPhoneOtpInput(false);
                        }
                      }}
                      placeholder="9876543210"
                      keyboardType="phone-pad"
                      editable={!isPhoneVerified}
                    />
                  </View>
                  {!isPhoneVerified && !showPhoneOtpInput && (
                    <Pressable
                      className="rounded-xl bg-brand-primary px-4 py-3 justify-center"
                      onPress={handleSendPhoneOtp}
                      disabled={sendingPhoneOtp}
                    >
                      {sendingPhoneOtp ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text className="text-white font-semibold text-xs">Send OTP</Text>
                      )}
                    </Pressable>
                  )}
                </View>

                {/* OTP Input */}
                {showPhoneOtpInput && !isPhoneVerified && (
                  <View className="mt-3">
                    <Text className="text-gray-700 text-xs font-medium mb-2">Enter OTP</Text>
                    <View className="flex-row gap-2">
                      <TextInput
                        className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-gray-900"
                        value={phoneOtp}
                        onChangeText={setPhoneOtp}
                        placeholder="Enter 6-digit OTP"
                        keyboardType="numeric"
                        maxLength={6}
                      />
                      <Pressable
                        className="rounded-xl bg-green-600 px-4 py-3 justify-center"
                        onPress={handleVerifyPhoneOtp}
                        disabled={verifyingPhoneOtp}
                      >
                        {verifyingPhoneOtp ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text className="text-white font-semibold text-xs">Verify</Text>
                        )}
                      </Pressable>
                    </View>
                    <Pressable
                      className="mt-2"
                      onPress={handleSendPhoneOtp}
                      disabled={sendingPhoneOtp}
                    >
                      <Text className="text-brand-tertiary text-xs">Resend OTP</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              <FormField
                label="Website"
                value={generalInfo.website}
                onChangeText={(text) => setGeneralInfo({ ...generalInfo, website: text })}
                placeholder="https://www.hospital.com"
              />

              <FormField
                label="Description"
                value={generalInfo.description}
                onChangeText={(text) => setGeneralInfo({ ...generalInfo, description: text })}
                placeholder="Brief description of your hospital"
                multiline
                numberOfLines={3}
              />

              <Text className="mt-4 text-gray-700 text-xs font-medium">Address</Text>

              <FormField
                label="Street"
                value={generalInfo.address.street}
                onChangeText={(text) =>
                  setGeneralInfo({ ...generalInfo, address: { ...generalInfo.address, street: text } })
                }
                placeholder="Street address"
              />

              <StateCitySelector
                state={generalInfo.address.state}
                city={generalInfo.address.city}
                onStateChange={(state) => {
                  setGeneralInfo({
                    ...generalInfo,
                    address: { ...generalInfo.address, state, city: '' }
                  });
                }}
                onCityChange={(city) => {
                  setGeneralInfo({
                    ...generalInfo,
                    address: { ...generalInfo.address, city }
                  });
                }}
              />

              <FormField
                label="Pincode"
                value={generalInfo.address.pincode}
                onChangeText={(text) =>
                  setGeneralInfo({ ...generalInfo, address: { ...generalInfo.address, pincode: text } })
                }
                placeholder="600001"
                keyboardType="numeric"
              />

              <View className="flex-row gap-3 mt-4">
                <Pressable
                  className="flex-1 rounded-xl border border-gray-200 py-3 items-center"
                  onPress={() => setExpandedSection(null)}
                >
                  <Text className="text-gray-900 font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  className="flex-1 rounded-xl bg-brand-primary py-3 items-center"
                  onPress={handleSaveGeneralInfo}
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

          {/* Representative Details Section */}
          <SectionCard
            icon="person"
            title="Representative Details"
            status={isSectionComplete(profile, 'representativeDetails') ? 'completed' : 'warning'}
            expanded={expandedSection === 'representative'}
            onToggle={() => toggleSection('representative')}
          >
            <View className="pt-3">
              <FormField
                label="Full Name"
                value={representative.fullName}
                onChangeText={(text) => setRepresentative({ ...representative, fullName: text })}
                placeholder="Representative's full name"
              />

              {/* Email with OTP Verification */}
              <View className="mb-4">
                <FormField
                  label="Email"
                  value={representative.email}
                  onChangeText={(text) => {
                    setRepresentative({ ...representative, email: text });
                    setIsRepEmailVerified(false);
                    setShowRepEmailOtpInput(false);
                    setRepEmailOtp('');
                  }}
                  placeholder="representative@hospital.com"
                  keyboardType="email-address"
                />

                {!isRepEmailVerified ? (
                  <View className="mt-2">
                    {!showRepEmailOtpInput ? (
                      <Pressable
                        onPress={handleSendRepEmailOtp}
                        disabled={sendingRepEmailOtp || !representative.email}
                        className={`flex-row items-center justify-center p-3 rounded-xl border ${!representative.email ? 'border-gray-200 bg-gray-100' : 'border-blue-200 bg-blue-50'
                          }`}
                      >
                        {sendingRepEmailOtp ? (
                          <ActivityIndicator size="small" color="#3b82f6" />
                        ) : (
                          <Text className={!representative.email ? 'text-gray-400' : 'text-brand-tertiary font-medium'}>
                            Send Verification Code
                          </Text>
                        )}
                      </Pressable>
                    ) : (
                      <View className="gap-3">
                        <FormField
                          label="Verification Code"
                          value={repEmailOtp}
                          onChangeText={setRepEmailOtp}
                          placeholder="Enter 6-digit code"
                          keyboardType="numeric"
                        />
                        <View className="flex-row gap-3">
                          <Pressable
                            onPress={() => setShowRepEmailOtpInput(false)}
                            className="flex-1 p-3 rounded-xl bg-gray-100 items-center justify-center"
                          >
                            <Text className="text-gray-600 font-medium">Cancel</Text>
                          </Pressable>
                          <Pressable
                            onPress={handleVerifyRepEmailOtp}
                            disabled={verifyingRepEmailOtp || repEmailOtp.length !== 6}
                            className={`flex-1 p-3 rounded-xl items-center justify-center ${repEmailOtp.length !== 6 ? 'bg-gray-200' : 'bg-brand-primary'
                              }`}
                          >
                            {verifyingRepEmailOtp ? (
                              <ActivityIndicator size="small" color="#white" />
                            ) : (
                              <Text className={repEmailOtp.length !== 6 ? 'text-gray-400' : 'text-white font-semibold'}>
                                Verify Email
                              </Text>
                            )}
                          </Pressable>
                        </View>
                        <Pressable
                          onPress={handleSendRepEmailOtp}
                          disabled={sendingRepEmailOtp}
                        >
                          <Text className="text-center text-brand-tertiary text-xs font-medium">Resend Code</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                ) : (
                  <View className="flex-row items-center gap-2 mt-1">
                    <View className="bg-green-100 rounded-full p-1">
                      <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                    </View>
                    <Text className="text-green-700 text-xs font-medium">Email Verified</Text>
                  </View>
                )}
              </View>

              <FormField
                label="Phone"
                value={representative.phone}
                onChangeText={(text) => setRepresentative({ ...representative, phone: text })}
                placeholder="9876543210"
                keyboardType="phone-pad"
              />

              <Pressable
                className="mt-4 rounded-xl bg-brand-primary py-3 items-center"
                onPress={handleSaveRepresentative}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-white font-semibold">Save Representative Details</Text>
                )}
              </Pressable>

              {/* Aadhaar Section */}
              <View className="mt-5 rounded-xl bg-gray-50 border border-gray-100 px-4 py-4">
                <Text className="text-gray-900 font-semibold">Identity Verification (Aadhaar)</Text>
                <Text className="mt-1 text-gray-500 text-xs">
                  {editProfile?.representativeDetails?.aadhaar?.maskedNumber
                    ? `Saved: ${editProfile.representativeDetails.aadhaar.maskedNumber}`
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
                    className="flex-1 rounded-xl bg-brand-primary py-3 items-center"
                    onPress={handleSaveRepresentativeAadhaar}
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
                    onPress={handleUploadRepresentativeAadhaarDocument}
                    disabled={uploadingKey === 'repAadhaar'}
                  >
                    {uploadingKey === 'repAadhaar' ? (
                      <ActivityIndicator color="#111827" size="small" />
                    ) : (
                      <Text className="text-gray-900 font-semibold">
                        {editProfile?.representativeDetails?.aadhaar?.document?.url ? 'Edit Doc' : 'Upload Doc'}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </SectionCard>

          {/* Staffing Details Section */}
          <SectionCard
            icon="people"
            title="Staffing Details"
            status={isSectionComplete(profile, 'staffingDetails') ? 'completed' : 'warning'}
            expanded={expandedSection === 'staffing'}
            onToggle={() => toggleSection('staffing')}
          >
            <View className="pt-3">
              <View className="flex-row gap-3">
                <FormField
                  label="Total Doctors"
                  value={staffing.totalDoctors}
                  onChangeText={(text) => setStaffing({ ...staffing, totalDoctors: text })}
                  placeholder="0"
                  keyboardType="numeric"
                  flex
                />
                <FormField
                  label="Total Nurses"
                  value={staffing.totalNurses}
                  onChangeText={(text) => setStaffing({ ...staffing, totalNurses: text })}
                  placeholder="0"
                  keyboardType="numeric"
                  flex
                />
              </View>

              <FormField
                label="Total Staff (optional)"
                value={staffing.totalStaff}
                onChangeText={(text) => setStaffing({ ...staffing, totalStaff: text })}
                placeholder="Including admin, support staff, etc."
                keyboardType="numeric"
              />

              <View className="flex-row gap-3 mt-4">
                <Pressable
                  className="flex-1 rounded-xl border border-gray-200 py-3 items-center"
                  onPress={() => setExpandedSection(null)}
                >
                  <Text className="text-gray-900 font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  className="flex-1 rounded-xl bg-brand-primary py-3 items-center"
                  onPress={handleSaveStaffing}
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

          {/* Infrastructure Details Section */}
          <SectionCard
            icon="bed"
            title="Infrastructure Details"
            status={isSectionComplete(profile, 'infrastructureDetails') ? 'completed' : 'warning'}
            expanded={expandedSection === 'infrastructure'}
            onToggle={() => toggleSection('infrastructure')}
          >
            <View className="pt-3">
              <Text className="text-gray-700 text-xs font-medium mb-2">Bed Capacity</Text>

              <View className="flex-row gap-3">
                <FormField
                  label="Total Beds"
                  value={infrastructure.totalBeds}
                  onChangeText={(text) => setInfrastructure({ ...infrastructure, totalBeds: text })}
                  placeholder="0"
                  keyboardType="numeric"
                  flex
                />
                <FormField
                  label="ICU Beds"
                  value={infrastructure.icuBeds}
                  onChangeText={(text) => setInfrastructure({ ...infrastructure, icuBeds: text })}
                  placeholder="0"
                  keyboardType="numeric"
                  flex
                />
              </View>

              <View className="flex-row gap-3">
                <FormField
                  label="NICU/PICU Beds"
                  value={infrastructure.nicuPicuBeds}
                  onChangeText={(text) => setInfrastructure({ ...infrastructure, nicuPicuBeds: text })}
                  placeholder="0"
                  keyboardType="numeric"
                  flex
                />
                <FormField
                  label="Emergency Beds"
                  value={infrastructure.emergencyBeds}
                  onChangeText={(text) => setInfrastructure({ ...infrastructure, emergencyBeds: text })}
                  placeholder="0"
                  keyboardType="numeric"
                  flex
                />
              </View>

              <FormField
                label="Operation Theaters"
                value={infrastructure.operationTheaters}
                onChangeText={(text) => setInfrastructure({ ...infrastructure, operationTheaters: text })}
                placeholder="0"
                keyboardType="numeric"
              />

              {/* Facilities Toggles */}
              <Text className="mt-4 text-gray-700 text-xs font-medium mb-2">Facilities</Text>

              <FacilityToggle
                label="OP Facility"
                value={facilities.opFacility}
                onToggle={(val) => setFacilities({ ...facilities, opFacility: val })}
              />
              <FacilityToggle
                label="IP Facility"
                value={facilities.ipFacility}
                onToggle={(val) => setFacilities({ ...facilities, ipFacility: val })}
              />
              {facilities.ipFacility && (
                <FormField
                  label="IP Beds"
                  value={facilities.ipBeds}
                  onChangeText={(text) => setFacilities({ ...facilities, ipBeds: text })}
                  placeholder="0"
                  keyboardType="numeric"
                />
              )}
              <FacilityToggle
                label="24x7 Emergency"
                value={facilities.emergency24x7}
                onToggle={(val) => setFacilities({ ...facilities, emergency24x7: val })}
              />
              <FacilityToggle
                label="ICU Facilities"
                value={facilities.icuFacilities}
                onToggle={(val) => setFacilities({ ...facilities, icuFacilities: val })}
              />
              <FacilityToggle
                label="NICU/PICU"
                value={facilities.nicuPicu}
                onToggle={(val) => setFacilities({ ...facilities, nicuPicu: val })}
              />
              <FacilityToggle
                label="Operation Theatre"
                value={facilities.operationTheatre}
                onToggle={(val) => setFacilities({ ...facilities, operationTheatre: val })}
              />
              <FacilityToggle
                label="Diagnostic Lab"
                value={facilities.diagnosticLab}
                onToggle={(val) => setFacilities({ ...facilities, diagnosticLab: val })}
              />

              {/* Lab Facilities Multi-select */}
              {facilities.diagnosticLab && (
                <View className="mt-2 mb-3">
                  <Text className="text-gray-500 text-xs mb-2">Lab Specialties</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {LAB_FACILITIES_OPTIONS.map((lab) => (
                      <Pressable
                        key={lab}
                        className={`px-3 py-2 rounded-xl border ${facilities.labFacilities.includes(lab)
                          ? 'bg-brand-primary border-brand-primary'
                          : 'bg-white border-gray-200'
                          }`}
                        onPress={() => toggleLabFacility(lab)}
                      >
                        <Text
                          className={`text-xs ${facilities.labFacilities.includes(lab) ? 'text-white' : 'text-gray-700'
                            }`}
                        >
                          {lab}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              <FacilityToggle
                label="Radiology Department"
                value={facilities.radiologyDepartment}
                onToggle={(val) => setFacilities({ ...facilities, radiologyDepartment: val })}
              />

              {/* Imaging Facilities Multi-select */}
              {facilities.radiologyDepartment && (
                <View className="mt-2 mb-3">
                  <Text className="text-gray-500 text-xs mb-2">Imaging Equipment</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {IMAGING_OPTIONS.map((img) => (
                      <Pressable
                        key={img}
                        className={`px-3 py-2 rounded-xl border ${facilities.imagingFacilities.includes(img)
                          ? 'bg-brand-primary border-brand-primary'
                          : 'bg-white border-gray-200'
                          }`}
                        onPress={() => toggleImagingFacility(img)}
                      >
                        <Text
                          className={`text-xs ${facilities.imagingFacilities.includes(img) ? 'text-white' : 'text-gray-700'
                            }`}
                        >
                          {img}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              <FacilityToggle
                label="Pharmacy"
                value={facilities.pharmacy}
                onToggle={(val) => setFacilities({ ...facilities, pharmacy: val })}
              />
              {facilities.pharmacy && (
                <FacilityToggle
                  label="Pharmacy 24x7"
                  value={facilities.pharmacyAvailable24x7}
                  onToggle={(val) => setFacilities({ ...facilities, pharmacyAvailable24x7: val })}
                />
              )}
              <FacilityToggle
                label="Blood Bank"
                value={facilities.bloodBank}
                onToggle={(val) => setFacilities({ ...facilities, bloodBank: val })}
              />
              <FacilityToggle
                label="Ambulance Service"
                value={facilities.ambulanceService}
                onToggle={(val) => setFacilities({ ...facilities, ambulanceService: val })}
              />
              <FacilityToggle
                label="Security Available"
                value={facilities.securityAvailable}
                onToggle={(val) => setFacilities({ ...facilities, securityAvailable: val })}
              />

              {/* Facility Photos */}
              <Text className="mt-4 text-gray-700 text-xs font-medium mb-2">Facility Photos</Text>

              {profile?.facilityGallery && profile.facilityGallery.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
                  {profile.facilityGallery.map((img, idx) => (
                    <View key={idx} className="mr-2 rounded-xl overflow-hidden">
                      <Image source={{ uri: img.url }} className="w-16 h-16" resizeMode="cover" />
                    </View>
                  ))}
                </ScrollView>
              )}

              <Pressable
                className="rounded-xl border border-dashed border-gray-300 py-4 items-center"
                onPress={handleUploadInfrastructurePhoto}
                disabled={uploadingKey === 'infraPhoto'}
              >
                {uploadingKey === 'infraPhoto' ? (
                  <ActivityIndicator color="#6b7280" />
                ) : (
                  <View className="items-center">
                    <Ionicons name="camera-outline" size={24} color="#6b7280" />
                    <Text className="text-gray-500 text-xs mt-1">Add Facility Photo</Text>
                  </View>
                )}
              </Pressable>

              <View className="flex-row gap-3 mt-4">
                <Pressable
                  className="flex-1 rounded-xl border border-gray-200 py-3 items-center"
                  onPress={() => setExpandedSection(null)}
                >
                  <Text className="text-gray-900 font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  className="flex-1 rounded-xl bg-brand-primary py-3 items-center"
                  onPress={handleSaveInfrastructure}
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

          {/* Credentials & Verification Section */}
          <SectionCard
            icon="shield-checkmark"
            title="Credentials & Verification"
            status={isSectionComplete(profile, 'trustVerification') ? 'completed' : 'warning'}
            expanded={expandedSection === 'credentials'}
            onToggle={() => toggleSection('credentials')}
          >
            <View className="pt-3">
              <FormField
                label="Registration Number"
                value={credentials.registrationNumber}
                onChangeText={(text) => setCredentials({ ...credentials, registrationNumber: text })}
                placeholder="Hospital registration number"
              />

              <FormField
                label="Chief Doctor Registration"
                value={credentials.chiefDoctorRegNumber}
                onChangeText={(text) => setCredentials({ ...credentials, chiefDoctorRegNumber: text })}
                placeholder="Medical council registration"
              />

              {/* Accreditations */}
              <Text className="mt-4 text-gray-700 text-xs font-medium mb-2">Accreditations</Text>
              <View className="flex-row flex-wrap gap-2">
                {ACCREDITATION_OPTIONS.map((acc) => (
                  <Pressable
                    key={acc}
                    className={`px-3 py-2 rounded-xl border ${credentials.accreditations.includes(acc)
                      ? 'bg-brand-primary border-brand-primary'
                      : 'bg-white border-gray-100'
                      }`}
                    onPress={() => toggleAccreditation(acc)}
                  >
                    <Text
                      className={`text-xs font-medium ${credentials.accreditations.includes(acc) ? 'text-white' : 'text-gray-700'
                        }`}
                    >
                      {acc}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                className="mt-4 rounded-xl bg-brand-primary py-3 items-center"
                onPress={handleSaveCredentials}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-white font-semibold">Save Credentials</Text>
                )}
              </Pressable>

              {/* Document Uploads */}
              <Text className="mt-5 text-gray-700 text-xs font-medium mb-2">Verification Documents</Text>

              <DocumentUploadRow
                label="Establishment License"
                hasDocument={!!editProfile?.trustVerification?.establishmentLicense?.url}
                isVerified={editProfile?.trustVerification?.establishmentLicense?.isVerified}
                uploading={uploadingKey === 'establishmentLicense'}
                onUpload={() => handleUploadCredentialDocument('establishmentLicense')}
              />

              <DocumentUploadRow
                label="Fire Safety NOC"
                hasDocument={!!editProfile?.trustVerification?.fireSafetyNOC?.url}
                isVerified={editProfile?.trustVerification?.fireSafetyNOC?.isVerified}
                uploading={uploadingKey === 'fireSafetyNOC'}
                onUpload={() => handleUploadCredentialDocument('fireSafetyNOC')}
              />
            </View>
          </SectionCard>

          <View className="h-20" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ================== REUSABLE COMPONENTS ==================

// Section Card
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
    <View className="mt-4 rounded-2xl bg-white border border-gray-100 overflow-hidden">
      <Pressable className="px-4 py-4 flex-row items-center justify-between" onPress={onToggle}>
        <View className="flex-row items-center flex-1">
          <View className="h-10 w-10 rounded-xl bg-blue-50 items-center justify-center">
            <Ionicons name={icon} size={20} className="text-brand-tertiary" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-gray-900 font-semibold">{title}</Text>
            <View className="flex-row items-center mt-0.5">
              <Ionicons
                name={status === 'completed' ? 'checkmark-circle' : 'warning'}
                size={12}
                color={status === 'completed' ? '#16a34a' : '#f97316'}
              />
              <Text className={`ml-1 text-xs ${status === 'completed' ? 'text-green-600' : 'text-orange-500'}`}>
                {status === 'completed' ? 'Completed' : 'Needs Attention'}
              </Text>
            </View>
          </View>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} className="text-brand-tertiary" />
      </Pressable>

      {expanded && <View className="px-4 pb-4 border-t border-gray-100">{children}</View>}
    </View>
  );
}

// Form Field
function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  flex,
  editable = true,
  verified,
  multiline,
  numberOfLines,
}: {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  flex?: boolean;
  editable?: boolean;
  verified?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
}) {
  return (
    <View className={`mt-3 ${flex ? 'flex-1' : ''}`}>
      <View className="flex-row items-center justify-between">
        <Text className="text-gray-700 text-xs font-medium">{label}</Text>
        {verified && (
          <View className="flex-row items-center">
            <Ionicons name="checkmark-circle" size={12} color="#16a34a" />
            <Text className="text-green-600 text-[10px] ml-1">Verified</Text>
          </View>
        )}
      </View>
      <TextInput
        className={`mt-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 ${!editable ? 'opacity-60' : ''
          }`}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        keyboardType={keyboardType}
        editable={editable}
        multiline={multiline}
        numberOfLines={numberOfLines}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

// Facility Toggle
function FacilityToggle({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: (val: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
      <Text className="text-gray-700 text-sm">{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#e5e7eb', true: Colors.brand.tertiary }}
        thumbColor="#fff"
      />
    </View>
  );
}

// Document Upload Row
function DocumentUploadRow({
  label,
  hasDocument,
  isVerified,
  uploading,
  onUpload,
}: {
  label: string;
  hasDocument?: boolean;
  isVerified?: boolean;
  uploading?: boolean;
  onUpload: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
      <View className="flex-row items-center flex-1">
        <View className="h-8 w-8 rounded-lg bg-red-50 items-center justify-center">
          <Ionicons name="document-text" size={16} color="#dc2626" />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-gray-900 font-medium text-sm">{label}</Text>
          {hasDocument && (
            <View className="flex-row items-center mt-0.5">
              <Ionicons
                name={isVerified ? 'checkmark-circle' : 'time-outline'}
                size={10}
                color={isVerified ? '#16a34a' : '#f59e0b'}
              />
              <Text className={`ml-1 text-[10px] ${isVerified ? 'text-green-600' : 'text-amber-600'}`}>
                {isVerified ? 'Verified' : 'Pending Review'}
              </Text>
            </View>
          )}
        </View>
      </View>
      <Pressable
        className="px-3 py-2 rounded-xl border border-gray-200"
        onPress={onUpload}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator size="small" color="#111827" />
        ) : (
          <Text className="text-gray-900 text-xs font-semibold">{hasDocument ? 'Edit' : 'Upload'}</Text>
        )}
      </Pressable>
    </View>
  );
}
