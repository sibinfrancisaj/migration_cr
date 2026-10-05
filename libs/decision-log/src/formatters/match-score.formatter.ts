import type { ScoreBreakdown } from '@abroad-matrimony/shared';
import type { MatchScoreLogData } from '../types/decision-log.types.js';

const PCT = (v: number) => `${Math.round(v * 100)}%`;

const DIM_LABELS: Record<string, string> = {
  verification:        'Identity verification',
  settlementIntent:    'Settlement intent',
  realLifeAnswers:     'Real-life answer alignment',
  profileCompleteness: 'Profile completeness',
  checkInRecency:      'Check-in recency',
  ageCompatibility:    'Age compatibility',
  groupMembership:     'Shared group membership',
  languageMatch:       'Language match',
  faithAlignment:      'Faith alignment',
  habitConsistency:    'Habit consistency',
  habitOverlap:        'Shared daily habits',
  promptResonance:     'Prompt resonance',
  familyInvolvement:   'Family involvement',
  eventCoAttendance:   'Event co-attendance',
  communicationStyle:  'Communication style',
  profileViewMomentum: 'Profile view momentum',
  trustLayerDepth:     'Trust depth',
  vibeCompatibility:   'Vibe compatibility',
  pearsonAnswerFit:    'Answer pattern fit',
};

const DIM_WEIGHTS: Record<string, number> = {
  verification: 0.15, settlementIntent: 0.20, realLifeAnswers: 0.25,
  profileCompleteness: 0.10, checkInRecency: 0.05, ageCompatibility: 0.10,
  groupMembership: 0.05, languageMatch: 0.05, faithAlignment: 0.05,
  habitConsistency: 0.03, habitOverlap: 0.02, promptResonance: 0.02,
  familyInvolvement: 0.03, eventCoAttendance: 0.02, communicationStyle: 0.02,
  profileViewMomentum: 0.01, trustLayerDepth: 0.02, vibeCompatibility: 0.04, pearsonAnswerFit: 0.04,
};

function topDimension(breakdown: ScoreBreakdown): string {
  return Object.entries(breakdown)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))[0]?.[0] ?? 'overall compatibility';
}

export function formatMatchScoreSummary(data: MatchScoreLogData): string {
  const pct = PCT(data.totalScore);
  const top = DIM_LABELS[topDimension(data.breakdown)] ?? 'overall compatibility';
  const optCount = data.optionalDims.length;
  const optPart = optCount > 0 ? `, ${optCount} optional signal${optCount > 1 ? 's' : ''} active` : '';
  return `Match score computed at ${pct} — strongest driver: ${top}${optPart}.`;
}

export function formatMatchScoreNarrativePrompt(data: MatchScoreLogData): string {
  const breakdown = data.breakdown as Record<string, number>;
  const dimLines = Object.entries(breakdown)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => {
      const label = DIM_LABELS[k] ?? k;
      const weight = DIM_WEIGHTS[k] ?? 0;
      return `  - ${label} [weight ${PCT(weight)}]: scored ${PCT(v)}`;
    })
    .join('\n');

  const optDims = data.optionalDims.length > 0
    ? `Optional signals active: ${data.optionalDims.map(d => DIM_LABELS[d] ?? d).join(', ')}.`
    : 'No optional signals were active — score is based on core dimensions only.';

  const boostText = data.implicitBoost !== 0
    ? `An implicit behavioural boost of ${data.implicitBoost > 0 ? '+' : ''}${PCT(data.implicitBoost)} was applied from recent interactions.`
    : 'No implicit behavioural boost is present.';

  return `You are an explainability engine for a matrimony platform. Explain the following match score computation in 5–7 clear sentences for a non-technical admin. Be specific about why each dimension scored high or low. Use plain English.

Score computation result:
  Total score: ${PCT(data.totalScore)} (algorithm version: ${data.algorithmVersion})
  Core scale factor: ${data.coreScale.toFixed(3)} (decreases as optional dims are added)
  ${boostText}

Dimension breakdown:
${dimLines}

${optDims}

Write as a coherent paragraph, not bullet points. Explain the "why", not just the numbers.`;
}
