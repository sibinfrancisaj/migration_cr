/**
 * INTRO-005 / INTRO-006 — "Why This Match?" text generation.
 *
 * Two modes:
 *  1. Rule-based (always available):  `generateWhyThisMatch(breakdown)`
 *  2. LLM-enhanced (optional):        `generateWhyThisMatchLLM(userAId, userBId, breakdown)`
 *     • Uses gpt-4o-mini via libs/ai; falls back to rule-based when AI absent or on error.
 *     • Result cached in Redis 24h per pair (canonical order: smaller UUID first).
 */

import { createChildLogger } from '@abroad-matrimony/logger';
import { cacheGet, cacheSet } from '@abroad-matrimony/cache';
import { CACHE_KEYS, CACHE_TTL } from '@abroad-matrimony/shared';
import type { ScoreBreakdown } from '@abroad-matrimony/shared';

const log = createChildLogger({ module: 'introductions:why-this-match' });

// ── Dimension metadata ────────────────────────────────────────────────────────

/** Human-readable label for each ScoreBreakdown dimension. */
export const DIMENSION_LABELS: Record<keyof ScoreBreakdown, string> = {
  verification:        'Identity Verified',
  settlementIntent:    'Life Abroad Plan',
  realLifeAnswers:     'Shared Values',
  profileCompleteness: 'Profile Depth',
  checkInRecency:      'Recent Activity',
  ageCompatibility:    'Age Compatibility',
  groupMembership:     'Shared Communities',
  languageMatch:       'Language Match',
  faithAlignment:      'Faith Alignment',
  habitConsistency:    'Habit Consistency',
  habitOverlap:        'Shared Daily Habits',
};

/** Key dimensions shown prominently in the match cards. */
const HIGHLIGHT_DIMENSIONS: Array<keyof ScoreBreakdown> = [
  'settlementIntent',
  'faithAlignment',
  'realLifeAnswers',
  'languageMatch',
  'ageCompatibility',
  'habitOverlap',
  'groupMembership',
  'verification',
];

// ── Output types ──────────────────────────────────────────────────────────────

export interface DimensionCard {
  /** ScoreBreakdown key */
  key:   keyof ScoreBreakdown;
  /** Human-readable label */
  label: string;
  /** Raw score 0.0–1.0 */
  score: number;
  /** Score expressed as 0–100 integer */
  pct:   number;
  /** Qualitative tag */
  tag:   'Aligned' | 'Good' | 'Fair' | 'Different';
}

