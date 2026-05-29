/**
 * SEED-008 — Flush service.
 *
 * Deletes ALL records where isSeeded = true across all seeded tables,
 * in dependency order (children before parents) so FK constraints don't block.
 * Runs in a Prisma transaction.
 */
import { getPrismaClient } from '@abroad-matrimony/db';
import { seederLog } from '../lib/seeder-logger.js';
import { getState } from '../lib/seeder-state.js';

export interface FlushResult {
  deleted: {
    groupPostLikes: number;
    groupPostComments: number;
    groupPosts: number;
    groupMemberships: number;
    introductions: number;
    eventAttendees: number;
    habitLogs: number;
    promptResponses: number;
    savedProfiles: number;
    connections: number;
    flags: number;
    profileMedia: number;
    realLifeAnswers: number;
    storyPrompts: number;
    profiles: number;
    devices: number;
    users: number;
  };
  durationMs: number;
}

export async function flushAllSeededData(): Promise<FlushResult> {
  if (getState().running) {
    throw new Error('Cannot flush while a seeder job is running');
  }

  const prisma = getPrismaClient();
  const start = Date.now();

  seederLog.warn('FLUSH: Deleting all seeded data — this is irreversible');

  // Find all seeded user IDs first
  const seededUsers = await prisma.user.findMany({
    where: { isSeeded: true },
    select: { id: true },
  });
  const seededUserIds = seededUsers.map((u) => u.id);

  if (seededUserIds.length === 0) {
    return {
      deleted: {
        groupPostLikes: 0, groupPostComments: 0, groupPosts: 0, groupMemberships: 0,
        introductions: 0, eventAttendees: 0, habitLogs: 0, promptResponses: 0,
        savedProfiles: 0, connections: 0, flags: 0, profileMedia: 0,
        realLifeAnswers: 0, storyPrompts: 0, profiles: 0, devices: 0, users: 0,
      },
      durationMs: Date.now() - start,
    };
  }

  // Execute deletions in dependency order (leaves first, roots last)
  const [
    groupPostLikes,
    groupPostComments,
    groupPosts,
    groupMemberships,
    introductions,
    eventAttendees,
    habitLogs,
    promptResponses,
    savedProfiles,
    connections,
    flags,
    profileMedia,
    realLifeAnswers,
    storyPrompts,
    profiles,
    devices,
    users,
  ] = await prisma.$transaction([
    // Group social feed
    prisma.groupPostLike.deleteMany({ where: { userId: { in: seededUserIds } } }),
    prisma.groupPostComment.deleteMany({ where: { authorId: { in: seededUserIds } } }),
    prisma.groupPost.deleteMany({ where: { authorId: { in: seededUserIds } } }),
    prisma.groupMembership.deleteMany({ where: { userId: { in: seededUserIds } } }),
    // Introductions
    prisma.introduction.deleteMany({
      where: { OR: [{ userAId: { in: seededUserIds } }, { userBId: { in: seededUserIds } }] },
    }),
    // Events
    prisma.eventAttendee.deleteMany({ where: { userId: { in: seededUserIds } } }),
    // Habits
    prisma.habitLog.deleteMany({ where: { userId: { in: seededUserIds } } }),
    // Prompts
    prisma.promptResponse.deleteMany({ where: { userId: { in: seededUserIds } } }),
    // Saved profiles
    prisma.savedProfile.deleteMany({
      where: { OR: [{ userId: { in: seededUserIds } }, { targetUserId: { in: seededUserIds } }] },
    }),
    // Connections
    prisma.connection.deleteMany({
      where: { OR: [{ requesterId: { in: seededUserIds } }, { recipientId: { in: seededUserIds } }] },
    }),
    // Flags
    prisma.flag.deleteMany({ where: { reporterId: { in: seededUserIds } } }),
    // Media
    prisma.profileMedia.deleteMany({ where: { userId: { in: seededUserIds } } }),
    // Profile content
    prisma.realLifeAnswer.deleteMany({ where: { userId: { in: seededUserIds } } }),
    prisma.storyPromptAnswer.deleteMany({ where: { userId: { in: seededUserIds } } }),
    // Core entities (order matters — profile before user)
    prisma.profile.deleteMany({ where: { userId: { in: seededUserIds } } }),
    prisma.device.deleteMany({ where: { userId: { in: seededUserIds } } }),
    prisma.user.deleteMany({ where: { id: { in: seededUserIds } } }),
  ]);

  const result: FlushResult = {
    deleted: {
      groupPostLikes: groupPostLikes.count,
      groupPostComments: groupPostComments.count,
      groupPosts: groupPosts.count,
      groupMemberships: groupMemberships.count,
      introductions: introductions.count,
      eventAttendees: eventAttendees.count,
      habitLogs: habitLogs.count,
      promptResponses: promptResponses.count,
      savedProfiles: savedProfiles.count,
      connections: connections.count,
      flags: flags.count,
      profileMedia: profileMedia.count,
      realLifeAnswers: realLifeAnswers.count,
      storyPrompts: storyPrompts.count,
      profiles: profiles.count,
      devices: devices.count,
      users: users.count,
    },
    durationMs: Date.now() - start,
  };

  seederLog.warn('FLUSH complete', { deleted: result.deleted, durationMs: result.durationMs });
  return result;
}
