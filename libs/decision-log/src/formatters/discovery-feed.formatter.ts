import type { DiscoveryFeedLogData } from '../types/decision-log.types.js';

export function formatDiscoveryFeedSummary(data: DiscoveryFeedLogData): string {
  const steps: string[] = [];
  if (data.rrfActive)          steps.push('RRF fusion');
  if (data.annColdStart)       steps.push('ANN cold-start');
  if (data.collaborativeActive) steps.push('collaborative filtering');
  if (data.mmrActive)          steps.push('MMR diversity reranking');

  const pipeline = steps.length > 0 ? ` via ${steps.join(' + ')}` : '';
  return `Discovery feed generated: ${data.candidateCount} candidates → ${data.finalCount} results${pipeline}.`;
}

export function formatDiscoveryFeedNarrativePrompt(data: DiscoveryFeedLogData): string {
  const stepDetails = [
    data.rrfActive && 'Reciprocal Rank Fusion (RRF) merged semantic similarity with match scores.',
    data.annColdStart && 'ANN cold-start was used because fewer than 10 stored scores existed — semantic-only candidates received proxy scores.',
    data.collaborativeActive && 'Collaborative filtering added candidates based on what similar users engaged with.',
    data.mmrActive && 'MMR diversity reranking reshuffled results to avoid showing too many similar personalities in a row.',
    !data.rrfActive && !data.annColdStart && 'Standard match score ranking was used (no semantic fusion needed).',
  ].filter(Boolean).join(' ');

  return `Explain this discovery feed generation to a non-technical admin in 4–5 sentences. Focus on which pipeline steps ran and why, how candidates were filtered down from ${data.candidateCount} to ${data.finalCount}, and what the result quality looks like (top scores: ${data.topScores.slice(0, 3).map(s => `${Math.round(s * 100)}%`).join(', ')}). ${stepDetails} The user ${data.cursorUsed ? 'used pagination (cursor present)' : 'requested the first page'}.`;
}
