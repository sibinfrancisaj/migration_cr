import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { VerificationStatus, MediaType } from '@abroad-matrimony/shared';
import { getStorageAdapter } from '@abroad-matrimony/storage';

const log = createChildLogger({ module: 'verification' });

// ─── Custom errors ────────────────────────────────────────────────────────────

export class VerificationAlreadySubmittedError extends Error {
  constructor() {
    super('VERIFICATION_ALREADY_SUBMITTED');
    this.name = 'VerificationAlreadySubmittedError';
  }
}

export class VerificationNotFoundError extends Error {
  constructor() {
    super('VERIFICATION_NOT_FOUND');
    this.name = 'VerificationNotFoundError';
  }
}

// ─── Trust score constants ────────────────────────────────────────────────────

/** Maximum trust score points per verification layer. */
export const TRUST_LAYERS = {
  PHONE: 20,
  FACE: 25,
  VOICE: 15,
  WORK: 20,
  EDUCATION: 20,
} as const;

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface VerificationStatusDto {
  status: string;
  idDocType: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export interface TrustScoreDto {
  total: number;
  max: number;
  layers: {
    phone: number;
    face: number;
    voice: number;
    work: number;
    education: number;
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Submit identity verification documents.
 *
 * Both `idDocS3Key` and `selfieS3Key` should already be uploaded to S3
 * via a presigned URL before calling this function.
 *
 * @throws {VerificationAlreadySubmittedError} — PENDING or UNDER_REVIEW record exists
 */
export async function submitVerification(
  userId: string,
  idDocType: string,
  idDocS3Key: string,
  selfieS3Key: string,
): Promise<VerificationStatusDto> {
  // Check for in-flight submission
  const existing = await prisma.verificationRequest.findFirst({
    where: {
      userId,
      status: { in: [VerificationStatus.PENDING, VerificationStatus.UNDER_REVIEW] },
    },
    select: { id: true },
  });

  if (existing) {
    log.warn('submitVerification — already submitted', { userId });
    throw new VerificationAlreadySubmittedError();
  }

  const request = await prisma.verificationRequest.create({
    data: {
      userId,
      idDocType,
      idDocS3Key,
      selfieS3Key,
      status: VerificationStatus.PENDING,
    },
  });

  // Save media records
  const storage = getStorageAdapter();
  const idDocUrl = storage.getPublicUrl(idDocS3Key);
  const selfieUrl = storage.getPublicUrl(selfieS3Key);

  await prisma.media.createMany({
    data: [
      { userId, type: MediaType.ID_DOCUMENT, s3Key: idDocS3Key, url: idDocUrl },
      { userId, type: MediaType.SELFIE, s3Key: selfieS3Key, url: selfieUrl },
    ],
    skipDuplicates: true,
  });

  log.info('submitVerification — submitted', { userId, requestId: request.id, idDocType });

  return {
    status: request.status,
    idDocType: request.idDocType,
    submittedAt: request.submittedAt.toISOString(),
    reviewedAt: null,
    reviewNote: null,
  };
}

/**
 * Get the user's current verification status.
 * Returns the most recent request.
 */
export async function getVerificationStatus(userId: string): Promise<VerificationStatusDto | null> {
  const request = await prisma.verificationRequest.findFirst({
    where: { userId },
    orderBy: { submittedAt: 'desc' },
    select: {
      status: true,
      idDocType: true,
      submittedAt: true,
      reviewedAt: true,
      reviewNote: true,
    },
  });

  if (!request) return null;

  return {
    status: request.status,
    idDocType: request.idDocType,
    submittedAt: request.submittedAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    reviewNote: request.reviewNote,
  };
}

/**
 * Compute the user's trust score from verification layers.
 *
 * Scoring rules:
 *  - Phone verified (+20): isPhoneVerified on user
 *  - Face verified (+25): approved VerificationRequest with a selfie
 *  - Voice intro (+15): a VOICE_INTRO media record exists
 *  - Work (+20): placeholder — reserved for future LinkedIn/work verification
 *  - Education (+20): placeholder — reserved for future degree verification
 */
export async function getTrustScore(userId: string): Promise<TrustScoreDto> {
  const [user, verificationRequest, voiceIntro] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { isPhoneVerified: true },
    }),
    prisma.verificationRequest.findFirst({
      where: { userId, status: VerificationStatus.APPROVED },
      select: { id: true },
    }),
    prisma.media.findFirst({
      where: { userId, type: MediaType.VOICE_INTRO },
      select: { id: true },
    }),
  ]);

  const layers = {
    phone: user?.isPhoneVerified ? TRUST_LAYERS.PHONE : 0,
    face: verificationRequest ? TRUST_LAYERS.FACE : 0,
    voice: voiceIntro ? TRUST_LAYERS.VOICE : 0,
    work: 0,      // reserved
    education: 0, // reserved
  };

  const total = Object.values(layers).reduce((sum, v) => sum + v, 0);
  const max = Object.values(TRUST_LAYERS).reduce((sum, v) => sum + v, 0);

  return { total, max, layers };
}

/**
 * Get a pre-signed S3 upload URL for a verification document or selfie.
 */
export async function getVerificationUploadUrl(
  userId: string,
  fileType: 'id_document' | 'selfie',
  mimeType: string,
): Promise<{ uploadUrl: string; s3Key: string }> {
  const mediaType = fileType === 'selfie' ? MediaType.SELFIE : MediaType.ID_DOCUMENT;
  const ext = mimeType.split('/')[1] ?? 'jpg';
  const s3Key = `verification/${userId}/${fileType}-${Date.now()}.${ext}`;

  const { uploadUrl } = await getStorageAdapter().getPresignedUploadUrl(s3Key, mimeType, 900);

  log.info('getVerificationUploadUrl — presigned URL generated', { userId, fileType, s3Key });

  // mediaType is declared but used only for logging / future extension
  void mediaType;

  return { uploadUrl, s3Key };
}
