// src/services/cloudinary.service.ts
// Cloudinary Service - Handles all file uploads to Cloudinary

import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { config } from '../config';
import { logger } from '../utils/logger';

// Configure Cloudinary
cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
});

export interface CloudinaryUploadResult {
    success: boolean;
    url?: string;
    secureUrl?: string;
    publicId?: string;
    format?: string;
    width?: number;
    height?: number;
    bytes?: number;
    resourceType?: string;
    error?: string;
}

export interface CloudinaryUploadOptions {
    folder?: string;
    publicId?: string;
    resourceType?: 'image' | 'raw' | 'video' | 'auto';
    transformation?: object[];
    allowedFormats?: string[];
    maxBytes?: number;
    tags?: string[];
    overwrite?: boolean;
}

// Upload type presets for different document types
export const uploadPresets = {
    avatar: {
        folder: 'care-chain/avatars',
        resourceType: 'image' as const,
        transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
            { quality: 'auto:good' },
            { format: 'webp' },
        ] as object[],
        allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
        maxBytes: 5 * 1024 * 1024, // 5MB
    },
    profilePicture: {
        folder: 'care-chain/profile-pictures',
        resourceType: 'image' as const,
        transformation: [
            { width: 500, height: 500, crop: 'fill', gravity: 'face' },
            { quality: 'auto:good' },
            { format: 'webp' },
        ] as object[],
        allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
        maxBytes: 5 * 1024 * 1024, // 5MB
    },
    certificate: {
        folder: 'care-chain/certificates',
        resourceType: 'auto' as const,
        transformation: undefined as object[] | undefined,
        allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
        maxBytes: 10 * 1024 * 1024, // 10MB
    },
    document: {
        folder: 'care-chain/documents',
        resourceType: 'auto' as const,
        transformation: undefined as object[] | undefined,
        allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
        maxBytes: 10 * 1024 * 1024, // 10MB
    },
    aadhaar: {
        folder: 'care-chain/aadhaar',
        resourceType: 'auto' as const,
        transformation: undefined as object[] | undefined,
        allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
        maxBytes: 5 * 1024 * 1024, // 5MB
    },
    license: {
        folder: 'care-chain/licenses',
        resourceType: 'auto' as const,
        transformation: undefined as object[] | undefined,
        allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
        maxBytes: 10 * 1024 * 1024, // 10MB
    },
    education: {
        folder: 'care-chain/education',
        resourceType: 'auto' as const,
        transformation: undefined as object[] | undefined,
        allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
        maxBytes: 10 * 1024 * 1024, // 10MB
    },
    hospitalLogo: {
        folder: 'care-chain/hospital-logos',
        resourceType: 'image' as const,
        transformation: [
            { width: 400, height: 400, crop: 'fit' },
            { quality: 'auto:good' },
            { format: 'webp' },
        ] as object[],
        allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'svg'],
        maxBytes: 5 * 1024 * 1024, // 5MB
    },
    hospitalBanner: {
        folder: 'care-chain/hospital-banners',
        resourceType: 'image' as const,
        transformation: [
            { width: 1200, height: 400, crop: 'fill' },
            { quality: 'auto:good' },
            { format: 'webp' },
        ] as object[],
        allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
        maxBytes: 10 * 1024 * 1024, // 10MB
    },
    infrastructurePhoto: {
        folder: 'care-chain/infrastructure',
        resourceType: 'image' as const,
        transformation: [
            { width: 1200, height: 800, crop: 'limit' },
            { quality: 'auto:good' },
            { format: 'webp' },
        ] as object[],
        allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
        maxBytes: 10 * 1024 * 1024, // 10MB
    },
    hospitalCredential: {
        folder: 'care-chain/hospital-credentials',
        resourceType: 'auto' as const,
        transformation: undefined as object[] | undefined,
        allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
        maxBytes: 10 * 1024 * 1024, // 10MB
    },
};

export type UploadPresetType = keyof typeof uploadPresets;

/**
 * Cloudinary Service
 * Handles file uploads, deletions, and transformations
 */
class CloudinaryService {
    private isConfigured: boolean;

    constructor() {
        this.isConfigured = !!(
            config.cloudinary.cloudName &&
            config.cloudinary.apiKey &&
            config.cloudinary.apiSecret
        );

        if (!this.isConfigured) {
            logger.warn('Cloudinary is not configured. File uploads will use local storage fallback.');
            console.log('Cloudinary Config Missing:', {
                cloudName: !!config.cloudinary.cloudName,
                apiKey: !!config.cloudinary.apiKey,
                apiSecret: !!config.cloudinary.apiSecret
            });
        } else {
            logger.info('Cloudinary service initialized successfully');
            console.log('Cloudinary Configured:', {
                cloudName: config.cloudinary.cloudName,
                apiKey: '***' + config.cloudinary.apiKey.slice(-4)
            });
        }
    }

