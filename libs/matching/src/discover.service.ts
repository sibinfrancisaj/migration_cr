import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { UserRole, MediaType } from '@abroad-matrimony/shared';
import type { DiscoveryFeedDto, DiscoveryItemDto, ScoreBreakdown, VerificationStatus } from '@abroad-matrimony/shared';
import { ALGORITHM_VERSION } from './match-score.service.js';

const log = createChildLogger({ module: 'matching:discover' });

// ── Cursor helpers ─────────────────────────────────────────────────────────────

interface CursorData {
  score: number;
  id: string;
}

/**
 * Encodes a cursor as a base64url JSON blob.
 * Uses composite (score, id) so pagination is stable when multiple rows share
 * the same totalScore.
 */
export function encodeCursor(data: CursorData): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

/**
 * Decodes a cursor produced by `encodeCursor`.
 * Returns `null` for any malformed input — caller should treat as "no cursor".
 */
export function decodeCursor(cursor: string): CursorData | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8')) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'score' in parsed &&
      'id' in parsed &&
      typeof (parsed as CursorData).score === 'number' &&
      typeof (parsed as CursorData).id === 'string'
    ) {
      return parsed as CursorData;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Age helper ─────────────────────────────────────────────────────────────────

/**
 * Returns whole years elapsed since `dob`.
 * Exported for unit tests.
 */
export function computeAge(dob: Date, now = new Date()): number {
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface DiscoverOptions {
  /** base64url-encoded cursor from a previous response */
  cursor?: string;
  /** Number of items to return (default: 20) */
  limit?: number;
  /** Algorithm version to filter by (default: ALGORITHM_VERSION 'v1') */
  algorithmVersion?: string;
}

/**
 * Returns a paginated discovery feed for `userId`.
 *
 * Ordering: highest compatibility score first (stable via composite sort on
 * `totalScore DESC, id ASC`).
 *
 * Filters applied:
 * - Excludes suspended users
 * - Excludes users already connected (any status) to avoid showing
 *   pending/accepted connections in the feed
 *
 * @param userId          - The requesting user
 * @param options         - Pagination + algorithm version
 * @returns               - Items + nextCursor for the next page
 */
export async function getDiscoveryFeed(
  userId: string,
  options: DiscoverOptions = {},
): Promise<DiscoveryFeedDto> {
  const {
    limit = 20,
    algorithmVersion = ALGORITHM_VERSION,
  } = options;

  const cursorData = options.cursor ? decodeCursor(options.cursor) : null;

  // ── 1. Fetch score rows (keyset pagination on totalScore DESC, id ASC) ───────
  const scoreRows = await prisma.matchScore.findMany({
    where: {
      AND: [
        { OR: [{ userAId: userId }, { userBId: userId }] },
        { algorithmV: algorithmVersion },
        ...(cursorData
          ? [
              {
                OR: [
                  { totalScore: { lt: cursorData.score } },
                  {
                    AND: [
                      { totalScore: cursorData.score },
                      { id: { gt: cursorData.id } },
                    ],
                  },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: [{ totalScore: 'desc' }, { id: 'asc' }],
    take: limit + 1,          // fetch one extra to detect hasMore
    select: {
      id:         true,
      userAId:    true,
      userBId:    true,
      totalScore: true,
      breakdown:  true,
    },
  });

  const hasMore = scoreRows.length > limit;
  const rows    = hasMore ? scoreRows.slice(0, limit) : scoreRows;

  if (rows.length === 0) {
    return { items: [], nextCursor: null, hasMore: false };
  }

  // ── 2. Resolve the "other" user ID in each score pair ─────────────────────
  const otherUserIds = rows.map(r => (r.userAId === userId ? r.userBId : r.userAId));

  // ── 3. Batch-fetch roles — filter out suspended users ─────────────────────
  const users = await prisma.user.findMany({
    where:  { id: { in: otherUserIds } },
    select: { id: true, role: true },
  });
  const activeUserIds = new Set(
    users
      .filter(u => u.role !== UserRole.SUSPENDED)
      .map(u => u.id),
  );

  // ── 4. Batch-fetch connections — filter out already-connected users ────────
  const connections = await prisma.connection.findMany({
    where: {
      OR: [
        { senderId: userId,   receiverId: { in: otherUserIds } },
        { senderId: { in: otherUserIds }, receiverId: userId },
      ],
    },
    select: { senderId: true, receiverId: true },
  });
  const connectedUserIds = new Set(
    connections.map(c => (c.senderId === userId ? c.receiverId : c.senderId)),
  );

  // ── 5. Final eligible user IDs (preserves score order) ────────────────────
  const eligibleIds = otherUserIds.filter(
    id => activeUserIds.has(id) && !connectedUserIds.has(id),
  );

  if (eligibleIds.length === 0) {
    const lastRow    = rows[rows.length - 1];
    const nextCursor = hasMore
      ? encodeCursor({ score: lastRow.totalScore, id: lastRow.id })
      : null;
    return { items: [], nextCursor, hasMore };
  }

  // ── 6. Batch-fetch profiles ────────────────────────────────────────────────
  const profiles = await prisma.profile.findMany({
    where:  { userId: { in: eligibleIds } },
    select: {
      userId:            true,
      name:              true,
      dateOfBirth:       true,
      currentCity:       true,
      currentCountry:    true,
      settlementIntent:  true,
      completionScore:   true,
      verificationStatus: true,
    },
  });
  const profileMap = new Map(profiles.map(p => [p.userId, p]));

  // ── 7. Batch-fetch first photo per eligible user ───────────────────────────
  const photos = await prisma.media.findMany({
    where:   { userId: { in: eligibleIds }, type: MediaType.PHOTO },
    orderBy: [{ userId: 'asc' }, { order: 'asc' }, { createdAt: 'asc' }],
    select:  { userId: true, url: true, order: true },
  });
  const photoMap = new Map<string, string>();
  for (const photo of photos) {
    if (!photoMap.has(photo.userId)) {
      photoMap.set(photo.userId, photo.url);
    }
  }

  // ── 8. Assemble DTOs (preserve score ordering) ────────────────────────────
  const items: DiscoveryItemDto[] = [];
  for (const row of rows) {
    const otherId = row.userAId === userId ? row.userBId : row.userAId;
    if (!eligibleIds.includes(otherId)) continue;

    const profile = profileMap.get(otherId);
    if (!profile) continue;

    items.push({
      userId:            otherId,
      name:              profile.name,
      age:               computeAge(profile.dateOfBirth),
      currentCity:       profile.currentCity,
      currentCountry:    profile.currentCountry,
      settlementIntent:  profile.settlementIntent,
      completionScore:   profile.completionScore,
      verificationStatus: profile.verificationStatus as unknown as VerificationStatus,
      photoUrl:          photoMap.get(otherId),
      totalScore:        row.totalScore,
      scoreBreakdown:    row.breakdown as unknown as ScoreBreakdown,
    });
  }

  const lastRow    = rows[rows.length - 1];
  const nextCursor = hasMore
    ? encodeCursor({ score: lastRow.totalScore, id: lastRow.id })
    : null;

  log.info('Discovery feed fetched', {
    userId,
    algorithmVersion,
    itemCount: items.length,
    hasMore,
  });

  return { items, nextCursor, hasMore };
}
