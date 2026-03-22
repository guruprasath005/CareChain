// hooks/useUpload.ts
// Custom hook for handling file uploads with loading states and error handling

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { doctorApi, hospitalApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  pickImage,
  pickDocument,
  createAvatarFormData,
  createDocumentFormData,
  createLogoFormData,
  createBannerFormData,
  createPhotoFormData,
  validateImage,
  validateDocument,
  ImagePickerResult,
  DocumentPickerResult,
} from '../utils/upload';

export interface UploadState {
  uploading: boolean;
  progress: number;
  error: string | null;
  url: string | null;
  publicId: string | null;
}

export interface UseUploadReturn {
  state: UploadState;
  pickAndUploadAvatar: () => Promise<{ success: boolean; url?: string }>;
  pickAndUploadDocument: (options?: PickDocumentOptions) => Promise<{ success: boolean; url?: string }>;
  uploadAvatar: (uri: string, type?: string) => Promise<{ success: boolean; url?: string }>;
  uploadDocument: (uri: string, options?: UploadDocumentOptions) => Promise<{ success: boolean; url?: string }>;
  reset: () => void;
}

interface PickDocumentOptions {
  documentType?: 'education' | 'license' | 'certificate' | 'aadhaar' | 'experience' | 'credential';
  itemId?: string;
}

interface UploadDocumentOptions extends PickDocumentOptions {
  fileName?: string;
  type?: string;
}

const initialState: UploadState = {
  uploading: false,
  progress: 0,
  error: null,
  url: null,
  publicId: null,
};

/**
 * Hook for Doctor profile uploads
 */