    /**
     * Check if Cloudinary is properly configured
     */
    isReady(): boolean {
        return this.isConfigured;
    }

    /**
     * Upload a file buffer to Cloudinary
     */
    async uploadBuffer(
        buffer: Buffer,
        options: CloudinaryUploadOptions = {}
    ): Promise<CloudinaryUploadResult> {
        if (!this.isConfigured) {
            return { success: false, error: 'Cloudinary is not configured' };
        }

        try {
            // Convert buffer to base64 data URI
            const base64 = buffer.toString('base64');
            const dataUri = `data:application/octet-stream;base64,${base64}`;

            const uploadOptions: Record<string, unknown> = {
                folder: options.folder || 'care-chain/uploads',
                resource_type: options.resourceType || 'auto',
                overwrite: options.overwrite ?? true,
                tags: options.tags || [],
            };

            if (options.publicId) {
                uploadOptions.public_id = options.publicId;
            }

            if (options.transformation) {
                uploadOptions.transformation = options.transformation;
            }

            if (options.allowedFormats) {
                uploadOptions.allowed_formats = options.allowedFormats;
            }

            const result: UploadApiResponse = await cloudinary.uploader.upload(dataUri, uploadOptions);

            logger.debug(`File uploaded to Cloudinary: ${result.secure_url}`);

            return {
                success: true,
                url: result.url,
                secureUrl: result.secure_url,
                publicId: result.public_id,
                format: result.format,
                width: result.width,
                height: result.height,
                bytes: result.bytes,
                resourceType: result.resource_type,
            };
        } catch (error: any) {
            // Enhanced error logging for debugging
            const errorMessage = error?.message || 'Upload failed';
            const errorCode = error?.http_code || error?.error?.http_code;

            logger.error('Cloudinary upload failed:', {
                message: errorMessage,
                httpCode: errorCode,
                name: error?.name,
                error: error?.error,
            });

            // Provide more specific error messages
            if (errorCode === 401 || errorMessage.includes('Invalid')) {
                return { success: false, error: 'Cloudinary authentication failed. Check API credentials.' };
            }
            if (errorCode === 400) {
                return { success: false, error: `Invalid upload: ${errorMessage}` };
            }

            return { success: false, error: errorMessage };
        }
    }

    /**
     * Upload a file using a preset configuration
     */
    async uploadWithPreset(
        buffer: Buffer,
        preset: UploadPresetType,
        userId: string,
        additionalOptions: Partial<CloudinaryUploadOptions> = {}
    ): Promise<CloudinaryUploadResult> {
        const presetConfig = uploadPresets[preset];

        if (!presetConfig) {
            return { success: false, error: `Unknown upload preset: ${preset}` };
        }

        const options: CloudinaryUploadOptions = {
            folder: `${presetConfig.folder}/${userId}`,
            resourceType: presetConfig.resourceType,
            transformation: presetConfig.transformation,
            allowedFormats: presetConfig.allowedFormats,
            maxBytes: presetConfig.maxBytes,
            tags: [preset, userId],
            ...additionalOptions,
        };

        return this.uploadBuffer(buffer, options);
    }

    /**
     * Upload avatar/profile picture
     */
    async uploadAvatar(buffer: Buffer, userId: string): Promise<CloudinaryUploadResult> {
        return this.uploadWithPreset(buffer, 'avatar', userId, {
            publicId: `avatar_${userId}`,
            overwrite: true,
        });
    }

    /**
     * Upload profile picture (doctor/hospital)
     */
    async uploadProfilePicture(buffer: Buffer, userId: string): Promise<CloudinaryUploadResult> {
        return this.uploadWithPreset(buffer, 'profilePicture', userId, {
            publicId: `profile_${userId}`,
            overwrite: true,
        });
    }

    /**
     * Upload certificate
     */
    async uploadCertificate(
        buffer: Buffer,
        userId: string,
        certificateId: string
    ): Promise<CloudinaryUploadResult> {
        return this.uploadWithPreset(buffer, 'certificate', userId, {
            publicId: `cert_${certificateId}`,
        });
    }

    /**
     * Upload document (generic)
     */
    async uploadDocument(
        buffer: Buffer,
        userId: string,
        documentType: string,
        documentId?: string
    ): Promise<CloudinaryUploadResult> {
        return this.uploadWithPreset(buffer, 'document', userId, {
            publicId: documentId ? `doc_${documentType}_${documentId}` : undefined,
            tags: ['document', documentType, userId],
        });
    }

    /**
     * Upload Aadhaar document
     */
    async uploadAadhaarDocument(buffer: Buffer, userId: string): Promise<CloudinaryUploadResult> {
        return this.uploadWithPreset(buffer, 'aadhaar', userId, {
            publicId: `aadhaar_${userId}`,
            overwrite: true,
        });
    }

    /**
     * Upload medical license document
     */
    async uploadLicenseDocument(
        buffer: Buffer,
        userId: string,
        licenseId: string
    ): Promise<CloudinaryUploadResult> {
        return this.uploadWithPreset(buffer, 'license', userId, {
            publicId: `license_${licenseId}`,
        });
    }

