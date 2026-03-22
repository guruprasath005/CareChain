import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import { config } from '../config';

const MAX_FILE_SIZE = config.upload.maxFileSizeMB * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(config.upload.allowedFileTypes);

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Unsupported file type "${file.mimetype}". Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}`
      )
    );
  }
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});
