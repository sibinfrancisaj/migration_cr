import type { IntroPairingLogData, IntroDropReleasedLogData } from '../types/decision-log.types.js';

export function formatIntroPairingSummary(data: IntroPairingLogData): string {
  const algoLabel = data.algorithm === 'pgvector'
    ? 'semantic similarity' : data.algorithm === 'match-score'
    ? 'match score ranking' : 'random selection (fallback)';
  return `Introduction pairing created via ${algoLabel} — rank #${data.pairingRank}, score ${Math.round(data.score * 100)}%.`;
}

export function formatIntroPairingNarrativePrompt(data: IntroPairingLogData): string {
  const algoDetail = {
    pgvector:     'pgvector cosine similarity on profile embeddings (personality + story + habits vectors)',
    'match-score':'stored match score between the two users',
    random:       'random selection as a fallback (no embedding or score data was available)',
  }[data.algorithm];

  return `Explain this introduction pairing decision to a non-technical admin in 3–5 sentences. The pairing was generated using ${algoDetail}. The pair was ranked #${data.pairingRank} among all candidates for this recipient in drop ${data.dropId}. Their compatibility score was ${Math.round(data.score * 100)}%. Explain what the chosen algorithm means, why it's a good pairing, and what confidence the admin should have in this match.`;
}

export function formatDropReleasedSummary(data: IntroDropReleasedLogData): string {
  const type = data.isWeeklyDrop ? 'weekly auto-drop' : 'admin-curated drop';
  return `Introduction drop "${data.dropName}" released (${type}) — ${data.memberCount} members, ${data.pairingCount} pairings.`;
}

export function formatDropReleasedNarrativePrompt(data: IntroDropReleasedLogData): string {
  return `Explain this introduction drop release to a non-technical admin in 3–4 sentences. The drop "${data.dropName}" ${data.isWeeklyDrop ? 'was automatically created by the weekly BullMQ cron job' : 'was proposed by AI and approved by an admin'}. It included ${data.memberCount} members and generated ${data.pairingCount} personalised introductions. Released at ${new Date(data.releaseAt).toUTCString()}. Explain what members experience now and what the admin should monitor.`;
}