export const useDoctorUpload = (): UseUploadReturn => {
  const [state, setState] = useState<UploadState>(initialState);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const uploadAvatar = useCallback(async (uri: string, type: string = 'image/jpeg'): Promise<{ success: boolean; url?: string }> => {
    setState(prev => ({ ...prev, uploading: true, error: null }));

    try {
      const formData = createAvatarFormData(uri, type);
      const response = await doctorApi.uploadAvatar(formData);

      if (response.success && response.data?.avatarUrl) {
        setState(prev => ({
          ...prev,
          uploading: false,
          url: response.data.avatarUrl,
          publicId: response.data.publicId || null,
        }));
        return { success: true, url: response.data.avatarUrl };
      } else {
        const error = response.error || response.message || 'Upload failed';
        setState(prev => ({ ...prev, uploading: false, error }));
        return { success: false };
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Upload failed';
      setState(prev => ({ ...prev, uploading: false, error: errorMessage }));
      return { success: false };
    }
  }, []);

  const pickAndUploadAvatar = useCallback(async (): Promise<{ success: boolean; url?: string }> => {
    const result = await pickImage({
      source: 'both',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.cancelled || !result.uri) {
      return { success: false };
    }

    const validation = validateImage(result, { maxSizeMB: 5 });
    if (!validation.valid) {
      Alert.alert('Invalid Image', validation.error);
      return { success: false };
    }

    return uploadAvatar(result.uri, result.type);
  }, [uploadAvatar]);

  const uploadDocument = useCallback(async (
    uri: string,
    options: UploadDocumentOptions = {}
  ): Promise<{ success: boolean; url?: string }> => {
    const { documentType = 'document', itemId, fileName, type } = options;

    setState(prev => ({ ...prev, uploading: true, error: null }));

    try {
      const formData = createDocumentFormData(uri, fileName, type);

      let response;
      switch (documentType) {
        case 'education':
          if (!itemId) throw new Error('Education ID is required');
          response = await doctorApi.uploadEducationDocument(itemId, formData);
          break;
        case 'license':
          if (!itemId) throw new Error('License ID is required');
          response = await doctorApi.uploadLicenseDocument(itemId, formData);
          break;
        case 'certificate':
          if (!itemId) throw new Error('Skill ID is required');
          response = await doctorApi.uploadSkillCertificate(itemId, formData);
          break;
        case 'aadhaar':
          response = await doctorApi.uploadAadhaarDocument(formData);
          break;
        case 'experience':
          if (!itemId) throw new Error('Experience ID is required');
          response = await doctorApi.uploadExperienceDocument(itemId, formData);
          break;
        default:
          throw new Error('Unknown document type');
      }

      if (response.success && response.data?.documentUrl) {
        setState(prev => ({
          ...prev,
          uploading: false,
          url: response.data.documentUrl,
          publicId: response.data.publicId || null,
        }));
        return { success: true, url: response.data.documentUrl };
      } else {
        const error = response.error || response.message || 'Upload failed';
        setState(prev => ({ ...prev, uploading: false, error }));
        return { success: false };
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Upload failed';
      setState(prev => ({ ...prev, uploading: false, error: errorMessage }));
      return { success: false };
    }
  }, []);

  const pickAndUploadDocument = useCallback(async (
    options: PickDocumentOptions = {}
  ): Promise<{ success: boolean; url?: string }> => {
    const result = await pickDocument({
      type: ['image/*', 'application/pdf'],
    });

    if (result.cancelled || !result.uri) {
      return { success: false };
    }

    const validation = validateDocument(result, { maxSizeMB: 10 });
    if (!validation.valid) {
      Alert.alert('Invalid Document', validation.error);
      return { success: false };
    }

    return uploadDocument(result.uri, {
      ...options,
      fileName: result.name,
      type: result.type,
    });
  }, [uploadDocument]);

  return {
    state,
    pickAndUploadAvatar,
    pickAndUploadDocument,
    uploadAvatar,
    uploadDocument,
    reset,
  };
};

/**
 * Hook for Hospital profile uploads
 */
export const useHospitalUpload = () => {
  const [state, setState] = useState<UploadState>(initialState);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const uploadLogo = useCallback(async (uri: string): Promise<{ success: boolean; url?: string }> => {
    setState(prev => ({ ...prev, uploading: true, error: null }));

    try {
      const formData = createLogoFormData(uri);
      const response = await hospitalApi.uploadLogo(formData);

      if (response.success && response.data?.logoUrl) {
        setState(prev => ({
          ...prev,
          uploading: false,
          url: response.data.logoUrl,
          publicId: response.data.publicId || null,
        }));
        return { success: true, url: response.data.logoUrl };
      } else {
        const error = response.error || response.message || 'Upload failed';
        setState(prev => ({ ...prev, uploading: false, error }));
        return { success: false };
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Upload failed';
      setState(prev => ({ ...prev, uploading: false, error: errorMessage }));
      return { success: false };
    }
  }, []);

  const pickAndUploadLogo = useCallback(async (): Promise<{ success: boolean; url?: string }> => {
    const result = await pickImage({
      source: 'both',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (result.cancelled || !result.uri) {
      return { success: false };
    }

    const validation = validateImage(result, { maxSizeMB: 5 });
    if (!validation.valid) {
      Alert.alert('Invalid Image', validation.error);
      return { success: false };
    }

    return uploadLogo(result.uri);
  }, [uploadLogo]);

  const uploadBanner = useCallback(async (uri: string): Promise<{ success: boolean; url?: string }> => {
    setState(prev => ({ ...prev, uploading: true, error: null }));

    try {
      const formData = createBannerFormData(uri);
      const response = await hospitalApi.uploadBanner(formData);

      if (response.success && response.data?.bannerUrl) {
        setState(prev => ({
          ...prev,
          uploading: false,
          url: response.data.bannerUrl,
          publicId: response.data.publicId || null,
        }));
        return { success: true, url: response.data.bannerUrl };
      } else {
        const error = response.error || response.message || 'Upload failed';
        setState(prev => ({ ...prev, uploading: false, error }));
        return { success: false };
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Upload failed';
      setState(prev => ({ ...prev, uploading: false, error: errorMessage }));
      return { success: false };
    }
  }, []);

  const pickAndUploadBanner = useCallback(async (): Promise<{ success: boolean; url?: string }> => {
    const result = await pickImage({
      source: 'gallery',
      allowsEditing: true,
      aspect: [3, 1],
      quality: 0.9,
    });

    if (result.cancelled || !result.uri) {
      return { success: false };
    }

    const validation = validateImage(result, { maxSizeMB: 10 });
    if (!validation.valid) {
      Alert.alert('Invalid Image', validation.error);
      return { success: false };
    }

    return uploadBanner(result.uri);
  }, [uploadBanner]);

  const uploadPhoto = useCallback(async (uri: string): Promise<{ success: boolean; url?: string }> => {
    setState(prev => ({ ...prev, uploading: true, error: null }));

    try {
      const formData = createPhotoFormData(uri);
      const response = await hospitalApi.uploadInfrastructurePhoto(formData);

      if (response.success && response.data?.photoUrl) {
        setState(prev => ({
          ...prev,
          uploading: false,
          url: response.data.photoUrl,
          publicId: response.data.publicId || null,
        }));
        return { success: true, url: response.data.photoUrl };
      } else {
        const error = response.error || response.message || 'Upload failed';
        setState(prev => ({ ...prev, uploading: false, error }));
        return { success: false };
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Upload failed';
      setState(prev => ({ ...prev, uploading: false, error: errorMessage }));
      return { success: false };
    }
  }, []);

  const pickAndUploadPhoto = useCallback(async (): Promise<{ success: boolean; url?: string }> => {
    const result = await pickImage({
      source: 'both',
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (result.cancelled || !result.uri) {
      return { success: false };
    }

    const validation = validateImage(result, { maxSizeMB: 10 });
    if (!validation.valid) {
      Alert.alert('Invalid Image', validation.error);
      return { success: false };
    }

    return uploadPhoto(result.uri);
  }, [uploadPhoto]);

  const uploadAadhaarDocument = useCallback(async (uri: string): Promise<{ success: boolean; url?: string }> => {
    setState(prev => ({ ...prev, uploading: true, error: null }));

    try {
      const formData = createDocumentFormData(uri);
      const response = await hospitalApi.uploadRepresentativeAadhaarDocument(formData);

      if (response.success && response.data?.documentUrl) {
        setState(prev => ({
          ...prev,
          uploading: false,
          url: response.data.documentUrl,
          publicId: response.data.publicId || null,
        }));
        return { success: true, url: response.data.documentUrl };
      } else {
        const error = response.error || response.message || 'Upload failed';
        setState(prev => ({ ...prev, uploading: false, error }));
        return { success: false };
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Upload failed';
      setState(prev => ({ ...prev, uploading: false, error: errorMessage }));
      return { success: false };
    }
  }, []);

  const pickAndUploadAadhaarDocument = useCallback(async (): Promise<{ success: boolean; url?: string }> => {
    const result = await pickDocument({
      type: ['image/*', 'application/pdf'],
    });

    if (result.cancelled || !result.uri) {
      return { success: false };
    }

    const validation = validateDocument(result, { maxSizeMB: 5 });
    if (!validation.valid) {
      Alert.alert('Invalid Document', validation.error);
      return { success: false };
    }

    return uploadAadhaarDocument(result.uri);
  }, [uploadAadhaarDocument]);

  const uploadCredentialDocument = useCallback(async (
    uri: string,
    credentialType: string
  ): Promise<{ success: boolean; url?: string }> => {
    setState(prev => ({ ...prev, uploading: true, error: null }));

    try {
      const formData = createDocumentFormData(uri);
      const response = await hospitalApi.uploadCredentialDocument(credentialType, formData);

      if (response.success && response.data?.documentUrl) {
        setState(prev => ({
          ...prev,
          uploading: false,
          url: response.data.documentUrl,
          publicId: response.data.publicId || null,
        }));
        return { success: true, url: response.data.documentUrl };
      } else {
        const error = response.error || response.message || 'Upload failed';
        setState(prev => ({ ...prev, uploading: false, error }));
        return { success: false };
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Upload failed';
      setState(prev => ({ ...prev, uploading: false, error: errorMessage }));
      return { success: false };
    }
  }, []);

  const pickAndUploadCredentialDocument = useCallback(async (
    credentialType: string
  ): Promise<{ success: boolean; url?: string }> => {
    const result = await pickDocument({
      type: ['image/*', 'application/pdf'],
    });

    if (result.cancelled || !result.uri) {
      return { success: false };
    }

    const validation = validateDocument(result, { maxSizeMB: 10 });
    if (!validation.valid) {
      Alert.alert('Invalid Document', validation.error);
      return { success: false };
    }

    return uploadCredentialDocument(result.uri, credentialType);
  }, [uploadCredentialDocument]);

  return {
    state,
    uploadLogo,
    pickAndUploadLogo,
    uploadBanner,
    pickAndUploadBanner,
    uploadPhoto,
    pickAndUploadPhoto,
    uploadAadhaarDocument,
    pickAndUploadAadhaarDocument,
    uploadCredentialDocument,
    pickAndUploadCredentialDocument,
    reset,
  };
};

export default useDoctorUpload;
