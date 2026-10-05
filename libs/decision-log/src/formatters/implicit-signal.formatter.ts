import type { ImplicitSignalLogData } from '../types/decision-log.types.js';

const SIGNAL_DESCRIPTIONS: Record<string, string> = {
  PROFILE_VIEW:       'viewed the profile',
  PROFILE_SAVE:       'saved the profile to their shortlist',
  CONNECTION_REQUEST: 'sent a connection request',
  CONNECTION_ACCEPT:  'accepted a connection request',
  FLAG_MESSAGE:       'flagged a message (negative signal)',
  BLOCK:              'blocked (strong negative signal)',
};

export function formatImplicitSignalSummary(data: ImplicitSignalLogData): string {
  const action = SIGNAL_DESCRIPTIONS[data.signal] ?? data.signal;
  const sign   = data.delta > 0 ? '+' : '';
  const boostPct = `${sign}${Math.round(data.delta * 100)}%`;
  return `Implicit signal applied: ${action} → implicit boost ${boostPct} (cumulative: ${Math.round(data.newBoost * 100)}%).`;
}

export function formatImplicitSignalNarrativePrompt(data: ImplicitSignalLogData): string {
  const action = SIGNAL_DESCRIPTIONS[data.signal] ?? data.signal;
  const direction = data.delta > 0 ? 'positive' : 'negative';
  const prevPct = Math.round(data.previousBoost * 100);
  const newPct  = Math.round(data.newBoost * 100);

  return `Explain this behavioural signal event to a non-technical admin in 3–4 sentences. User A ${action} on User B's profile. This triggered a ${direction} implicit boost of ${Math.round(data.delta * 100)}%. The cumulative implicit boost for this pair moved from ${prevPct}% to ${newPct}%. Implicit boosts are capped at ±30% and supplement (but never dominate) the algorithm's core score. Explain what this means for how User B appears in User A's future discovery feeds.`;
}
