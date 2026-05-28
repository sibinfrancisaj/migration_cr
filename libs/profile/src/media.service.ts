import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { getStorageAdapter } from '@abroad-matrimony/storage';
import type { MediaDto } from '@abroad-matrimony/shared';
import { MediaType } from '@abroad-matrimony/shared';
import { recalculateCompletionScore } from './score.service.js';
import { ProfileNotFoundError } from './real-life-answer.service.js';

const log = createChildLogger({ module: 'profile:media' });

// ── Constants ─────────────────────────────────────────────────────────────────

export const MAX_PHOTOS_PER_USER = 6;

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// ── Custom errors ─────────────────────────────────────────────────────────────

/**
 * Thrown when a user tries to upload a photo beyond the MAX_PHOTOS_PER_USER limit.
 */
export class PhotoLimitExceededError extends Error {
  constructor() {
    super('PHOTO_LIMIT_EXCEEDED');
    this.name = 'PhotoLimitExceededError';
  }
}

/**
 * Thrown when the uploaded file's MIME type is not allowed.
 */
export class InvalidMimeTypeError extends Error {
  constructor() {
    super('INVALID_MIME_TYPE');
    this.name = 'InvalidMimeTypeError';
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UploadProfilePhotoInput {
  userId:   string;
  buffer:   Buffer;
  mimeType: string;
  /** Original client filename — used only to derive the extension. */
  filename: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Uploads a profile photo to S3 (or mock) and records the media row in the DB.
 *
 * Flow:
 *   1. Verify the user has a profile.
 *   2. Guard: max 6 photos per user.
 *   3. Validate MIME type (jpeg / png / webp only).
 *   4. Generate S3 key: photos/<userId>/<uuid>.<ext>
 *   5. Upload file buffer via StorageAdapter.
 *   6. Insert a `media` row with type=PHOTO, s3Key, and returned URL.
 *   7. Recalculate and persist completion score.
 *
 * @throws {ProfileNotFoundError}    user has no profile
 * @throws {PhotoLimitExceededError} already at max photo count
 * @throws {InvalidMimeTypeError}    file type not allowed
 */
export async function uploadProfilePhoto(
  input: UploadProfilePhotoInput,
): Promise<MediaDto> {
  const { userId, buffer, mimeType, filename } = input;

  // 1. Profile guard
  const [profile, photoCount] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.media.count({ where: { userId, type: MediaType.PHOTO } }),
  ]);

  if (!profile) {
    log.warn('uploadProfilePhoto blocked — no profile for user', { userId });
    throw new ProfileNotFoundError();
  }

  // 2. Photo limit guard
  if (photoCount >= MAX_PHOTOS_PER_USER) {
    log.warn('uploadProfilePhoto blocked — photo limit reached', { userId, photoCount });
    throw new PhotoLimitExceededError();
  }

  // 3. MIME type guard
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    log.warn('uploadProfilePhoto blocked — invalid MIME type', { userId, mimeType });
    throw new InvalidMimeTypeError();
  }

  // 4. Build S3 key using the file extension from the original filename.
  const ext   = path.extname(filename).toLowerCase() || '.jpg';
  const s3Key = `photos/${userId}/${randomUUID()}${ext}`;

  // 5. Upload to storage
  const adapter = getStorageAdapter();
  const url     = await adapter.upload(s3Key, buffer, mimeType);

  // 6. Persist media row — order = existing count + 1 (1-based)
  const media = await prisma.media.create({
    data: {
      userId,
      type:       MediaType.PHOTO,
      s3Key,
      url,
      order:      photoCount + 1,
      isVerified: false,
    },
  });

  log.info('Profile photo uploaded', { userId, s3Key, mediaId: media.id });

  // 7. Recalculate completion score (awaking photos bucket if this is the first photo)
  await recalculateCompletionScore(userId);

  return {
    id:         media.id,
    type:       media.type as MediaType,
    url:        media.url,
    order:      media.order ?? undefined,
    isVerified: media.isVerified,
    createdAt:  media.createdAt,
  };
}
