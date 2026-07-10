/**
 * SEED-006 — Activity simulator.
 *
 * Picks 10–20 random seeded profiles and has each one perform 1–4 realistic
 * actions via the gateway API. Actions are chosen to avoid validation failures.
 */
import { getPrismaClient } from '@abroad-matrimony/db';
import { seederLog } from '../lib/seeder-logger.js';
import { getGatewayClient, asUser } from '../lib/gateway-client.js';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

type Action = 'send_connection' | 'respond_to_intro' | 'log_habit' | 'post_in_group' | 'save_profile' | 'rsvp_event' | 'early_access_drop' | 'unlock_drop';

const ALL_ACTIONS: Action[] = [
  'send_connection',
  'respond_to_intro',
  'log_habit',
  'post_in_group',
  'save_profile',
  'rsvp_event',
  'early_access_drop',
  'unlock_drop',
];

const GROUP_POST_TEXTS = [
  'Has anyone else been following the news from back home this week? Interesting times.',
  'Good morning everyone! Hope you\'re all having a productive week.',
  'Just tried a new Indian restaurant in the city — surprisingly good dal makhani.',
  'Anyone else attending the community festival next weekend?',
  'Thought I\'d share this article — relevant to many of us living abroad.',
  'Quick check-in: how is everyone managing work-life balance these days?',
  'Sharing a great recipe from my grandmother\'s kitchen. DM if you want it.',
  'Reminder that the group is here for support not just conversations. Feel free to reach out.',
];

export async function runActivitySimulation(): Promise<{ actionsCompleted: number }> {
  const prisma = getPrismaClient();
  const client = getGatewayClient();

  // Pick 10–20 seeded users at random
  const seededUsers = await prisma.user.findMany({
    where: { isSeeded: true, status: 'ACTIVE' },
    select: { id: true },
    take: 20,
    skip: randomInt(0, 50), // Vary which users are active each run
    orderBy: { createdAt: 'desc' },
  });

  const activeUsers = seededUsers.slice(0, randomInt(10, Math.min(20, seededUsers.length)));
  let actionsCompleted = 0;

  for (const user of activeUsers) {
    const actionCount = randomInt(1, 4);
    const actions = Array.from({ length: actionCount }, () => randomFrom(ALL_ACTIONS));

    for (const action of actions) {
      try {
        await performAction(action, user.id, prisma, client);
        actionsCompleted++;
      } catch {
        // Non-fatal — simulator continues even if individual actions fail
      }
    }
  }

  seederLog.info('Activity simulation complete', { activeUsers: activeUsers.length, actionsCompleted });
  return { actionsCompleted };
}

async function performAction(
  action: Action,
  userId: string,
  prisma: ReturnType<typeof getPrismaClient>,
  client: ReturnType<typeof getGatewayClient>,
): Promise<void> {
  switch (action) {
    case 'log_habit': {
      const HABIT_KEYS = ['MORNING_ROUTINE', 'EXERCISE', 'HEALTHY_EATING', 'MEDITATION', 'READING', 'JOURNALING', 'LEARNING', 'FAMILY_TIME', 'SOCIAL_CONNECTION', 'GRATITUDE'];
      const habitKey = randomFrom(HABIT_KEYS);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existing = await prisma.habitLog.findFirst({
        where: { userId, habitKey: habitKey as any, loggedAt: { gte: today } },
      });
      if (existing) break;
      await client.post(`/api/v1/habits/${habitKey}/log`, {}, asUser(userId));
      break;
    }

    case 'post_in_group': {
      // Find a group the user is a member of
      const membership = await prisma.groupMembership.findFirst({
        where: { userId },
        select: { groupId: true },
      });
      if (!membership) break;
      await client.post(
        `/api/v1/groups/${membership.groupId}/posts`,
        { content: randomFrom(GROUP_POST_TEXTS) },
        asUser(userId),
      );
      break;
    }

    case 'send_connection': {
      // Find a seeded user they're not connected to and not themselves
      const existing = await prisma.connection.findMany({
        where: { OR: [{ requesterId: userId }, { recipientId: userId }] },
        select: { requesterId: true, recipientId: true },
        take: 50,
      });
      const connectedIds = new Set([
        userId,
        ...existing.map((c) => c.requesterId),
        ...existing.map((c) => c.recipientId),
      ]);
      const target = await prisma.user.findFirst({
        where: { isSeeded: true, status: 'ACTIVE', id: { notIn: Array.from(connectedIds) } },
        select: { id: true },
      });
      if (!target) break;
      await client.post('/api/v1/connections', { targetUserId: target.id }, asUser(userId));
      break;
    }

    case 'respond_to_intro': {
      // Find a pending introduction
      const intro = await prisma.introduction.findFirst({
        where: {
          status: 'PENDING',
          OR: [{ userAId: userId }, { userBId: userId }],
        },
        select: { id: true },
      });
      if (!intro) break;
      const accept = Math.random() > 0.3; // 70% accept rate
      await client.post(
        `/api/v1/introductions/${intro.id}/${accept ? 'accept' : 'decline'}`,
        {},
        asUser(userId),
      );
      break;
    }

    case 'save_profile': {
      // Save a random seeded profile
      const target = await prisma.user.findFirst({
        where: { isSeeded: true, id: { not: userId } },
        select: { id: true },
        skip: randomInt(0, 20),
      });
      if (!target) break;
      await client.post('/api/v1/saved', { savedUserId: target.id }, asUser(userId)).catch(() => {
        // Already saved is fine
      });
      break;
    }

    case 'rsvp_event': {
      // RSVP to an upcoming event
      const event = await prisma.gathering.findFirst({
        where: { startsAt: { gte: new Date() } },
        select: { id: true },
        orderBy: { startsAt: 'asc' },
      });
      if (!event) break;
      await client.post(`/api/v1/events/${event.id}/rsvp`, {}, asUser(userId)).catch(() => {
        // Already RSVPed is fine
      });
      break;
    }

    case 'early_access_drop': {
      // Find a LIVE or SCHEDULED drop the user has curated intros in
      const intro = await prisma.introduction.findFirst({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
          drop: { status: { in: ['LIVE', 'SCHEDULED'] } },
        },
        select: { dropId: true },
      });
      if (!intro) break;
      // Non-fatal — user may lack sufficient diamonds
      await client.post(
        `/api/v1/introductions/drops/${intro.dropId}/early-access`,
        {},
        asUser(userId),
      ).catch(() => { /* insufficient diamonds is fine */ });
      break;
    }

    case 'unlock_drop': {
      // Find a drop the user has already early-accessed (viewedEarlyAt set)
      const earlyIntro = await prisma.introduction.findFirst({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
          viewedEarlyAt: { not: null },
          unlockedEarlyAt: null, // Not yet fully unlocked
          drop: { status: { in: ['LIVE', 'SCHEDULED'] } },
        },
        select: { dropId: true },
      });
      if (!earlyIntro) break;
      // Non-fatal — user may lack sufficient diamonds
      await client.post(
        `/api/v1/introductions/drops/${earlyIntro.dropId}/unlock`,
        {},
        asUser(userId),
      ).catch(() => { /* insufficient diamonds is fine */ });
      break;
    }
  }
}
