import multer, { MulterError } from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware.js';
import { HTTP_STATUS, ERROR_CODES } from '../constants/index.js';
import { PROFILE_ERRORS } from '../constants/profile.constants.js';

// ── Configuration ─────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES  = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES   = new Set(['image/jpeg', 'image/png', 'image/webp']);

// ── Multer instance ───────────────────────────────────────────────────────────

/**
 * Multer instance configured for in-memory storage.
 * Files are available as `req.file` (Buffer) — never written to disk.
 * MIME type and size are pre-validated here so the service layer receives
 * only valid input.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter(_req, file, callback) {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error('INVALID_MIME_TYPE'));
    }
  },
});

// ── Exported middleware ───────────────────────────────────────────────────────

/**
 * `uploadSinglePhoto` — Express middleware that parses a `multipart/form-data`
 * request containing a single image field named `"photo"`.
 *
 * On success: `req.file` is populated with the in-memory buffer.
 * On failure: calls `next(AppError)` with an appropriate HTTP status code.
 *
 * Usage:
 *   router.post('/media', requireAuth, uploadSinglePhoto, controller.uploadPhoto);
 */
export function uploadSinglePhoto(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  upload.single('photo')(req, res, (err) => {
    if (!err) {
      // multer succeeded — check that a file was actually provided
      if (!req.file) {
        next(new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, PROFILE_ERRORS.NO_FILE_UPLOADED));
        return;
      }
      next();
      return;
    }

    // multer / fileFilter errors
    if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, PROFILE_ERRORS.FILE_TOO_LARGE));
      return;
    }

    // Wrong field name — client used a field other than "photo"
    if (err instanceof MulterError && err.code === 'LIMIT_UNEXPECTED_FILE') {
      next(new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, PROFILE_ERRORS.NO_FILE_UPLOADED));
      return;
    }

    if (err instanceof Error && err.message === 'INVALID_MIME_TYPE') {
      next(new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, PROFILE_ERRORS.INVALID_MIME_TYPE));
      return;
    }

    // Unknown error — propagate as 500
    next(err);
  });
}
