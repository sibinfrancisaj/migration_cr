/**
 * Proactive bot actions — the bot initiates new social activity.
 * These run AFTER reactive actions in each bot cycle.
 *
 * Each function is self-contained, returns true if the action was taken.
 * The caller decides which actions to attempt based on persona weights.
 */
import type { AxiosInstance } from 'axios';
import type { PrismaClient } from '@prisma/client';
import { seederLog } from '../lib/seeder-logger.js';
import { asUser } from '../lib/gateway-client.js';
import {
  HABIT_KEYS,
  GROUP_POST_TEXTS,
  PROMPT_RESPONSES,
  CONNECTION_MESSAGES,
} from '../data/bot-content.js';

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── 1. Send connection request ────────────────────────────────────────────────

export async function sendConnectionRequest(
  userId: string,
  prisma: PrismaClient,
  client: AxiosInstance,
): Promise<boolean> {
  // Find all users already connected or requested
  const existing = await prisma.connection.findMany({
    where: { OR: [{ requesterId: userId }, { recipientId: userId }] },
    select: { requesterId: true, recipientId: true },
    take: 100,
  });
  const excludedIds = new Set([
    userId,
    ...existing.map((c) => c.requesterId),
    ...existing.map((c) => c.recipientId),
  ]);

  const target = await prisma.user.findFirst({
    where: { isSeeded: true, status: 'ACTIVE', id: { notIn: Array.from(excludedIds) } },
    select: { id: true },
    skip: randomInt(0, 30),
  });
  if (!target) return false;

  const message = randomFrom(CONNECTION_MESSAGES);
  try {
    await client.post(
      '/api/v1/connections',
      { targetUserId: target.id, ...(message ? { message } : {}) },
      asUser(userId),
    );
    seederLog.debug('Bot sent connection request', { userId, targetId: target.id });
    return true;
  } catch {
    return false;
  }
}

// ── 2. Post in group ──────────────────────────────────────────────────────────

export async function postInGroup(
  userId: string,
  prisma: PrismaClient,
  client: AxiosInstance,
): Promise<boolean> {
  // Pick a random group membership (vary by skipping)
  const count = await prisma.groupMembership.count({ where: { userId } });
  if (count === 0) return false;

  const membership = await prisma.groupMembership.findFirst({
    where: { userId },
    select: { groupId: true },
    skip: randomInt(0, Math.max(0, count - 1)),
  });
  if (!membership) return false;

  try {
    await client.post(
      `/api/v1/groups/${membership.groupId}/posts`,
      { content: randomFrom(GROUP_POST_TEXTS) },
      asUser(userId),
    );
    seederLog.debug('Bot posted in group', { userId, groupId: membership.groupId });
    return true;
  } catch {
    return false;
  }
}

// ── 3. Log a habit ───────────────────────────────────────────────────────────

export async function logHabit(
  userId: string,
  prisma: PrismaClient,
  client: AxiosInstance,
): Promise<boolean> {
  const habitKey = randomFrom([...HABIT_KEYS]);

  // Skip if already logged today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const existing = await (prisma as any).habitLog.findFirst({
    where: { userId, habitKey, loggedAt: { gte: today } },
  });
  if (existing) return false;

  try {
    await client.post(`/api/v1/habits/${habitKey}/log`, {}, asUser(userId));
    seederLog.debug('Bot logged habit', { userId, habitKey });
    return true;
  } catch {
    return false;
  }
}

// ── 4. RSVP to upcoming event ─────────────────────────────────────────────────

export async function rsvpToEvent(
  userId: string,
  prisma: PrismaClient,
  client: AxiosInstance,
): Promise<boolean> {
  const event = await (prisma as any).gathering.findFirst({
    where: {
      startsAt: { gte: new Date() },
      attendees: { none: { userId } },
    },
    select: { id: true },
    orderBy: { startsAt: 'asc' },
  });
  if (!event) return false;

  try {
    await client.post(`/api/v1/events/${event.id}/rsvp`, {}, asUser(userId));
    seederLog.debug('Bot RSVPed to event', { userId, eventId: event.id });
    return true;
  } catch {
    return false;
  }
}

// ── 5. Respond to current weekly prompt ──────────────────────────────────────

export async function respondToPrompt(
  userId: string,
  prisma: PrismaClient,
  client: AxiosInstance,
): Promise<boolean> {
  // Find the currently active prompt
  const now = new Date();
  const prompt = await (prisma as any).weeklyPrompt.findFirst({
    where: { activeFrom: { lte: now }, activeTo: { gte: now } },
    select: { id: true },
  });
  if (!prompt) return false;

  // Check if already responded
  const already = await (prisma as any).promptResponse.findFirst({
    where: { promptId: prompt.id, userId },
    select: { id: true },
  });
  if (already) return false;

  try {
    await client.post(
      '/api/v1/prompts/current/response',
      { type: 'TEXT', content: randomFrom(PROMPT_RESPONSES) },
      asUser(userId),
    );
    seederLog.debug('Bot responded to prompt', { userId, promptId: prompt.id });
    return true;
  } catch {
    return false;
  }
}

// ── 6. Log a profile view ────────────────────────────────────────────────────

export async function logProfileView(
  userId: string,
  prisma: PrismaClient,
  client: AxiosInstance,
): Promise<boolean> {
  const target = await prisma.user.findFirst({
    where: { isSeeded: true, status: 'ACTIVE', id: { not: userId } },
    select: { id: true },
    skip: randomInt(0, 50),
  });
  if (!target) return false;

  try {
    await client.post(`/api/v1/profiles/${target.id}/view`, {}, asUser(userId));
    return true;
  } catch {
    return false;
  }
}

// ── 7. Early access for a drop ───────────────────────────────────────────────

export async function earlyAccessDrop(
  userId: string,
  prisma: PrismaClient,
  client: AxiosInstance,
): Promise<boolean> {
  const intro = await (prisma as any).introduction.findFirst({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
      viewedEarlyAt: null,
      drop: { status: { in: ['LIVE', 'SCHEDULED'] } },
    },
    select: { dropId: true },
  });
  if (!intro) return false;

  try {
    await client.post(
      `/api/v1/introductions/drops/${intro.dropId}/early-access`,
      {},
      asUser(userId),
    );
    return true;
  } catch {
    // Insufficient diamonds — non-fatal
    return false;
  }
}
