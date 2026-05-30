/**
 * GRP-R-007 — System group seeding service.
 *
 * Creates the initial set of system groups (REGIONAL, CULTURAL, PROFESSIONAL,
 * INTEREST) that seeded user profiles auto-join on registration.
 *
 * Rules:
 *   - Idempotent: uses upsert-by-name so repeated calls are safe.
 *   - System groups have isSeeded: false — they are NOT flushed by flush.service.ts.
 *   - Called once before the profile drip starts in seed.controller.ts.
 */
import { getPrismaClient } from '@abroad-matrimony/db';
import { seederLog } from '../lib/seeder-logger.js';
import { ALL_SYSTEM_GROUPS, type GroupSeedDef } from '../data/groups.data.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GroupSeedResult {
  created: number;
  existing: number;
  total: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

export async function seedSystemGroups(): Promise<GroupSeedResult> {
  const prisma = getPrismaClient();
  let created = 0;
  let existing = 0;

  seederLog.info('seedSystemGroups — starting', { total: ALL_SYSTEM_GROUPS.length });

  for (const def of ALL_SYSTEM_GROUPS) {
    try {
      const found = await prisma.group.findFirst({
        where: { name: def.name },
        select: { id: true },
      });

      if (found) {
        existing++;
        seederLog.debug('seedSystemGroups — already exists, skipping', { name: def.name });
        continue;
      }

      await prisma.group.create({
        data: buildGroupData(def),
      });

      created++;
      seederLog.debug('seedSystemGroups — created', { name: def.name, type: def.type });
    } catch (err) {
      seederLog.warn('seedSystemGroups — failed to create group', { name: def.name, err });
    }
  }

  seederLog.info('seedSystemGroups — complete', { created, existing, total: created + existing });

  return { created, existing, total: created + existing };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildGroupData(def: GroupSeedDef) {
  return {
    name: def.name,
    description: def.description,
    type: def.type as any,
    scope: def.scope as any,
    region: def.region,
    country: def.country ?? null,
    culturalTag: def.culturalTag ?? null,
    professionTag: def.professionTag ?? null,
    capacity: def.capacity,
    maxMembers: def.maxMembers,
    status: 'ACTIVE' as any,
    accessType: 'OPEN' as any,
    isActive: true,
    isSeeded: false,          // System groups are permanent — not flushed with user data
    launchDate: new Date(),
    introDayOfWeek: 0,
    creditCost: 0,
    memberCount: 0,
  };
}
