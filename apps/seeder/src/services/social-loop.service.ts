/**
 * State-machine bot orchestrator.
 *
 * Replaces the old stateless activity.simulator.ts with a proper
 * reactive-first, proactive-second bot cycle per user.
 *
 * State machine per user:
 *   IDLE → REACTING (respond to pending actions) → INITIATING (start new actions) → IDLE
 *
 * Run order is intentional:
 *   1. Reactive actions always run first — reply before initiating
 *   2. Proactive action count is driven by persona.aggressiveness
 *   3. Bot state (persona + metadata) persisted in Redis between runs
 */
import { getPrismaClient } from '@abroad-matrimony/db';
import { getGatewayClient } from '../lib/gateway-client.js';
import { getBotState, saveBotState } from '../lib/bot-state.js';
import { seederLog } from '../lib/seeder-logger.js';
import { runReactiveActions, type ReactiveResult } from './reactive-actions.js';
import {
  sendConnectionRequest,
  postInGroup,
  logHabit,
  rsvpToEvent,
  respondToPrompt,
  logProfileView,
  earlyAccessDrop,
} from './proactive-actions.js';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Proactive action registry ─────────────────────────────────────────────────

type ProactiveAction = 'send_connection' | 'post_in_group' | 'log_habit' | 'rsvp_event' | 'respond_to_prompt' | 'log_profile_view' | 'early_access_drop';

/**
 * Weighted proactive action selection driven by persona traits.
 * Returns a shuffled, persona-weighted list of actions to attempt.
 */
function pickProactiveActions(aggressiveness: number, chattiness: number, habitConsistency: number): ProactiveAction[] {
  const weights: Record<ProactiveAction, number> = {
    send_connection:    aggressiveness * 3,
    post_in_group:      chattiness * 2,
    log_habit:          habitConsistency * 2.5,
    rsvp_event:         aggressiveness * 1.5,
    respond_to_prompt:  chattiness * 1.5,
    log_profile_view:   1.5, // everyone browses
    early_access_drop:  aggressiveness * 1,
  };

  // Weighted shuffle — higher weight = more likely to appear first
  const entries = Object.entries(weights) as [ProactiveAction, number][];
  return entries
    .map(([action, weight]) => ({ action, sort: Math.random() * weight }))
    .sort((a, b) => b.sort - a.sort)
    .map((e) => e.action);
}

// ── Single bot cycle ──────────────────────────────────────────────────────────

export interface BotCycleResult {
  userId: string;
  reactive: ReactiveResult;
  proactiveCount: number;
}

export async function runBotCycle(userId: string): Promise<BotCycleResult> {
  const prisma = getPrismaClient();
  const client = getGatewayClient();

  // Load persona + state
  const botState = await getBotState(userId);
  const { persona } = botState;

  // ── Phase 1: REACTING ──────────────────────────────────────────────────────
  const reactive = await runReactiveActions(userId, prisma as any, client, persona);

  // ── Phase 2: INITIATING ────────────────────────────────────────────────────
  // How many proactive actions: 1 (low aggression) to 3 (high aggression)
  const maxProactive = Math.round(1 + persona.aggressiveness * 2);
  const actionQueue = pickProactiveActions(persona.aggressiveness, persona.chattiness, persona.habitConsistency);

  let proactiveCount = 0;
  for (const action of actionQueue) {
    if (proactiveCount >= maxProactive) break;

    let taken = false;
    switch (action) {
      case 'send_connection':   taken = await sendConnectionRequest(userId, prisma as any, client); break;
      case 'post_in_group':     taken = await postInGroup(userId, prisma as any, client); break;
      case 'log_habit':         taken = await logHabit(userId, prisma as any, client); break;
      case 'rsvp_event':        taken = await rsvpToEvent(userId, prisma as any, client); break;
      case 'respond_to_prompt': taken = await respondToPrompt(userId, prisma as any, client); break;
      case 'log_profile_view':  taken = await logProfileView(userId, prisma as any, client); break;
      case 'early_access_drop': taken = await earlyAccessDrop(userId, prisma as any, client); break;
    }

    if (taken) proactiveCount++;
  }

  // ── Update state ───────────────────────────────────────────────────────────
  await saveBotState(userId, {
    ...botState,
    lastActionAt: new Date().toISOString(),
  });

  seederLog.debug('Bot cycle complete', {
    userId,
    reactive,
    proactiveCount,
    persona: {
      aggressiveness: persona.aggressiveness.toFixed(2),
      chattiness: persona.chattiness.toFixed(2),
    },
  });

  return { userId, reactive, proactiveCount };
}

// ── Full simulation run ───────────────────────────────────────────────────────

export interface SocialLoopResult {
  usersActive: number;
  totalReactive: ReactiveResult;
  totalProactive: number;
}

export async function runSocialLoop(): Promise<SocialLoopResult> {
  const prisma = getPrismaClient();

  // Pick 10–20 seeded users, varying which ones are active each run
  const seededUsers = await prisma.user.findMany({
    where: { isSeeded: true, status: 'ACTIVE' },
    select: { id: true },
    take: 20,
    skip: randomInt(0, 50),
    orderBy: { createdAt: 'desc' },
  });

  const activeUsers = seededUsers.slice(0, randomInt(10, Math.min(20, seededUsers.length)));

  const totals: SocialLoopResult = {
    usersActive: activeUsers.length,
    totalReactive: {
      connectionsHandled: 0,
      introsHandled: 0,
      postsLiked: 0,
      commentsAdded: 0,
      responsesResonated: 0,
    },
    totalProactive: 0,
  };

  for (const user of activeUsers) {
    try {
      const result = await runBotCycle(user.id);
      totals.totalReactive.connectionsHandled += result.reactive.connectionsHandled;
      totals.totalReactive.introsHandled      += result.reactive.introsHandled;
      totals.totalReactive.postsLiked         += result.reactive.postsLiked;
      totals.totalReactive.commentsAdded      += result.reactive.commentsAdded;
      totals.totalReactive.responsesResonated += result.reactive.responsesResonated;
      totals.totalProactive                   += result.proactiveCount;
    } catch (err) {
      seederLog.warn('Bot cycle failed for user — skipping', { userId: user.id, err });
    }
  }

  seederLog.info('Social loop complete', totals);
  return totals;
}
