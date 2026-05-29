/**
 * AI-005 — Event Pre-Connection Service.
 *
 * Automatically creates introduction drops for high-compatibility event attendees,
 * connecting them 72 hours before the event.
 *
 * Triggered via BullMQ when an event reaches 10+ RSVPs or approaches within 72h.
 * No admin approval required — drops are created as SCHEDULED immediately.
 */
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';

const log = createChildLogger({ module: 'ai:event-preconnect' });

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum match score to pair two attendees. */
const MIN_MATCH_SCORE = 70;

/** Minimum qualifying pairs required to create a drop. */
const MIN_PAIRS_REQUIRED = 4;

/** Hours before the event the introduction drop is released. */
const PRE_CONNECT_HOURS = 72;

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generates pre-connection introduction drops for attendees of a given event.
 *
 * Finds cross-gender pairs with match score ≥ 70, excluding already introduced /
 * connected / blocked pairs. Creates SCHEDULED IntroductionDrop + individual
 * Introduction rows (one per direction).
 *
 * Skips silently if fewer than MIN_PAIRS_REQUIRED qualify.
 */
export async function generateEventPreConnections(eventId: string): Promise<void> {
  log.info('generateEventPreConnections — start', { eventId });

  // Fetch the event (schema: title, startAt)
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, startAt: true, groupId: true },
  });

  if (!event) {
    log.warn('generateEventPreConnections — event not found', { eventId });
    return;
  }

  // Fetch attendees (schema: EventRsvp, not EventAttendee)
  const rsvps = await prisma.eventRsvp.findMany({
    where: { eventId },
    select: {
      userId: true,
      user: { select: { profile: { select: { gender: true } } } },
    },
  });

  if (rsvps.length < 4) {
    log.info('generateEventPreConnections — not enough attendees', {
      eventId,
      count: rsvps.length,
    });
    return;
  }

  // Separate by gender
  const males = rsvps
    .filter((r) => r.user.profile?.gender === 'MALE')
    .map((r) => r.userId);
  const females = rsvps
    .filter((r) => r.user.profile?.gender === 'FEMALE')
    .map((r) => r.userId);

  const allUserIds = rsvps.map((r) => r.userId);

  // Fetch existing introductions between attendees
  const existingIntros = await prisma.introduction.findMany({
    where: {
      OR: [
        { userAId: { in: allUserIds }, userBId: { in: allUserIds } },
      ],
    },
    select: { userAId: true, userBId: true },
  });
  const introSet = new Set(existingIntros.map((i) => `${i.userAId}:${i.userBId}`));

  // Fetch existing blocks (schema: UserBlock, not Block)
  const existingBlocks = await prisma.userBlock.findMany({
    where: {
      OR: [
        { blockerId: { in: allUserIds }, blockedId: { in: allUserIds } },
      ],
    },
    select: { blockerId: true, blockedId: true },
  });
  const blockSet = new Set(existingBlocks.map((b) => `${b.blockerId}:${b.blockedId}`));

  // Fetch relevant match scores
  const matchScores = await prisma.matchScore.findMany({
    where: {
      OR: [
        { userAId: { in: males }, userBId: { in: females } },
        { userAId: { in: females }, userBId: { in: males } },
      ],
      totalScore: { gte: MIN_MATCH_SCORE },
    },
    select: { userAId: true, userBId: true, totalScore: true },
  });

  // Filter to qualifying pairs
  interface Pair { userAId: string; userBId: string; totalScore: number }
  const qualifyingPairs: Pair[] = [];

  for (const score of matchScores) {
    const key1 = `${score.userAId}:${score.userBId}`;
    const key2 = `${score.userBId}:${score.userAId}`;
    const blocked = blockSet.has(key1) || blockSet.has(key2);
    const introduced = introSet.has(key1) || introSet.has(key2);
    if (!blocked && !introduced) {
      qualifyingPairs.push({ userAId: score.userAId, userBId: score.userBId, totalScore: score.totalScore });
    }
  }

  if (qualifyingPairs.length < MIN_PAIRS_REQUIRED) {
    log.info('generateEventPreConnections — not enough qualifying pairs', {
      eventId,
      pairs: qualifyingPairs.length,
    });
    return;
  }

  // Calculate release time (72h before event start)
  const releaseAt = new Date(event.startAt.getTime() - PRE_CONNECT_HOURS * 60 * 60 * 1000);
  const expiresAt = event.startAt;

  // Create the IntroductionDrop (SCHEDULED — no admin approval needed)
  const memberPool = [...new Set(qualifyingPairs.flatMap((p) => [p.userAId, p.userBId]))];

  const drop = await prisma.introductionDrop.create({
    data: {
      name: `Meet someone attending ${event.title}`,
      criteria: { eventId, type: 'event_preconnect', minMatchScore: MIN_MATCH_SCORE },
      memberPool,
      releaseAt,
      expiresAt,
      status: 'SCHEDULED',
      proposedByAI: true,
    },
  });

  // Create individual Introduction rows (both directions)
  const introData = qualifyingPairs.flatMap((pair) => [
    {
      dropId: drop.id,
      userAId: pair.userAId,
      userBId: pair.userBId,
      expiresAt,
      status: 'PENDING' as const,
    },
    {
      dropId: drop.id,
      userAId: pair.userBId,
      userBId: pair.userAId,
      expiresAt,
      status: 'PENDING' as const,
    },
  ]);

  await prisma.introduction.createMany({ data: introData, skipDuplicates: true });

  log.info('generateEventPreConnections — drop created', {
    eventId,
    dropId: drop.id,
    pairCount: qualifyingPairs.length,
    introCount: introData.length,
    releaseAt: releaseAt.toISOString(),
  });
}
