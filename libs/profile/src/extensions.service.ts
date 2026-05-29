import { prisma } from '@abroad-matrimony/db';
import { getEnv } from '@abroad-matrimony/config';
import { createChildLogger } from '@abroad-matrimony/logger';
import { getStorageAdapter } from '@abroad-matrimony/storage';
import { MediaType } from '@abroad-matrimony/shared';
import { ProfileNotFoundError } from './real-life-answer.service.js';
import { transcribeVoiceIntro } from '@abroad-matrimony/ai';

const log = createChildLogger({ module: 'profile:extensions' });

// ─── Custom errors ────────────────────────────────────────────────────────────

export class VoiceIntroLimitError extends Error {
  constructor() {
    super('VOICE_INTRO_LIMIT_EXCEEDED');
    this.name = 'VoiceIntroLimitError';
  }
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Toggle the `isPaused` flag on a profile.
 * When paused, the user will not appear in discovery feeds.
 *
 * @throws {ProfileNotFoundError}
 */
export async function toggleProfilePause(userId: string): Promise<{ isPaused: boolean }> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true, isPaused: true },
  });

  if (!profile) throw new ProfileNotFoundError();

  const updated = await prisma.profile.update({
    where: { userId },
    data: { isPaused: !profile.isPaused },
    select: { isPaused: true },
  });

  log.info('toggleProfilePause — toggled', { userId, isPaused: updated.isPaused });

  return { isPaused: updated.isPaused };
}

/**
 * Get a pre-signed S3 URL for uploading a voice intro.
 * One voice intro per user is allowed (previous entry replaced by client re-upload).
 *
 * @throws {ProfileNotFoundError}
 */
export async function getVoiceIntroUploadUrl(
  userId: string,
  mimeType: string,
): Promise<{ uploadUrl: string; s3Key: string }> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!profile) throw new ProfileNotFoundError();

  const ext = mimeType === 'audio/mpeg' ? 'mp3' : mimeType === 'audio/webm' ? 'webm' : 'aac';
  const s3Key = `voice-intros/${userId}/${Date.now()}.${ext}`;

  const { uploadUrl } = await getStorageAdapter().getPresignedUploadUrl(s3Key, mimeType, 600);

  log.info('getVoiceIntroUploadUrl — presigned URL generated', { userId, s3Key });

  return { uploadUrl, s3Key };
}

/**
 * Register an uploaded voice intro in the Media table.
 * Replaces any existing VOICE_INTRO media for this user.
 *
 * @throws {ProfileNotFoundError}
 */
export async function saveVoiceIntro(
  userId: string,
  s3Key: string,
): Promise<{ url: string }> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!profile) throw new ProfileNotFoundError();

  const storage = getStorageAdapter();
  const url = storage.getPublicUrl(s3Key);

  // Remove any existing voice intro
  await prisma.media.deleteMany({
    where: { userId, type: MediaType.VOICE_INTRO },
  });

  await prisma.media.create({
    data: {
      userId,
      type: MediaType.VOICE_INTRO,
      s3Key,
      url,
    },
  });

  log.info('saveVoiceIntro — voice intro saved', { userId, s3Key });

  // AI-003/AI-007: Trigger Whisper transcription + profile intelligence update (non-fatal)
  void transcribeVoiceIntro(userId, s3Key).catch((err) => {
    log.warn('saveVoiceIntro — transcription enqueue failed (non-fatal)', { userId, err });
  });

  return { url };
}
