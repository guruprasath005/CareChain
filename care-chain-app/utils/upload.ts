
// utils/upload.ts
// Upload utilities for handling file uploads in the app

import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Platform, Alert } from 'react-native';
import { ENV } from '../config/env';

export interface FileInfo {
  success: boolean;
  uri?: string;
  url?: string;
  publicId?: string;
  error?: string;
}

/**
 * Get full image URL from relative path
 */
export const getFullImageUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  // If it starts with /, it's a relative path from our backend
  if (url.startsWith('/')) {
    // Remove /api/v1 from the end of API_URL to get base URL
    const baseUrl = ENV.API_URL.replace('/api/v1', '');
    return `${baseUrl}${url}`;
  }
  return url;
};

export interface ImagePickerResult {
  cancelled: boolean;
  uri?: string;
  type?: string;
  fileName?: string;
  fileSize?: number;
  width?: number;
  height?: number;
}

export interface DocumentPickerResult {
  cancelled: boolean;
  uri?: string;
  type?: string;
  name?: string;
  size?: number;
}

const extensionToMimeType: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const getFileExtension = (uri?: string, fileName?: string): string | undefined => {
  const fromName = fileName?.split('.').pop();
  if (fromName && fromName.length <= 6) return fromName.toLowerCase();

  const fromUri = uri?.split('?')[0]?.split('#')[0]?.split('.').pop();
  if (fromUri && fromUri.length <= 6) return fromUri.toLowerCase();

  return undefined;
};

const normalizeMimeType = (maybeType: string | undefined, uri?: string, fileName?: string): string => {
  const trimmed = (maybeType || '').trim().toLowerCase();

  // If the picker didn't provide a useful type, infer from extension.
  if (!trimmed || trimmed === 'application/octet-stream' || trimmed === 'binary/octet-stream' || trimmed === 'image') {
    const ext = getFileExtension(uri, fileName);
    if (ext && extensionToMimeType[ext]) return extensionToMimeType[ext];
    return 'application/octet-stream';
  }

  // Some Android devices might report jpg alias
  if (trimmed === 'image/jpg') return 'image/jpeg';

  return trimmed;
};

/**
 * Request camera and media library permissions
 */
export const requestMediaPermissions = async (): Promise<boolean> => {
  try {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    const mediaLibraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraPermission.status !== 'granted' || mediaLibraryPermission.status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant camera and photo library access to upload images.',
        [{ text: 'OK' }]
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error requesting permissions:', error);
    return false;
  }
};

/**
 * Pick an image from the camera or gallery
 */
export const pickImage = async (options: {
  source?: 'camera' | 'gallery' | 'both';
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
} = {}): Promise<ImagePickerResult> => {
  const {
    source = 'both',
    allowsEditing = true,
    aspect = [1, 1],
    quality = 0.8,
  } = options;

  const hasPermissions = await requestMediaPermissions();
  if (!hasPermissions) {
    return { cancelled: true };
  }

  const pickerOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: 'images',
    allowsEditing,
    aspect,
    quality,
  };

  let result: ImagePicker.ImagePickerResult;

  if (source === 'camera') {
    result = await ImagePicker.launchCameraAsync(pickerOptions);
  } else if (source === 'gallery') {
    result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
  } else {
    // Show action sheet to choose between camera and gallery
    return new Promise((resolve) => {
      Alert.alert(
        'Select Image',
        'Choose how you want to add an image',
        [
          {
            text: 'Take Photo',
            onPress: async () => {
              const camResult = await ImagePicker.launchCameraAsync(pickerOptions);
              resolve(processImagePickerResult(camResult));
            },
          },
          {
            text: 'Choose from Gallery',
            onPress: async () => {
              const galResult = await ImagePicker.launchImageLibraryAsync(pickerOptions);
              resolve(processImagePickerResult(galResult));
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve({ cancelled: true }),
          },
        ]
      );
    });
  }

  return processImagePickerResult(result);
};

/**
 * Process ImagePicker result to normalize format
 */
