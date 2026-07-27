/**
 * SEED-008 — Seeder status service.
 * Aggregates live counts of seeded records from DB and in-memory state.
 */
import { getPrismaClient } from '@abroad-matrimony/db';
import { getState, type SocialLoopSnapshot, type DripSnapshot } from '../lib/seeder-state.js';
import { seederLog } from '../lib/seeder-logger.js';

export interface SeederStatus {
  running: boolean;
  activityRunning: boolean;
  dripPaused: boolean;
  activityPaused: boolean;
  lastRunAt: string | null;
  lastDripAt: string | null;
  lastMatchRecomputeAt: string | null;
  lastActivityAt: string | null;
  totalProfilesCreated: number;
  totalSeededUsers: number;
  totalSeededProfiles: number;
  totalSeededGroups: number;
  totalSeededPosts: number;
  totalSeededConnections: number;
  lastSocialLoop: SocialLoopSnapshot | null;
  lastDrip: DripSnapshot | null;
  socialLoopHistory: SocialLoopSnapshot[];
  dripHistory: DripSnapshot[];
}

export async function getSeederStatus(): Promise<SeederStatus> {
  const state = getState();
  const prisma = getPrismaClient();

  try {
    const [users, profiles, connections] = await Promise.all([
      prisma.user.count({ where: { isSeeded: true } }),
      prisma.profile.count({ where: { user: { isSeeded: true } } }),
      prisma.connection.count({ where: { requester: { isSeeded: true } } }),
    ]);

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

    return buildStatus(state, { users, profiles, connections, groups, posts });
  } catch (err) {
    seederLog.error('Failed to get seeder status', { err });
    return buildStatus(state, { users: 0, profiles: 0, connections: 0, groups: 0, posts: 0 });
  }
}

function buildStatus(
  state: ReturnType<typeof getState>,
  counts: { users: number; profiles: number; connections: number; groups: number; posts: number },
): SeederStatus {
  return {
    running: state.running,
    activityRunning: state.activityRunning,
    dripPaused: state.dripPaused,
    activityPaused: state.activityPaused,
    lastRunAt: state.lastRunAt?.toISOString() ?? null,
    lastDripAt: state.lastDripAt?.toISOString() ?? null,
    lastMatchRecomputeAt: state.lastMatchRecomputeAt?.toISOString() ?? null,
    lastActivityAt: state.lastActivityAt?.toISOString() ?? null,
    totalProfilesCreated: state.totalProfilesCreated,
    totalSeededUsers: counts.users,
    totalSeededProfiles: counts.profiles,
    totalSeededGroups: counts.groups,
    totalSeededPosts: counts.posts,
    totalSeededConnections: counts.connections,
    lastSocialLoop: state.lastSocialLoop,
    lastDrip: state.lastDrip,
    socialLoopHistory: state.socialLoopHistory,
    dripHistory: state.dripHistory,
  };
}
