/**
 * ADMIN-015 — Seeder monitoring service.
 * Returns seeded record counts per entity; flush runs a Prisma transaction.
 * No HTTP call to the seeder app — reads/writes DB directly.
 */
import { getPrismaClient } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';

const log = createChildLogger({ module: 'gateway:seeder-monitoring' });

export interface SeederStatusDto {
  seededCounts: {
    users: number;
    profiles: number;
    groups: number;
    groupPosts: number;
    groupMemberships: number;
    connections: number;
    introductions: number;
    habitLogs: number;
    promptResponses: number;
    savedProfiles: number;
    eventRsvps: number;
  };
}

export interface SeederFlushResult {
  deleted: Record<string, number>;
}

// ─── getSeederStatus ─────────────────────────────────────────────────────────

export async function getSeederStatus(): Promise<SeederStatusDto> {
  const prisma = getPrismaClient();

  const [
    users, profiles, groups, groupPosts,
    groupMemberships, connections, introductions,
    habitLogs, promptResponses, savedProfiles, eventRsvps,
  ] = await Promise.all([
    prisma.user.count({ where: { isSeeded: true } }),
    prisma.profile.count({ where: { isSeeded: true } }),
    prisma.group.count({ where: { isSeeded: true } }),
    prisma.groupPost.count({ where: { isSeeded: true } }),
    prisma.groupMember.count({ where: { user: { isSeeded: true } } }),
    prisma.connection.count({ where: { requester: { isSeeded: true } } }),
    prisma.introduction.count({ where: { userA: { isSeeded: true } } }),
    prisma.habitLog.count({ where: { user: { isSeeded: true } } }),
    prisma.promptResponse.count({ where: { user: { isSeeded: true } } }),
    prisma.savedProfile.count({ where: { user: { isSeeded: true } } }),
    prisma.eventRsvp.count({ where: { user: { isSeeded: true } } }),
  ]);

  return {
    seededCounts: {
      users,
      profiles,
      groups,
      groupPosts,
      groupMemberships,
      connections,
      introductions,
      habitLogs,
      promptResponses,
      savedProfiles,
      eventRsvps,
    },
  };
}

// ─── flushAllSeeded ──────────────────────────────────────────────────────────

export async function flushAllSeeded(): Promise<SeederFlushResult> {
  const prisma = getPrismaClient();
  log.info('Seeded data flush started');

  // Delete in dependency order (children first)
  const [
    habitLogs, promptResonates, promptResponses,
    likes, comments, posts, eventRsvps,
    savedProfiles, connections, introductions,
    groupMemberships, userBlocks, media,
    storyAnswers, realLifeAnswers, matchScores,
    profileEmbeddings, profiles, groups, users,
  ] = await prisma.$transaction([
    prisma.habitLog.deleteMany({ where: { user: { isSeeded: true } } }),
    prisma.promptResonate.deleteMany({ where: { user: { isSeeded: true } } }),
    prisma.promptResponse.deleteMany({ where: { user: { isSeeded: true } } }),
    prisma.groupPostLike.deleteMany({ where: { user: { isSeeded: true } } }),
    prisma.groupPostComment.deleteMany({ where: { user: { isSeeded: true } } }),
    prisma.groupPost.deleteMany({ where: { isSeeded: true } }),
    prisma.eventRsvp.deleteMany({ where: { user: { isSeeded: true } } }),
    prisma.savedProfile.deleteMany({ where: { OR: [{ user: { isSeeded: true } }, { targetUser: { isSeeded: true } }] } }),
    prisma.connection.deleteMany({ where: { requester: { isSeeded: true } } }),
    prisma.introduction.deleteMany({ where: { userA: { isSeeded: true } } }),
    prisma.groupMember.deleteMany({ where: { user: { isSeeded: true } } }),
    prisma.userBlock.deleteMany({ where: { blocker: { isSeeded: true } } }),
    prisma.media.deleteMany({ where: { user: { isSeeded: true } } }),
    prisma.storyPromptAnswer.deleteMany({ where: { user: { isSeeded: true } } }),
    prisma.realLifeAnswer.deleteMany({ where: { user: { isSeeded: true } } }),
    prisma.matchScore.deleteMany({ where: { userA: { isSeeded: true } } }),
    prisma.profileEmbedding.deleteMany({ where: { user: { isSeeded: true } } }),
    prisma.profile.deleteMany({ where: { isSeeded: true } }),
    prisma.group.deleteMany({ where: { isSeeded: true } }),
    prisma.user.deleteMany({ where: { isSeeded: true } }),
  ]);

  const result: SeederFlushResult = {
    deleted: {
      habitLogs: habitLogs.count,
      promptResponses: promptResponses.count,
      promptResonates: promptResonates.count,
      groupPostLikes: likes.count,
      groupPostComments: comments.count,
      groupPosts: posts.count,
      eventRsvps: eventRsvps.count,
      savedProfiles: savedProfiles.count,
      connections: connections.count,
      introductions: introductions.count,
      groupMemberships: groupMemberships.count,
      userBlocks: userBlocks.count,
      media: media.count,
      storyAnswers: storyAnswers.count,
      realLifeAnswers: realLifeAnswers.count,
      matchScores: matchScores.count,
      profileEmbeddings: profileEmbeddings.count,
      profiles: profiles.count,
      groups: groups.count,
      users: users.count,
    },
  };

  log.info('Seeded data flush complete', { deleted: result.deleted });
  return result;
}
