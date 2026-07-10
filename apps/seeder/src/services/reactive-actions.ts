/**
 * Reactive bot actions — the bot responds to things others did TO it.
 * These always run first in each bot cycle, before any proactive actions.
 *
 * Order of priority:
 *   1. Accept/decline incoming connection requests
 *   2. Accept/decline pending introductions
 *   3. Like (and optionally comment on) recent group posts
 *   4. Resonate with current weekly prompt responses
 */
import type { AxiosInstance } from 'axios';
import type { PrismaClient } from '@prisma/client';
import { seederLog } from '../lib/seeder-logger.js';
import { asUser } from '../lib/gateway-client.js';
import type { BotPersona } from '../lib/bot-state.js';
import { COMMENT_TEXTS } from '../data/bot-content.js';

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export interface ReactiveResult {
  connectionsHandled: number;
  introsHandled: number;
  postsLiked: number;
  commentsAdded: number;
  responsesResonated: number;
}

// ── 1. Connection requests ────────────────────────────────────────────────────

export async function acceptOrDeclineConnections(
  userId: string,
  prisma: PrismaClient,
  client: AxiosInstance,
  persona: BotPersona,
): Promise<number> {
  const pending = await prisma.connection.findMany({
    where: { recipientId: userId, status: 'PENDING' },
    select: { id: true },
    take: 5,
  });

  let handled = 0;
  for (const conn of pending) {
    const accept = Math.random() < persona.connectionAcceptRate;
    const route = accept ? 'accept' : 'decline';
    try {
      await client.put(`/api/v1/connections/${conn.id}/${route}`, {}, asUser(userId));
      seederLog.debug(`Bot ${route}ed connection`, { userId, connectionId: conn.id });
      handled++;
    } catch {
      // Non-fatal — may already be resolved
    }
  }
  return handled;
}

// ── 2. Introductions ──────────────────────────────────────────────────────────

export async function respondToIntroductions(
  userId: string,
  prisma: PrismaClient,
  client: AxiosInstance,
  persona: BotPersona,
): Promise<number> {
  const pending = await (prisma as any).introduction.findMany({
    where: {
      status: 'PENDING',
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    select: { id: true },
    take: 3,
  });

  let handled = 0;
  for (const intro of pending) {
    const accept = Math.random() < persona.introAcceptRate;
    const route = accept ? 'accept' : 'decline';
    try {
      await client.post(`/api/v1/introductions/${intro.id}/${route}`, {}, asUser(userId));
      seederLog.debug(`Bot ${route}ed introduction`, { userId, introId: intro.id });
      handled++;
    } catch {
      // Non-fatal
    }
  }
  return handled;
}

// ── 3. Like and comment on group posts ───────────────────────────────────────

export async function likeAndCommentOnGroupPosts(
  userId: string,
  prisma: PrismaClient,
  client: AxiosInstance,
  persona: BotPersona,
): Promise<{ liked: number; commented: number }> {
  // Find a recent post in user's groups that they haven't liked yet
  const membership = await prisma.groupMembership.findFirst({
    where: { userId },
    select: { groupId: true },
  });
  if (!membership) return { liked: 0, commented: 0 };

  const recentPost = await (prisma as any).groupPost.findFirst({
    where: {
      groupId: membership.groupId,
      authorId: { not: userId },
      likes: { none: { userId } },
    },
    select: { id: true, groupId: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!recentPost) return { liked: 0, commented: 0 };

  let liked = 0;
  let commented = 0;

  // Like based on chattiness threshold
  if (Math.random() < Math.max(0.4, persona.chattiness)) {
    try {
      await client.post(
        `/api/v1/groups/${recentPost.groupId}/posts/${recentPost.id}/like`,
        {},
        asUser(userId),
      );
      liked = 1;
    } catch { /* already liked */ }
  }

  // Comment at 40% × chattiness
  if (liked && Math.random() < persona.chattiness * 0.4) {
    try {
      await client.post(
        `/api/v1/groups/${recentPost.groupId}/posts/${recentPost.id}/comments`,
        { content: randomFrom(COMMENT_TEXTS) },
        asUser(userId),
      );
      commented = 1;
    } catch { /* non-fatal */ }
  }

  return { liked, commented };
}

// ── 4. Resonate with prompt responses ────────────────────────────────────────

export async function resonateWithPromptResponses(
  userId: string,
  prisma: PrismaClient,
  client: AxiosInstance,
  persona: BotPersona,
): Promise<number> {
  // Only resonate if chattiness threshold met
  if (Math.random() > persona.chattiness) return 0;

  const response = await (prisma as any).promptResponse.findFirst({
    where: {
      userId: { not: userId },
      resonates: { none: { userId } },
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!response) return 0;

  try {
    await client.post(`/api/v1/prompts/responses/${response.id}/resonate`, {}, asUser(userId));
    return 1;
  } catch {
    return 0;
  }
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export async function runReactiveActions(
  userId: string,
  prisma: PrismaClient,
  client: AxiosInstance,
  persona: BotPersona,
): Promise<ReactiveResult> {
  const connectionsHandled = await acceptOrDeclineConnections(userId, prisma, client, persona);
  const introsHandled = await respondToIntroductions(userId, prisma, client, persona);
  const { liked: postsLiked, commented: commentsAdded } = await likeAndCommentOnGroupPosts(userId, prisma, client, persona);
  const responsesResonated = await resonateWithPromptResponses(userId, prisma, client, persona);

  return { connectionsHandled, introsHandled, postsLiked, commentsAdded, responsesResonated };
}
