/**
 * ADMIN-004 — Verification admin service.
 * List pending verifications, approve or reject identity documents.
 */
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { auditLog } from '@abroad-matrimony/auth';
import { VerificationStatus } from '@abroad-matrimony/shared';

const log = createChildLogger({ module: 'verification:admin' });

// ─── Custom errors ────────────────────────────────────────────────────────────

export class VerificationRequestNotFoundError extends Error {
  constructor() {
    super('VERIFICATION_REQUEST_NOT_FOUND');
    this.name = 'VerificationRequestNotFoundError';
  }
}

export class VerificationAlreadyReviewedError extends Error {
  constructor() {
    super('VERIFICATION_ALREADY_REVIEWED');
    this.name = 'VerificationAlreadyReviewedError';
  }
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface VerificationAdminDto {
  id: string;
  userId: string;
  status: string;
  idDocType: string;
  idDocS3Key: string;
  selfieS3Key: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  user: {
    phone: string;
    email: string | null;
    profileName: string | null;
  };
}

export interface VerificationListParams {
  status?: string;
  limit?: number;
  cursor?: string;
}

// ─── listVerifications ────────────────────────────────────────────────────────

export async function listVerifications(
  params: VerificationListParams,
): Promise<{ items: VerificationAdminDto[]; hasMore: boolean; nextCursor: string | null }> {
  const limit = Math.min(params.limit ?? 20, 100);

  const statusFilter = params.status
    ? { status: params.status as VerificationStatus }
    : {};

  const rows = await prisma.verificationRequest.findMany({
    where: {
      ...statusFilter,
      ...(params.cursor ? { id: { gt: params.cursor } } : {}),
    },
    orderBy: { submittedAt: 'desc' },
    take: limit + 1,
    select: {
      id: true,
      userId: true,
      status: true,
      idDocType: true,
      idDocS3Key: true,
      selfieS3Key: true,
      submittedAt: true,
      reviewedAt: true,
      reviewNote: true,
      user: {
        select: {
          phone: true,
          email: true,
          profile: { select: { name: true } },
        },
      },
    },
  });

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);

  return {
    items: page.map((r) => ({
      id: r.id,
      userId: r.userId,
      status: r.status,
      idDocType: r.idDocType,
      idDocS3Key: r.idDocS3Key,
      selfieS3Key: r.selfieS3Key,
      submittedAt: r.submittedAt.toISOString(),
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      reviewNote: r.reviewNote,
      user: {
        phone: r.user.phone,
        email: r.user.email,
        profileName: r.user.profile?.name ?? null,
      },
    })),
    hasMore,
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
  };
}

// ─── getVerificationAdmin ─────────────────────────────────────────────────────

export async function getVerificationAdmin(requestId: string): Promise<VerificationAdminDto> {
  const row = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      userId: true,
      status: true,
      idDocType: true,
      idDocS3Key: true,
      selfieS3Key: true,
      submittedAt: true,
      reviewedAt: true,
      reviewNote: true,
      user: {
        select: {
          phone: true,
          email: true,
          profile: { select: { name: true } },
        },
      },
    },
  });

  if (!row) throw new VerificationRequestNotFoundError();

  return {
    id: row.id,
    userId: row.userId,
    status: row.status,
    idDocType: row.idDocType,
    idDocS3Key: row.idDocS3Key,
    selfieS3Key: row.selfieS3Key,
    submittedAt: row.submittedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewNote: row.reviewNote,
    user: {
      phone: row.user.phone,
      email: row.user.email,
      profileName: row.user.profile?.name ?? null,
    },
  };
}

// ─── approveVerification ──────────────────────────────────────────────────────

export async function approveVerification(
  requestId: string,
  adminId: string,
  ipAddress: string,
): Promise<VerificationAdminDto> {
  const row = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    select: { id: true, userId: true, status: true },
  });

  if (!row) throw new VerificationRequestNotFoundError();

  if (row.status === VerificationStatus.APPROVED || row.status === VerificationStatus.REJECTED) {
    throw new VerificationAlreadyReviewedError();
  }

  await prisma.verificationRequest.update({
    where: { id: requestId },
    data: {
      status: VerificationStatus.APPROVED,
      reviewedAt: new Date(),
    },
  });

  log.info('approveVerification — approved', { requestId, userId: row.userId, adminId });

  await auditLog({
    adminId,
    action: 'APPROVE_VERIFICATION',
    entity: 'VerificationRequest',
    entityId: requestId,
    ipAddress,
    metadata: { userId: row.userId },
  });

  return getVerificationAdmin(requestId);
}

// ─── rejectVerification ───────────────────────────────────────────────────────

export async function rejectVerification(
  requestId: string,
  reason: string,
  adminId: string,
  ipAddress: string,
): Promise<VerificationAdminDto> {
  const row = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    select: { id: true, userId: true, status: true },
  });

  if (!row) throw new VerificationRequestNotFoundError();

  if (row.status === VerificationStatus.APPROVED || row.status === VerificationStatus.REJECTED) {
    throw new VerificationAlreadyReviewedError();
  }

  await prisma.verificationRequest.update({
    where: { id: requestId },
    data: {
      status: VerificationStatus.REJECTED,
      reviewedAt: new Date(),
      reviewNote: reason,
    },
  });

  log.info('rejectVerification — rejected', { requestId, userId: row.userId, adminId });

  await auditLog({
    adminId,
    action: 'REJECT_VERIFICATION',
    entity: 'VerificationRequest',
    entityId: requestId,
    ipAddress,
    metadata: { userId: row.userId, reason },
  });

  return getVerificationAdmin(requestId);
}
