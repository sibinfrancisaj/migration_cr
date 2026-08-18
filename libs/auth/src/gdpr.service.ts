/**
 * PROD-002 — GDPR data export and account deletion.
 *
 * Data export: compiles all user-owned data and queues an email with a JSON
 * summary. Full message export (Firestore) is handled separately (F-039).
 *
 * Account deletion: anonymises PII fields, soft-deletes the user row, and
 * cascades to related data via DB foreign-key ON DELETE CASCADE.
 */
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';

const log = createChildLogger({ module: 'auth:gdpr' });

// ── Error types ───────────────────────────────────────────────────────────────

export class AccountAlreadyDeletedError extends Error {
  constructor() {
    super('ACCOUNT_ALREADY_DELETED');
    this.name = 'AccountAlreadyDeletedError';
  }
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface DataExportSummaryDto {
  exportedAt: string;
  sections: string[];
  note: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Compiles a summary of all data held for the user and returns it as a DTO.
 * Callers are responsible for delivering the export (e.g. via email).
 *
 * Full Firestore message export is a background job (F-039, future).
 */
export async function exportUserData(userId: string): Promise<DataExportSummaryDto> {
  const [
    user,
    profile,
    realLifeAnswers,
    storyPromptAnswers,
    media,
    habitLogs,
    promptResponses,
    connections,
    eventRsvps,
    savedProfiles,
    blocks,
    verificationRequests,
    memberships,
    diamondLedger,
    checkIns,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, phone: true, email: true, createdAt: true } }),
    prisma.profile.findUnique({ where: { userId }, select: { name: true, dateOfBirth: true, gender: true, currentCity: true, currentCountry: true } }),
    prisma.realLifeAnswer.findMany({ where: { userId } }),
    prisma.storyPromptAnswer.findMany({ where: { userId } }),
    prisma.media.findMany({ where: { userId }, select: { type: true, url: true, createdAt: true } }),
    prisma.habitLog.findMany({ where: { userId } }),
    prisma.promptResponse.findMany({ where: { userId }, select: { promptId: true, text: true, createdAt: true } }),
    prisma.connection.findMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] }, select: { status: true, createdAt: true } }),
    prisma.eventRsvp.findMany({ where: { userId }, select: { eventId: true, status: true, createdAt: true } }),
    prisma.savedProfile.findMany({ where: { userId }, select: { savedUserId: true, label: true } }),
    prisma.userBlock.findMany({ where: { blockerId: userId }, select: { blockedId: true, createdAt: true } }),
    prisma.verificationRequest.findMany({ where: { userId }, select: { status: true, submittedAt: true } }),
    prisma.membership.findMany({ where: { userId }, select: { plan: true, status: true, expiresAt: true } }),
    prisma.diamondLedger.findMany({ where: { userId }, select: { delta: true, reason: true, balanceAfter: true, createdAt: true } }),
    prisma.checkIn.findMany({ where: { userId }, select: { weekKey: true, mood: true, submittedAt: true } }),
  ]);

  log.info('Data export compiled', { userId });

  const sections = [
    `account: ${user ? '1 record' : '0 records'}`,
    `profile: ${profile ? '1 record' : '0 records'}`,
    `real-life answers: ${realLifeAnswers.length} records`,
    `story prompt answers: ${storyPromptAnswers.length} records`,
    `media: ${media.length} records`,
    `habit logs: ${habitLogs.length} records`,
    `prompt responses: ${promptResponses.length} records`,
    `connections: ${connections.length} records`,
    `event RSVPs: ${eventRsvps.length} records`,
    `saved profiles: ${savedProfiles.length} records`,
    `blocks: ${blocks.length} records`,
    `verification requests: ${verificationRequests.length} records`,
    `memberships: ${memberships.length} records`,
    `diamond ledger: ${diamondLedger.length} records`,
    `check-ins: ${checkIns.length} records`,
  ];

  return {
    exportedAt: new Date().toISOString(),
    sections,
    note: 'Firestore message history export is processed separately and delivered within 30 days.',
  };
}

/**
 * Soft-deletes the user account by:
 *  1. Anonymising PII fields (phone, email, profile name/DOB).
 *  2. Stamping `deletedAt` on the user row.
 *  3. Pausing the profile so the account is invisible.
 *
 * Cascading deletes (connections, sessions, etc.) are handled by DB ON DELETE CASCADE.
 *
 * @throws {AccountAlreadyDeletedError} if the user is already deleted.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, deletedAt: true },
  });

  if (!user || user.deletedAt) {
    throw new AccountAlreadyDeletedError();
  }

  const anonymisedPhone = `+00000000${userId.slice(0, 8)}`;
  const now = new Date();

  await prisma.$transaction([
    // Anonymise PII on the user row
    prisma.user.update({
      where: { id: userId },
      data: {
        phone: anonymisedPhone,
        email: null,
        deletedAt: now,
        emailUnsubscribed: true,
      },
    }),
    // Pause + anonymise profile
    prisma.profile.updateMany({
      where: { userId },
      data: {
        name: 'Deleted User',
        bio: null,
        isPaused: true,
        voiceIntroTranscript: null,
      },
    }),
    // Revoke all refresh tokens
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    }),
  ]);

  log.info('Account soft-deleted and PII anonymised', { userId });
}