export interface WhyThisMatchDto {
  /** Short headline, e.g. "Strong match on Life Abroad Plan and Faith Alignment" */
  headline:   string;
  /** 1-2 sentence summary text */
  summary:    string;
  /** Top 3 scoring dimensions, sorted score DESC */
  dimensions: DimensionCard[];
  /** Whether this text was LLM-generated (true) or rule-based (false) */
  isAiGenerated: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreToTag(score: number): DimensionCard['tag'] {
  if (score >= 0.8) return 'Aligned';
  if (score >= 0.6) return 'Good';
  if (score >= 0.4) return 'Fair';
  return 'Different';
}

function toPct(score: number): number {
  return Math.round(score * 100);
}

// ── INTRO-005: Rule-based generator ──────────────────────────────────────────

/**
 * Pure rule-based "Why this match?" text.
 * No DB or cache calls — safe to call anywhere.
 *
 * Algorithm:
 *   1. Score all present dimensions.
 *   2. Prefer highlight dimensions for the top-3 card list.
 *   3. Build a headline from the top 2 highest-scoring highlight dimensions.
 *   4. Build a summary sentence from aligned dimensions (score >= 0.7).
 */
export function generateWhyThisMatch(
  breakdown: ScoreBreakdown,
  totalScore?: number,
): WhyThisMatchDto {
  // Build all dimension cards
  const all: DimensionCard[] = (Object.entries(breakdown) as [keyof ScoreBreakdown, number][])
    .map(([key, score]) => ({
      key,
      label: DIMENSION_LABELS[key] ?? (key as string),
      score,
      pct:   toPct(score),
      tag:   scoreToTag(score),
    }))
    .sort((a, b) => b.score - a.score);

  // Prefer highlight dimensions for the visible top-3 cards
  const highlighted = all.filter(c => HIGHLIGHT_DIMENSIONS.includes(c.key));
  const rest        = all.filter(c => !HIGHLIGHT_DIMENSIONS.includes(c.key));
  const top3        = [...highlighted, ...rest].slice(0, 3);

  // Headline from top 2 highlight-preferred dimensions
  const h1 = top3[0];
  const h2 = top3[1];
  let headline = h1 ? `Strong match on ${h1.label}` : 'Compatible profile';
  if (h2) headline += ` and ${h2.label}`;

  // Summary from aligned (≥ 70%) dimensions
  const aligned = top3.filter(c => c.score >= 0.7).map(c => c.label);
  let summary: string;

  if (aligned.length >= 2) {
    summary = `You share strong alignment on ${aligned[0]} and ${aligned[1]}, which are key indicators of long-term compatibility in the diaspora context.`;
  } else if (aligned.length === 1) {
    summary = `You have a strong match on ${aligned[0]}, complemented by several compatible lifestyle dimensions.`;
  } else if (totalScore !== undefined && totalScore >= 0.6) {
    summary = 'You have a well-rounded compatibility profile with complementary values and life goals.';
  } else {
    summary = 'You have complementary qualities worth exploring — compatibility often grows through shared experiences.';
  }

  return {
    headline,
    summary,
    dimensions:    top3,
    isAiGenerated: false,
  };
}

// ── INTRO-006: LLM-enhanced generator ────────────────────────────────────────

/**
 * LLM-enhanced "Why this match?" text.
 *
 * • Reads from Redis cache first (24h TTL).
 * • On cache miss: calls gpt-4o-mini via `@abroad-matrimony/ai`.
 * • Falls back to rule-based if AI is not configured or on any error.
 * • Errors are always swallowed — never throws.
 */
export async function generateWhyThisMatchLLM(
  userAId:   string,
  userBId:   string,
  breakdown: ScoreBreakdown,
  totalScore?: number,
): Promise<WhyThisMatchDto> {
  const cacheKey = CACHE_KEYS.WHY_MATCH(userAId, userBId);
  const ruleBased = generateWhyThisMatch(breakdown, totalScore);

  // ── 1. Cache hit ────────────────────────────────────────────────────────────
  try {
    const cached = await cacheGet<{ headline: string; summary: string }>(cacheKey);
    if (cached) {
      log.debug('Why-this-match LLM cache hit', { cacheKey });
      return { ...ruleBased, headline: cached.headline, summary: cached.summary, isAiGenerated: true };
    }
  } catch (err) {
    log.warn('Redis read error in generateWhyThisMatchLLM — skipping cache', { err });
  }

  // ── 2. AI generation ────────────────────────────────────────────────────────
  try {
    // Dynamic import so this module compiles even when libs/ai is absent
    const ai = await import('@abroad-matrimony/ai');
    if (!ai.isAiConfigured()) {
      log.debug('AI not configured — returning rule-based why-this-match');
      return ruleBased;
    }

    const client = ai.getAiClient();
    const dimensionSummary = ruleBased.dimensions
      .map(d => `${d.label}: ${d.pct}%`)
      .join(', ');

    const prompt = [
      'You are a compassionate matchmaking assistant for the Abroad Matrimony platform.',
      'Write a warm, encouraging 2-sentence "Why this match?" explanation for two compatible users.',
      `Their top compatibility dimensions are: ${dimensionSummary}.`,
      'Keep it under 60 words. Do not mention percentages. Focus on shared values and life vision.',
      'Return JSON with keys: headline (max 12 words) and summary (2 sentences).',
    ].join('\n');

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = JSON.parse(response.choices[0]?.message?.content ?? '{}') as {
      headline?: string;
      summary?:  string;
    };

    if (raw.headline && raw.summary) {
      const result: WhyThisMatchDto = {
        ...ruleBased,
        headline:     raw.headline,
        summary:      raw.summary,
        isAiGenerated: true,
      };

      // Cache the LLM text portion
      try {
        await cacheSet(cacheKey, { headline: raw.headline, summary: raw.summary }, CACHE_TTL.WHY_MATCH_SECONDS);
      } catch {
        /* swallow cache write errors */
      }

      return result;
    }
  } catch (err) {
    log.warn('LLM generation failed in generateWhyThisMatchLLM — falling back to rule-based', { err });
  }

  return ruleBased;
}
