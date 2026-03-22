// src/services/upload.service.ts
// File Upload Service - Integrates with Cloudinary with local fallback

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { logger } from '../utils/logger';
import { cloudinaryService, UploadPresetType } from './cloudinary.service';

export interface UploadResult {
    success: boolean;
    fileUrl?: string;
    secureUrl?: string;
    publicId?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    error?: string;
    isCloudinary?: boolean;
}

export interface FileInfo {
    originalName: string;
    mimeType: string;
    size: number;
    buffer: Buffer;
}

/**
 * Upload Service
 * Handles file uploads to Cloudinary with local fallback
 */
class UploadService {
    private uploadDir: string;
    private maxFileSizeBytes: number;
    private allowedMimeTypes: string[];

    constructor() {
        this.uploadDir = path.resolve(config.upload.dir);
        this.maxFileSizeBytes = config.upload.maxFileSizeMB * 1024 * 1024;
        this.allowedMimeTypes = config.upload.allowedFileTypes;
        this.ensureUploadDir();
    }

    /**
     * Ensure upload directory exists
     */
    private ensureUploadDir(): void {
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
            logger.info(`Created upload directory: ${this.uploadDir}`);
        }
    }

    /**
     * Check if Cloudinary is available
     */
    isCloudinaryEnabled(): boolean {
        return cloudinaryService.isReady();
    }

    /**
     * Validate file before upload
     */
    validateFile(file: FileInfo): { valid: boolean; error?: string } {
        // Check file size
        if (file.size > this.maxFileSizeBytes) {
            return {
                valid: false,
                error: `File size exceeds maximum allowed (${config.upload.maxFileSizeMB}MB)`,
            };
        }

        // Check mime type
        if (!this.allowedMimeTypes.includes(file.mimeType)) {
            return {
                valid: false,
                error: `File type ${file.mimeType} is not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
            };
        }

        return { valid: true };
    }

    /**
     * Upload a file
     */
    async uploadFile(
        file: FileInfo,
        category: string = 'general'
    ): Promise<UploadResult> {
        try {
            // Validate file
            const validation = this.validateFile(file);
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }

            // Create category subdirectory
            const categoryDir = path.join(this.uploadDir, category);
            if (!fs.existsSync(categoryDir)) {
                fs.mkdirSync(categoryDir, { recursive: true });
            }

            // Generate unique filename
            const fileExtension = path.extname(file.originalName);
            const uniqueFileName = `${uuidv4()}${fileExtension}`;
            const filePath = path.join(categoryDir, uniqueFileName);

            // Write file to disk
            await fs.promises.writeFile(filePath, file.buffer);

            // Generate URL (relative path for now, could be CDN in production)
            const fileUrl = `/uploads/${category}/${uniqueFileName}`;

            logger.debug(`File uploaded: ${fileUrl}`);

            return {
                success: true,
                fileUrl,
                fileName: uniqueFileName,
                fileSize: file.size,
                mimeType: file.mimeType,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('File upload failed:', errorMessage);
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Upload avatar image
     */
    async uploadAvatar(file: FileInfo, userId: string): Promise<UploadResult> {
        console.log('UploadService.uploadAvatar:', {
            mimeType: file.mimeType,
            originalName: file.originalName,
            size: file.size
        });

        // Validate image type
        const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
        if (!imageTypes.includes(file.mimeType)) {
            console.log('UploadService: Invalid mime type', file.mimeType);
            return {
                success: false,
                error: `Avatar must be a JPEG, PNG, WebP, HEIC, or HEIF image. Received: ${file.mimeType}`,
            };
        }

        // Try Cloudinary first
        if (this.isCloudinaryEnabled()) {
            const cloudResult = await cloudinaryService.uploadAvatar(file.buffer, userId);
            if (cloudResult.success) {
                return {
                    success: true,
                    fileUrl: cloudResult.secureUrl,
                    secureUrl: cloudResult.secureUrl,
                    publicId: cloudResult.publicId,
                    fileSize: cloudResult.bytes,
                    mimeType: file.mimeType,
                    isCloudinary: true,
                };
            }
            return {
                success: false,
                error: cloudResult.error || 'Cloudinary avatar upload failed',
                mimeType: file.mimeType,
            };
        }

        return this.uploadFile(file, `avatars/${userId}`);
    }

    /**
     * Upload document (PDF, images)
     */
    async uploadDocument(
        file: FileInfo,
        userId: string,
        documentType: string
    ): Promise<UploadResult> {
        // Try Cloudinary first
        if (this.isCloudinaryEnabled()) {
            const cloudResult = await cloudinaryService.uploadDocument(
                file.buffer,
                userId,
                documentType
            );
            if (cloudResult.success) {
                return {
                    success: true,
                    fileUrl: cloudResult.secureUrl,
                    secureUrl: cloudResult.secureUrl,
                    publicId: cloudResult.publicId,
                    fileSize: cloudResult.bytes,
                    mimeType: file.mimeType,
                    isCloudinary: true,
                };
            }
            return {
                success: false,
                error: cloudResult.error || 'Cloudinary document upload failed',
                mimeType: file.mimeType,
            };
        }

        return this.uploadFile(file, `documents/${userId}/${documentType}`);
    }

    /**
     * Upload hospital logo
     */
    async uploadLogo(file: FileInfo, userId: string): Promise<UploadResult> {
        const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/svg+xml'];
        if (!imageTypes.includes(file.mimeType)) {
            return {
                success: false,
                error: 'Logo must be a JPEG, PNG, WebP, HEIC, HEIF, or SVG image',
            };
        }

        // Try Cloudinary first
        if (this.isCloudinaryEnabled()) {
            const cloudResult = await cloudinaryService.uploadHospitalLogo(file.buffer, userId);
            if (cloudResult.success) {
                return {
                    success: true,
                    fileUrl: cloudResult.secureUrl,
                    secureUrl: cloudResult.secureUrl,
                    publicId: cloudResult.publicId,
                    fileSize: cloudResult.bytes,
                    mimeType: file.mimeType,
                    isCloudinary: true,
                };
            }
            return {
                success: false,
                error: cloudResult.error || 'Cloudinary logo upload failed',
                mimeType: file.mimeType,
            };
        }

        return this.uploadFile(file, `logos/${userId}`);
    }

    /**
     * Upload infrastructure/facility photo
     */
    async uploadPhoto(file: FileInfo, userId: string): Promise<UploadResult> {
        const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
        if (!imageTypes.includes(file.mimeType)) {
            return {
                success: false,
                error: 'Photo must be a JPEG, PNG, WebP, HEIC, or HEIF image',
            };
        }

        // Try Cloudinary first
        if (this.isCloudinaryEnabled()) {
            const cloudResult = await cloudinaryService.uploadInfrastructurePhoto(
                file.buffer,
                userId,
                uuidv4()
            );
            if (cloudResult.success) {
                return {
                    success: true,
                    fileUrl: cloudResult.secureUrl,
                    secureUrl: cloudResult.secureUrl,
                    publicId: cloudResult.publicId,
                    fileSize: cloudResult.bytes,
                    mimeType: file.mimeType,
                    isCloudinary: true,
                };
            }
            return {
                success: false,
                error: cloudResult.error || 'Cloudinary photo upload failed',
                mimeType: file.mimeType,
            };
        }

        return this.uploadFile(file, `photos/${userId}`);
    }

    /**
     * Upload Aadhaar document
     */
    async uploadAadhaarDocument(file: FileInfo, userId: string): Promise<UploadResult> {
        // Try Cloudinary first
        if (this.isCloudinaryEnabled()) {
            const cloudResult = await cloudinaryService.uploadAadhaarDocument(file.buffer, userId);
            if (cloudResult.success) {
                return {
                    success: true,
                    fileUrl: cloudResult.secureUrl,
                    secureUrl: cloudResult.secureUrl,
                    publicId: cloudResult.publicId,
                    fileSize: cloudResult.bytes,
                    mimeType: file.mimeType,
                    isCloudinary: true,
                };
            }
            return {
                success: false,
                error: cloudResult.error || 'Cloudinary Aadhaar upload failed',
                mimeType: file.mimeType,
            };
        }

        return this.uploadFile(file, `documents/${userId}/aadhaar`);
    }

    /**
     * Upload certificate document
     */
    async uploadCertificate(file: FileInfo, userId: string, certificateId: string): Promise<UploadResult> {
        // Try Cloudinary first
        if (this.isCloudinaryEnabled()) {
            const cloudResult = await cloudinaryService.uploadCertificate(file.buffer, userId, certificateId);
            if (cloudResult.success) {
                return {
                    success: true,
                    fileUrl: cloudResult.secureUrl,
                    secureUrl: cloudResult.secureUrl,
                    publicId: cloudResult.publicId,
                    fileSize: cloudResult.bytes,
                    mimeType: file.mimeType,
                    isCloudinary: true,
                };
            }
            return {
                success: false,
                error: cloudResult.error || 'Cloudinary certificate upload failed',
                mimeType: file.mimeType,
            };
        }

        return this.uploadFile(file, `documents/${userId}/certificates`);
    }

    /**
     * Upload license document
     */
    async uploadLicenseDocument(file: FileInfo, userId: string, licenseId: string): Promise<UploadResult> {
        // Try Cloudinary first
        if (this.isCloudinaryEnabled()) {
            const cloudResult = await cloudinaryService.uploadLicenseDocument(file.buffer, userId, licenseId);
            if (cloudResult.success) {
                return {
                    success: true,
                    fileUrl: cloudResult.secureUrl,
                    secureUrl: cloudResult.secureUrl,
                    publicId: cloudResult.publicId,
                    fileSize: cloudResult.bytes,
                    mimeType: file.mimeType,
                    isCloudinary: true,
                };
            }
            logger.warn('Cloudinary upload failed, falling back to local storage');
        }

        return this.uploadFile(file, `documents/${userId}/licenses`);
    }

    /**
     * Upload education document
     */
    async uploadEducationDocument(file: FileInfo, userId: string, educationId: string): Promise<UploadResult> {
        // Try Cloudinary first
        if (this.isCloudinaryEnabled()) {
            const cloudResult = await cloudinaryService.uploadEducationDocument(file.buffer, userId, educationId);
            if (cloudResult.success) {
                return {
                    success: true,
                    fileUrl: cloudResult.secureUrl,
                    secureUrl: cloudResult.secureUrl,
                    publicId: cloudResult.publicId,
                    fileSize: cloudResult.bytes,
                    mimeType: file.mimeType,
                    isCloudinary: true,
                };
            }
            logger.warn('Cloudinary upload failed, falling back to local storage');
        }

        return this.uploadFile(file, `documents/${userId}/education`);
    }

    /**
     * Upload hospital banner
     */
    async uploadHospitalBanner(file: FileInfo, userId: string): Promise<UploadResult> {
        const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
        if (!imageTypes.includes(file.mimeType)) {
            return {
                success: false,
                error: 'Banner must be a JPEG, PNG, WebP, HEIC, or HEIF image',
            };
        }

        // Try Cloudinary first
        if (this.isCloudinaryEnabled()) {
            const cloudResult = await cloudinaryService.uploadHospitalBanner(file.buffer, userId);
            if (cloudResult.success) {
                return {
                    success: true,
                    fileUrl: cloudResult.secureUrl,
                    secureUrl: cloudResult.secureUrl,
                    publicId: cloudResult.publicId,
                    fileSize: cloudResult.bytes,
                    mimeType: file.mimeType,
                    isCloudinary: true,
                };
            }
            logger.warn('Cloudinary upload failed, falling back to local storage');
        }

        return this.uploadFile(file, `banners/${userId}`);
    }

    /**
     * Upload hospital credential document
     */
    async uploadHospitalCredential(file: FileInfo, userId: string, credentialType: string): Promise<UploadResult> {
        // Try Cloudinary first
        if (this.isCloudinaryEnabled()) {
            const cloudResult = await cloudinaryService.uploadHospitalCredential(file.buffer, userId, credentialType);
            if (cloudResult.success) {
                return {
                    success: true,
                    fileUrl: cloudResult.secureUrl,
                    secureUrl: cloudResult.secureUrl,
                    publicId: cloudResult.publicId,
                    fileSize: cloudResult.bytes,
                    mimeType: file.mimeType,
                    isCloudinary: true,
                };
            }
            logger.warn('Cloudinary upload failed, falling back to local storage');
        }

        return this.uploadFile(file, `documents/${userId}/credentials`);
    }

    /**
     * Delete a file (handles both Cloudinary and local)
     */
    async deleteFile(fileUrl: string, publicId?: string): Promise<boolean> {
        // If publicId is provided or URL is from Cloudinary, delete from Cloudinary
        if (publicId || (fileUrl && fileUrl.includes('cloudinary.com'))) {
            const id = publicId || cloudinaryService.extractPublicIdFromUrl(fileUrl);
            if (id) {
                return cloudinaryService.deleteFile(id);
            }
        }

        try {
            // Convert URL to file path
            const relativePath = fileUrl.replace('/uploads/', '');
            const filePath = path.join(this.uploadDir, relativePath);

            // Check if file exists
            if (!fs.existsSync(filePath)) {
                logger.warn(`File not found for deletion: ${filePath}`);
                return false;
            }

            // Delete file
            await fs.promises.unlink(filePath);
            logger.debug(`File deleted: ${fileUrl}`);
            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('File deletion failed:', errorMessage);
            return false;
        }
    }

    /**
     * Delete multiple files
     */
    async deleteFiles(fileUrls: string[]): Promise<{ deleted: number; failed: number }> {
        let deleted = 0;
        let failed = 0;

        for (const url of fileUrls) {
            const success = await this.deleteFile(url);
            if (success) {
                deleted++;
            } else {
                failed++;
            }
        }

        return { deleted, failed };
    }

    /**
     * Get file info
     */
    async getFileInfo(fileUrl: string): Promise<{
        exists: boolean;
        size?: number;
        mimeType?: string;
    }> {
        try {
            const relativePath = fileUrl.replace('/uploads/', '');
            const filePath = path.join(this.uploadDir, relativePath);

            if (!fs.existsSync(filePath)) {
                return { exists: false };
            }

            const stats = await fs.promises.stat(filePath);
            const extension = path.extname(filePath).toLowerCase();

            const mimeTypes: Record<string, string> = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.webp': 'image/webp',
                '.pdf': 'application/pdf',
                '.svg': 'image/svg+xml',
            };

            return {
                exists: true,
                size: stats.size,
                mimeType: mimeTypes[extension] || 'application/octet-stream',
            };
        } catch (error) {
            return { exists: false };
        }
    }

    /**
     * Get upload URL for a file path
     */
    getFullUrl(relativePath: string, baseUrl: string = ''): string {
        if (relativePath.startsWith('http')) {
            return relativePath;
        }
        return `${baseUrl}${relativePath}`;
    }

    /**
     * Clean up old files (maintenance task)
     */
    async cleanupOldFiles(category: string, maxAgeDays: number): Promise<number> {
        const categoryDir = path.join(this.uploadDir, category);

        if (!fs.existsSync(categoryDir)) {
            return 0;
        }

        const now = Date.now();
        const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
        let deletedCount = 0;

        const files = await fs.promises.readdir(categoryDir);

        for (const file of files) {
            const filePath = path.join(categoryDir, file);
            const stats = await fs.promises.stat(filePath);

            if (now - stats.mtime.getTime() > maxAgeMs) {
                await fs.promises.unlink(filePath);
                deletedCount++;
            }
        }

        logger.info(`Cleaned up ${deletedCount} old files from ${category}`);
        return deletedCount;
    }

    /**
     * Get storage usage stats
     */
    async getStorageStats(): Promise<{
        totalFiles: number;
        totalSizeBytes: number;
        byCategory: Record<string, { files: number; sizeBytes: number }>;
    }> {
        const stats: {
            totalFiles: number;
            totalSizeBytes: number;
            byCategory: Record<string, { files: number; sizeBytes: number }>;
        } = {
            totalFiles: 0,
            totalSizeBytes: 0,
            byCategory: {},
        };

        const processDir = async (dir: string, category: string) => {
            if (!fs.existsSync(dir)) return;

            const entries = await fs.promises.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const entryPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    await processDir(entryPath, entry.name);
                } else {
                    const fileStats = await fs.promises.stat(entryPath);
                    stats.totalFiles++;
                    stats.totalSizeBytes += fileStats.size;

                    if (!stats.byCategory[category]) {
                        stats.byCategory[category] = { files: 0, sizeBytes: 0 };
                    }
                    stats.byCategory[category].files++;
                    stats.byCategory[category].sizeBytes += fileStats.size;
                }
            }
        };

        await processDir(this.uploadDir, 'root');
        return stats;
    }
}

// Export singleton instance
export const uploadService = new UploadService();
export default uploadService;
