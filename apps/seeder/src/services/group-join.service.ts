/**
 * SEED-005 — Group auto-join for seeder profiles.
 *
 * After a profile is created, this service joins the correct groups:
 *   - REGIONAL country-level group (joinedVia: AUTO)
 *   - 1–2 cultural groups matching culturalTag (joinedVia: ONBOARDING)
 *   - 1 matching professional group (joinedVia: ONBOARDING)
 *   - 0–2 random INTEREST groups (joinedVia: MANUAL)
 */
import { getPrismaClient } from '@abroad-matrimony/db';
import { seederLog } from '../lib/seeder-logger.js';
import type { SeededProfileResult } from '../factories/profile.factory.js';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function autoJoinGroups(profile: SeededProfileResult): Promise<void> {
  const prisma = getPrismaClient();
  const { userId, country, culturalBackground, profession } = profile;

  try {
    // ── 1. REGIONAL country group (auto) ───────────────────────────────────────
    const regionalGroup = await prisma.group.findFirst({
      where: {
        type: 'REGIONAL' as any,
        country,
        isActive: true,
      },
      select: { id: true },
    });

    if (regionalGroup) {
      await joinGroupSafely(userId, regionalGroup.id, 'AUTO');
    }

    // ── 2. Cultural groups ──────────────────────────────────────────────────────
    const culturalGroups = await prisma.group.findMany({
      where: {
        type: 'CULTURAL' as any,
        culturalTag: { contains: culturalBackground.split(' ')[0] ?? culturalBackground },
        isActive: true,
      },
      take: 2,
      select: { id: true },
    });

    for (const g of culturalGroups) {
      await joinGroupSafely(userId, g.id, 'ONBOARDING');
    }

    // ── 3. Professional group ───────────────────────────────────────────────────
    const professionWord = profession.split(' ')[0] ?? profession;
    const professionalGroup = await prisma.group.findFirst({
      where: {
        type: 'PROFESSIONAL' as any,
        professionTag: { contains: professionWord },
        isActive: true,
      },
      select: { id: true },
    });

    if (professionalGroup) {
      await joinGroupSafely(userId, professionalGroup.id, 'ONBOARDING');
    }

    // ── 4. Random INTEREST groups (0–2) ────────────────────────────────────────
    const interestGroupCount = randomInt(0, 2);
    if (interestGroupCount > 0) {
      const interestGroups = await prisma.group.findMany({
        where: { type: 'INTEREST' as any, isActive: true },
        take: 10,
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      });

      // Shuffle and pick
      const shuffled = interestGroups.sort(() => Math.random() - 0.5);
      for (const g of shuffled.slice(0, interestGroupCount)) {
        await joinGroupSafely(userId, g.id, 'MANUAL');
      }
    }

    seederLog.debug('Group auto-join complete', { userId, country, culturalBackground, profession });
  } catch (err) {
    seederLog.warn('Group auto-join partially failed', { userId, err });
  }
}

async function joinGroupSafely(userId: string, groupId: string, joinedVia: string): Promise<void> {
  const prisma = getPrismaClient();
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.groupMembership.findUnique({
        where: { groupId_userId: { groupId, userId } },
        select: { userId: true },
      });
      if (existing) return;

      await tx.groupMembership.create({
        data: {
          groupId,
          userId,
          joinedVia: joinedVia as any,
          role: 'MEMBER',
        },
      });

      await tx.group.update({
        where: { id: groupId },
        data: { memberCount: { increment: 1 } },
      });
    });
  } catch (err) {
    seederLog.warn('Could not join group', { userId, groupId, joinedVia, err });
  }
}
