/**
 * Phase-E: Implicit signal feedback loop.
 *
 * Behavioural signals (views, saves, connections) indicate latent compatibility
 * beyond what the scoring algorithm can compute from static profile data.
 * Each signal nudges the pair's `implicitBoost` field — clamped to [-0.30, +0.30]
 * so it can never dominate the algorithm.
 *
 * All writes are fire-and-forget from the caller's perspective (they never await
 * this service). Failures are logged but not rethrown.
 *
 * ADR note: `implicitBoost` requires a Prisma schema migration — run
 * `prisma db push` locally before deploying. (Cloud runner cannot reach Supabase.)
 */

import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';

const log = createChildLogger({ module: 'matching:implicit-signal' });

/** Maximum absolute value of the implicit boost (±30 %). */
const BOOST_CAP = 0.30;

/** Signal deltas — positive means compatible signal, negative means incompatible. */
const SIGNAL_DELTA: Record<ImplicitSignalType, number> = {
  PROFILE_VIEW:        +0.02,
  PROFILE_SAVE:        +0.04,
  CONNECTION_REQUEST:  +0.06,
  CONNECTION_ACCEPT:   +0.08,
  FLAG_MESSAGE:        -0.10,
  BLOCK:               -0.20,
};

export type ImplicitSignalType =
  | 'PROFILE_VIEW'
  | 'PROFILE_SAVE'
  | 'CONNECTION_REQUEST'
  | 'CONNECTION_ACCEPT'
  | 'FLAG_MESSAGE'
  | 'BLOCK';

/**
 * Applies an implicit signal delta to the stored MatchScore for a user pair.
 *
 * Safe to call fire-and-forget — never throws.
 * No-op when no MatchScore row exists yet for the pair (early boot / new users).
 */
export async function applyImplicitSignal(
  signalUserId: string,
  targetUserId: string,
  signal: ImplicitSignalType,
): Promise<void> {
  try {
    const delta = SIGNAL_DELTA[signal];
    const [userAId, userBId] = [signalUserId, targetUserId].sort();

    const existing = await prisma.matchScore.findFirst({
      where: { userAId, userBId },
      select: { id: true, implicitBoost: true },
    });

    if (!existing) return; // no stored score yet — nothing to update

    const newBoost = clamp(existing.implicitBoost + delta, -BOOST_CAP, BOOST_CAP);

    await prisma.matchScore.update({
      where:  { id: existing.id },
      data:   { implicitBoost: newBoost },
    });

    log.info('Implicit signal applied', {
      signalUserId, targetUserId, signal, delta, newBoost,
    });
  } catch (err) {
    log.warn('applyImplicitSignal failed (non-fatal)', { signalUserId, targetUserId, signal, err });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