    /**
     * Upload education document
     */
    async uploadEducationDocument(
        buffer: Buffer,
        userId: string,
        educationId: string
    ): Promise<CloudinaryUploadResult> {
        return this.uploadWithPreset(buffer, 'education', userId, {
            publicId: `education_${educationId}`,
        });
    }

    /**
     * Upload hospital logo
     */
    async uploadHospitalLogo(buffer: Buffer, userId: string): Promise<CloudinaryUploadResult> {
        return this.uploadWithPreset(buffer, 'hospitalLogo', userId, {
            publicId: `logo_${userId}`,
            overwrite: true,
        });
    }

    /**
     * Upload hospital banner
     */
    async uploadHospitalBanner(buffer: Buffer, userId: string): Promise<CloudinaryUploadResult> {
        return this.uploadWithPreset(buffer, 'hospitalBanner', userId, {
            publicId: `banner_${userId}`,
            overwrite: true,
        });
    }

    /**
     * Upload infrastructure/facility photo
     */
    async uploadInfrastructurePhoto(
        buffer: Buffer,
        userId: string,
        photoId: string
    ): Promise<CloudinaryUploadResult> {
        return this.uploadWithPreset(buffer, 'infrastructurePhoto', userId, {
            publicId: `infra_${photoId}`,
        });
    }

    /**
     * Upload hospital credential document
     */
    async uploadHospitalCredential(
        buffer: Buffer,
        userId: string,
        credentialType: string
    ): Promise<CloudinaryUploadResult> {
        return this.uploadWithPreset(buffer, 'hospitalCredential', userId, {
            publicId: `credential_${credentialType}_${userId}`,
            overwrite: true,
        });
    }

    /**
     * Delete a file from Cloudinary
     */
    async deleteFile(publicId: string, resourceType: 'image' | 'raw' | 'video' = 'image'): Promise<boolean> {
        if (!this.isConfigured) {
            logger.warn('Cloudinary not configured, cannot delete file');
            return false;
        }

        try {
            const result = await cloudinary.uploader.destroy(publicId, {
                resource_type: resourceType,
            });

            if (result.result === 'ok') {
                logger.debug(`File deleted from Cloudinary: ${publicId}`);
                return true;
            }

            logger.warn(`Failed to delete file from Cloudinary: ${publicId}`, result);
            return false;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Delete failed';
            logger.error('Cloudinary delete failed:', errorMessage);
            return false;
        }
    }

    /**
     * Delete multiple files from Cloudinary
     */
    async deleteFiles(publicIds: string[], resourceType: 'image' | 'raw' | 'video' = 'image'): Promise<{
        deleted: string[];
        failed: string[];
    }> {
        const deleted: string[] = [];
        const failed: string[] = [];

        for (const publicId of publicIds) {
            const success = await this.deleteFile(publicId, resourceType);
            if (success) {
                deleted.push(publicId);
            } else {
                failed.push(publicId);
            }
        }

        return { deleted, failed };
    }

    /**
     * Generate a signed URL for private files
     */
    getSignedUrl(publicId: string, expiresInSeconds: number = 3600): string {
        return cloudinary.url(publicId, {
            sign_url: true,
            type: 'authenticated',
            expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
        });
    }

    /**
     * Generate optimized image URL with transformations
     */
    getOptimizedUrl(
        publicId: string,
        options: {
            width?: number;
            height?: number;
            crop?: string;
            quality?: string;
            format?: string;
        } = {}
    ): string {
        const transformation: Record<string, unknown>[] = [];

        if (options.width || options.height) {
            transformation.push({
                width: options.width,
                height: options.height,
                crop: options.crop || 'limit',
            });
        }

        transformation.push({
            quality: options.quality || 'auto:good',
            format: options.format || 'auto',
        });

        return cloudinary.url(publicId, {
            transformation,
            secure: true,
        });
    }

    /**
     * Get thumbnail URL for an image
     */
    getThumbnailUrl(publicId: string, size: number = 150): string {
        return cloudinary.url(publicId, {
            transformation: [
                { width: size, height: size, crop: 'fill', gravity: 'auto' },
                { quality: 'auto:low', format: 'webp' },
            ],
            secure: true,
        });
    }

    /**
     * Extract public ID from Cloudinary URL
     */
    extractPublicIdFromUrl(url: string): string | null {
        if (!url || !url.includes('cloudinary.com')) {
            return null;
        }

        try {
            // URL format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/{version}/{public_id}.{format}
            const regex = /\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/;
            const match = url.match(regex);
            return match ? match[1] : null;
        } catch (error) {
            logger.error('Failed to extract public ID from URL:', url);
            return null;
        }
    }
}

// Export singleton instance
export const cloudinaryService = new CloudinaryService();
export default cloudinaryService;
