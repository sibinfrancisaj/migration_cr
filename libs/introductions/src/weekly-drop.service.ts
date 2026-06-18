/**
 * INTRO-001 — Weekly group introduction drop service.
 *
 * `createWeeklyGroupDrops()` is called by the BullMQ Sunday cron job.
 * For each active REGIONAL group with >= 2 members it:
 *   1. Creates an `IntroductionDrop` with status SCHEDULED and the current weekKey.
 *   2. Sets memberPool from the group's active members.
 *   3. Fires `generatePairingsForDrop()` (async, fire-and-forget) to produce
 *      `Introduction` records inside the drop.
 *
 * Weekly drops are auto-approved (no admin review required) — they differ from
 * admin-proposed drops which follow the DRAFT → PENDING_APPROVAL → SCHEDULED flow.
 */

import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { getWeekKey } from './index.js';
import { generatePairingsForDrop } from './pairing.service.js';

const log = createChildLogger({ module: 'introductions:weekly-drop' });

export interface WeeklyDropResult {
  created:   number;   // new drops created
  skipped:   number;   // groups skipped (too few members / already has drop this week)
  groupIds:  string[]; // IDs of groups that got a new drop
}

/**
 * Creates one scheduled IntroductionDrop per active REGIONAL group that has
 * >= 2 members and has not already received a drop this week.
 *
 * Fires pairing generation asynchronously after each drop is created so the
 * Sunday job doesn't block waiting for AI scoring.
 */
export async function createWeeklyGroupDrops(
  now: Date = new Date(),
): Promise<WeeklyDropResult> {
  const weekKey = getWeekKey(now);
  log.info('createWeeklyGroupDrops — start', { weekKey });

  // Find all REGIONAL groups with active members
  const groups = await prisma.group.findMany({
    where: { type: 'REGIONAL', status: 'ACTIVE' },
    select: {
      id:          true,
      name:        true,
      country:     true,
      _count:      { select: { members: { where: { status: 'ACTIVE' } } } },
    },
  });

  let created = 0;
  let skipped = 0;
  const groupIds: string[] = [];

  for (const group of groups) {
    // Need at least 2 members to generate any pairings
    if (group._count.members < 2) {
      log.debug('createWeeklyGroupDrops — skipping group (too few members)', {
        groupId: group.id,
        memberCount: group._count.members,
      });
      skipped++;
      continue;
    }

    // Idempotent — skip if a drop already exists for this group this week
    const existing = await prisma.introductionDrop.findFirst({
      where: { weekKey, criteria: { path: ['groupId'], equals: group.id } },
      select: { id: true },
    });
    if (existing) {
      log.debug('createWeeklyGroupDrops — skipping group (drop already exists)', {
        groupId: group.id, weekKey,
      });
      skipped++;
      continue;
    }

    // Fetch active member IDs for this group
    const members = await prisma.groupMember.findMany({
      where:  { groupId: group.id, status: 'ACTIVE' },
      select: { userId: true },
    });
    const memberPool = members.map(m => m.userId);

    // Create the drop (auto-approved, status SCHEDULED)
    // releaseAt = Sunday at 09:00 UTC (this week's Sunday)
    const releaseAt = getThisSundayAt9(now);
    const expiresAt = new Date(releaseAt.getTime() + 7 * 24 * 3600 * 1000); // +7 days

    const drop = await prisma.introductionDrop.create({
      data: {
        name:        `Weekly Drop — ${group.name} — ${weekKey}`,
        criteria:    { groupId: group.id, country: group.country, weekKey },
        memberPool,
        weekKey,
        releaseAt,
        expiresAt,
        status:      'SCHEDULED',
        proposedByAI: false,
        earlyAccessCost: 10,
        unlockCost:      25,
      },
    });

    log.info('createWeeklyGroupDrops — drop created', {
      dropId:    drop.id,
      groupId:   group.id,
      weekKey,
      memberCount: memberPool.length,
    });

    groupIds.push(group.id);
    created++;

    // Fire pairing generation asynchronously — errors are logged but don't fail the job
    generatePairingsForDrop(drop.id).catch((err) => {
      log.error('createWeeklyGroupDrops — pairing generation failed', {
        dropId: drop.id, err,
      });
    });
  }

  log.info('createWeeklyGroupDrops — complete', { weekKey, created, skipped });
  return { created, skipped, groupIds };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the upcoming (or current) Sunday at 09:00 UTC for the given date.
 * If today IS Sunday and before 09:00, returns today at 09:00 UTC.
 */
function getThisSundayAt9(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 9, 0, 0, 0));
  const dayOfWeek = d.getUTCDay(); // 0 = Sunday
  if (dayOfWeek === 0 && now.getUTCHours() < 9) return d; // today before 9 AM
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
  d.setUTCDate(d.getUTCDate() + daysUntilSunday);
  return d;
}