const processImagePickerResult = (result: ImagePicker.ImagePickerResult): ImagePickerResult => {
  if (result.canceled || !result.assets || result.assets.length === 0) {
    return { cancelled: true };
  }

  const asset = result.assets[0];
  return {
    cancelled: false,
    uri: asset.uri,
    type: asset.mimeType || 'image/jpeg',
    fileName: asset.fileName || `image_${Date.now()}.jpg`,
    fileSize: asset.fileSize,
    width: asset.width,
    height: asset.height,
  };
};

/**
 * Pick a document (PDF, images, etc.)
 */
export const pickDocument = async (options: {
  type?: string[];
  copyToCacheDirectory?: boolean;
} = {}): Promise<DocumentPickerResult> => {
  const {
    type = ['image/*', 'application/pdf'],
    copyToCacheDirectory = true,
  } = options;

  try {
    const result = await DocumentPicker.getDocumentAsync({
      type,
      copyToCacheDirectory,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { cancelled: true };
    }

    const asset = result.assets[0];
    return {
      cancelled: false,
      uri: asset.uri,
      type: normalizeMimeType(asset.mimeType, asset.uri, asset.name),
      name: asset.name,
      size: asset.size,
    };
  } catch (error) {
    console.error('Error picking document:', error);
    return { cancelled: true };
  }
};

/**
 * Create FormData for file upload
 */
export const createFormData = (
  uri: string,
  fieldName: string = 'file',
  options: {
    fileName?: string;
    type?: string;
  } = {}
): FormData => {
  const formData = new FormData();

  // Determine extension & MIME type (robust against iOS URIs without extension)
  const ext = getFileExtension(uri, options.fileName) || 'bin';
  const fileName = options.fileName || `upload_${Date.now()}.${ext} `;
  const mimeType = normalizeMimeType(options.type, uri, fileName);

  // Append file to FormData
  formData.append(fieldName, {
    uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
    type: mimeType,
    name: fileName,
  } as any);

  return formData;
};

/**
 * Create FormData specifically for avatar/profile picture upload
 */
export const createAvatarFormData = (uri: string, type: string = 'image/jpeg'): FormData => {
  const normalizedType = normalizeMimeType(type, uri, undefined);
  const extension =
    normalizedType === 'image/png'
      ? 'png'
      : normalizedType === 'image/webp'
        ? 'webp'
        : normalizedType === 'image/heic'
          ? 'heic'
          : normalizedType === 'image/heif'
            ? 'heif'
            : 'jpg';
  return createFormData(uri, 'avatar', {
    fileName: `avatar_${Date.now()}.${extension} `,
    type: normalizedType,
  });
};

/**
 * Create FormData specifically for document upload
 */
export const createDocumentFormData = (
  uri: string,
  fileName?: string,
  type?: string
): FormData => {
  return createFormData(uri, 'document', { fileName, type });
};

/**
 * Create FormData for logo upload
 */
export const createLogoFormData = (uri: string): FormData => {
  return createFormData(uri, 'logo', {
    fileName: `logo_${Date.now()}.png`,
    type: 'image/png',
  });
};

/**
 * Create FormData for banner upload
 */
export const createBannerFormData = (uri: string): FormData => {
  return createFormData(uri, 'banner', {
    fileName: `banner_${Date.now()}.jpg`,
    type: 'image/jpeg',
  });
};

/**
 * Create FormData for photo upload
 */
export const createPhotoFormData = (uri: string): FormData => {
  return createFormData(uri, 'photo', {
    fileName: `photo_${Date.now()}.jpg`,
    type: 'image/jpeg',
  });
};

/**
 * Validate image file
 */
export const validateImage = (
  file: { uri?: string; type?: string; fileSize?: number; size?: number },
  options: {
    maxSizeMB?: number;
    allowedTypes?: string[];
  } = {}
): { valid: boolean; error?: string } => {
  const {
    maxSizeMB = 5,
    allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  } = options;

  const fileSize = file.fileSize || file.size || 0;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (fileSize > maxSizeBytes) {
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`,
    };
  }

  const normalizedType = normalizeMimeType(file.type, file.uri, undefined);
  if (file.type && !allowedTypes.includes(normalizedType)) {
    return {
      valid: false,
      error: `File type ${normalizedType} is not allowed.Allowed: ${allowedTypes.join(', ')} `,
    };
  }

  return { valid: true };
};

/**
 * Validate document file
 */
export const validateDocument = (
  file: { uri?: string; type?: string; fileSize?: number; size?: number },
  options: {
    maxSizeMB?: number;
    allowedTypes?: string[];
  } = {}
): { valid: boolean; error?: string } => {
  const {
    maxSizeMB = 10,
    allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  } = options;

  return validateImage(file, { maxSizeMB, allowedTypes });
};

/**
 * Get optimized Cloudinary URL with transformations
 */
export const getOptimizedImageUrl = (
  url: string,
  options: {
    width?: number;
    height?: number;
    crop?: 'fill' | 'fit' | 'limit' | 'scale';
    quality?: 'auto' | 'auto:good' | 'auto:best' | 'auto:low';
    format?: 'auto' | 'webp' | 'jpg' | 'png';
  } = {}
): string => {
  // If not a Cloudinary URL, return as is
  if (!url || !url.includes('cloudinary.com')) {
    return url;
  }

  const {
    width,
    height,
    crop = 'fill',
    quality = 'auto:good',
    format = 'auto',
  } = options;

  // Build transformation string
  const transformations: string[] = [];

  if (width || height) {
    let sizeTransform = '';
    if (width) sizeTransform += `w_${width} `;
    if (height) sizeTransform += (sizeTransform ? ',' : '') + `h_${height} `;
    if (crop) sizeTransform += `, c_${crop} `;
    transformations.push(sizeTransform);
  }

  transformations.push(`q_${quality} `);
  transformations.push(`f_${format} `);

  // Insert transformations into URL
  // Cloudinary URL format: .../upload/[transformations]/[path]
  const uploadIndex = url.indexOf('/upload/');
  if (uploadIndex === -1) {
    return url;
  }

  const transformStr = transformations.join(',');
  const beforeUpload = url.substring(0, uploadIndex + 8); // includes '/upload/'
  const afterUpload = url.substring(uploadIndex + 8);

  // Check if there are already transformations
  const hasTransformations = afterUpload.startsWith('v') && afterUpload.includes('/');

  if (hasTransformations) {
    // Insert before version number
    return `${beforeUpload}${transformStr}/${afterUpload}`;
  } else {
    return `${beforeUpload}${transformStr}/${afterUpload}`;
  }
};

/**
 * Get thumbnail URL from Cloudinary
 */
export const getThumbnailUrl = (url: string, size: number = 150): string => {
  return getOptimizedImageUrl(url, {
    width: size,
    height: size,
    crop: 'fill',
    quality: 'auto:low',
    format: 'webp',
  });
};

/**
 * Get avatar URL with proper sizing
 */
export const getAvatarUrl = (url: string | null | undefined, size: number = 200): string => {
  if (!url) {
    return ''; // Return empty for placeholder handling
  }

  return getOptimizedImageUrl(url, {
    width: size,
    height: size,
    crop: 'fill',
    quality: 'auto:good',
    format: 'webp',
  });
};

/**
 * Check if URL is from Cloudinary
 */
export const isCloudinaryUrl = (url: string): boolean => {
  return !!(url && url.includes('cloudinary.com'));
};

import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Compress image before upload
 */
export const compressImage = async (
  uri: string,
  options: {
    maxWidth?: number;
    quality?: number;
    format?: ImageManipulator.SaveFormat;
  } = {}
): Promise<{ uri: string; width: number; height: number; base64?: string }> => {
  const {
    maxWidth = 1024,
    quality = 0.7,
    format = ImageManipulator.SaveFormat.JPEG,
  } = options;

  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      { compress: quality, format }
    );
    return result;
  } catch (error) {
    console.error('Image compression failed:', error);
    // Return original if compression fails, but this might fail if type is wrong
    return { uri, width: 0, height: 0 };
  }
};
