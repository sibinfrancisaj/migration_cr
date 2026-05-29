/**
 * AI-004 — Intro Drop Proposal Service.
 *
 * Fetches eligible profiles in a region, sends anonymised profile summaries
 * to GPT, and creates IntroductionDrop records in DRAFT state for admin review.
 *
 * Short-circuits (no-op) when OPENAI_API_KEY is absent.
 */
import { prisma } from '@abroad-matrimony/db';
import { getEnv } from '@abroad-matrimony/config';
import { createChildLogger } from '@abroad-matrimony/logger';
import { isAiConfigured, getAiClient } from './client.js';
import type { IntroductionDropDraftDto } from './types/ai.types.js';

const log = createChildLogger({ module: 'ai:intro-grouping' });

// ── Minimum profile completion threshold ───────────────────────────────────────
const MIN_COMPLETION_SCORE = 60;

// ── Exclusion window — profiles already paired in last N days ─────────────────
const EXCLUSION_WINDOW_DAYS = 28;

// ── GPT prompt builder ─────────────────────────────────────────────────────────

interface AnonymisedProfile {
  id: string;
  summary: string;
  traitTags: string[];
  age: number | null;
  gender: string;
}

function buildGroupingPrompt(region: string, profiles: AnonymisedProfile[]): string {
  const profileList = profiles
    .map(
      (p) =>
        `ID:${p.id} | ${p.gender} | age:${p.age ?? '?'} | tags:[${p.traitTags.join(', ')}] | summary:"${p.summary.slice(0, 150)}"`,
    )
    .join('\n');

  return `You are an AI matchmaking curator for an Indian diaspora matrimony platform in ${region}.

Group these profiles into 5–10 introduction drops. Each drop should:
- Have 8–20 members
- Be balanced in gender (approx 50/50 male/female)
- Have a coherent identity theme (shared career stage, lifestyle, values)
- Include a compelling human-readable name and rationale
- Recommend a release date (ISO string, 2–7 days from now)

Return a JSON array of objects with this structure:
[
  {
    "name": "theme name",
    "rationale": "why these people connect well",
    "memberIds": ["id1", "id2", ...],
    "releaseRecommendation": "2026-06-05T10:00:00.000Z"
  }
]

PROFILES (${profiles.length} total):
${profileList}

Return ONLY the JSON array — no markdown, no explanation.`;
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Proposes a batch of introduction drops for a given region.
 * Creates IntroductionDrop records with status DRAFT + proposedByAI: true.
 *
 * @returns Array of draft DTOs, empty array if AI not configured or no eligible profiles.
 */
export async function proposeIntroductionDrops(
  region: string,
): Promise<IntroductionDropDraftDto[]> {
  if (!isAiConfigured()) {
    log.info('AI not configured — skipping intro drop proposal', { region });
    return [];
  }

  const cutoff = new Date(Date.now() - EXCLUSION_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Fetch eligible users: profile in region, not paused, completion >= threshold
  const users = await prisma.user.findMany({
    where: {
      profile: {
        currentCountry: { contains: region, mode: 'insensitive' },
        isPaused: false,
        completionScore: { gte: MIN_COMPLETION_SCORE },
        isSeeded: false,
      },
    },
    select: {
      id: true,
      profile: {
        select: {
          gender: true,
          dateOfBirth: true,
        },
      },
      profileEmbedding: {
        select: { summary: true, traitTags: true },
      },
      introductionsAsA: {
        where: { createdAt: { gte: cutoff } },
        select: { id: true },
        take: 1,
      },
    },
  });

  // Exclude profiles already introduced in the last 28 days or missing embedding
  const eligible = users.filter((u) => u.introductionsAsA.length === 0 && u.profileEmbedding);

  if (eligible.length < 10) {
    log.info('proposeIntroductionDrops — not enough eligible profiles', {
      region,
      count: eligible.length,
    });
    return [];
  }

  const anonymised: AnonymisedProfile[] = eligible.map((u) => ({
    id: u.id,
    summary: u.profileEmbedding?.summary ?? '',
    traitTags: u.profileEmbedding?.traitTags ?? [],
    age: u.profile?.dateOfBirth
      ? Math.floor(
          (Date.now() - new Date(u.profile.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25),
        )
      : null,
    gender: u.profile?.gender ?? 'UNKNOWN',
  }));

  const env = getEnv();
  const client = getAiClient();

  log.info('proposeIntroductionDrops — calling GPT', {
    region,
    profileCount: anonymised.length,
    model: env.AI_MODEL,
  });

  const completion = await client.chat.completions.create({
    model: env.AI_MODEL,
    messages: [
      { role: 'system', content: 'You are a matchmaking curator. Always respond with valid JSON.' },
      { role: 'user', content: buildGroupingPrompt(region, anonymised) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.5,
    max_tokens: 2000,
  });

  const raw = completion.choices[0]?.message?.content ?? '[]';

  let groups: Array<{
    name?: string;
    rationale?: string;
    memberIds?: string[];
    releaseRecommendation?: string;
  }>;

  try {
    const parsed = JSON.parse(raw) as unknown;
    groups = Array.isArray(parsed)
      ? (parsed as typeof groups)
      : (((parsed as { groups?: typeof groups }).groups) ?? []);
  } catch {
    log.error('proposeIntroductionDrops — GPT returned invalid JSON', { region, raw });
    return [];
  }

  // Persist DRAFT drops
  const results: IntroductionDropDraftDto[] = [];

  for (const group of groups) {
    if (!group.name || !Array.isArray(group.memberIds) || group.memberIds.length < 2) continue;

    const releaseAt = group.releaseRecommendation
      ? new Date(group.releaseRecommendation)
      : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    await prisma.introductionDrop.create({
      data: {
        name: group.name,
        criteria: { region, rationale: group.rationale ?? '', aiProposed: true },
        memberPool: group.memberIds,
        releaseAt,
        status: 'DRAFT',
        proposedByAI: true,
      },
    });

    results.push({
      name: group.name,
      rationale: group.rationale ?? '',
      memberIds: group.memberIds,
      releaseRecommendation: releaseAt.toISOString(),
      region,
    });
  }

  log.info('proposeIntroductionDrops — created DRAFT drops', { region, count: results.length });

  return results;
}
