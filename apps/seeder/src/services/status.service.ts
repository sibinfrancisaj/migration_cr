/**
 * SEED-008 — Seeder status service.
 * Aggregates live counts of seeded records from DB and in-memory state.
 */
import { getPrismaClient } from '@abroad-matrimony/db';
import { getState } from '../lib/seeder-state.js';
import { seederLog } from '../lib/seeder-logger.js';

export interface SeederStatus {
  running: boolean;
  dripPaused: boolean;
  lastRunAt: string | null;
  lastDripAt: string | null;
  lastMatchRecomputeAt: string | null;
  totalSeededUsers: number;
  totalSeededProfiles: number;
  totalSeededGroups: number;
  totalSeededPosts: number;
  totalSeededConnections: number;
}

export async function getSeederStatus(): Promise<SeederStatus> {
  const state = getState();
  const prisma = getPrismaClient();

  try {
    const [users, profiles, connections] = await Promise.all([
      prisma.user.count({ where: { isSeeded: true } }),
      prisma.profile.count({ where: { user: { isSeeded: true } } }),
      prisma.connection.count({
        where: { requester: { isSeeded: true } },
      }),
    ]);

    // Group and post counts — best-effort
    let groups = 0;
    let posts = 0;
    try {
      [groups, posts] = await Promise.all([
        prisma.group.count({ where: { isSeeded: true } }),
        prisma.groupPost.count({ where: { isSeeded: true } }),
      ]);
    } catch {
      seederLog.warn('Could not count seeded groups/posts — fields may not exist yet');
    }

    return {
      running: state.running,
      dripPaused: state.dripPaused,
      lastRunAt: state.lastRunAt?.toISOString() ?? null,
      lastDripAt: state.lastDripAt?.toISOString() ?? null,
      lastMatchRecomputeAt: state.lastMatchRecomputeAt?.toISOString() ?? null,
      totalSeededUsers: users,
      totalSeededProfiles: profiles,
      totalSeededGroups: groups,
      totalSeededPosts: posts,
      totalSeededConnections: connections,
    };
  } catch (err) {
    seederLog.error('Failed to get seeder status', { err });
    return {
      running: state.running,
      dripPaused: state.dripPaused,
      lastRunAt: state.lastRunAt?.toISOString() ?? null,
      lastDripAt: state.lastDripAt?.toISOString() ?? null,
      lastMatchRecomputeAt: state.lastMatchRecomputeAt?.toISOString() ?? null,
      totalSeededUsers: 0,
      totalSeededProfiles: 0,
      totalSeededGroups: 0,
      totalSeededPosts: 0,
      totalSeededConnections: 0,
    };
  }
}
