/**
 * AI-002 — Profile Intelligence Service.
 *
 * Aggregates all profile signals → GPT for personality analysis → embedding →
 * upserts ProfileEmbedding in DB.
 *
 * Short-circuits (no-op) when OPENAI_API_KEY is absent.
 */
import { prisma } from '@abroad-matrimony/db';
import { getEnv } from '@abroad-matrimony/config';
import { createChildLogger } from '@abroad-matrimony/logger';
import { isAiConfigured, getAiClient } from './client.js';
import type { ProfileEmbeddingDto, VibeScores, ContactWindow } from './types/ai.types.js';

const log = createChildLogger({ module: 'ai:profile-intelligence' });

// ── Trait tag taxonomy ────────────────────────────────────────────────────────

const TRAIT_TAG_TAXONOMY = [
  'family-oriented', 'career-driven', 'spiritually-grounded', 'adventurous',
  'home-loving', 'culturally-rooted', 'open-minded', 'traditional',
  'health-conscious', 'socially-active', 'introverted', 'extroverted',
  'financially-savvy', 'compassionate', 'independent', 'community-focused',
  'intellectually-curious', 'artistically-inclined', 'nature-lover', 'tech-savvy',
] as const;

// ── Country → timezone mapping ────────────────────────────────────────────────

const COUNTRY_TIMEZONE: Record<string, string> = {
  'United Kingdom':  'Europe/London',
  'Germany':         'Europe/Berlin',
  'Australia':       'Australia/Sydney',
  'Canada':          'America/Toronto',
  'India':           'Asia/Kolkata',
  'United States':   'America/New_York',
  'UAE':             'Asia/Dubai',
  'Singapore':       'Asia/Singapore',
  'New Zealand':     'Pacific/Auckland',
};

function deriveTimezone(country: string): string {
  return COUNTRY_TIMEZONE[country] ?? 'UTC';
}

// ── Profile data aggregation ──────────────────────────────────────────────────

interface ProfileContext {
  userId: string;
  name: string;
  age: number | null;
  gender: string;
  country: string;
  city: string;
  bio: string | null;
  realLifeAnswers: { questionKey: string; answer: string }[];
  storyPrompts: { promptKey: string; answer: string }[];
  voiceIntroTranscript: string | null;
  habitCount: number;
  groupNames: string[];
  eventCount: number;
  promptResponseCount: number;
}

async function aggregateProfileContext(userId: string): Promise<ProfileContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: {
        select: {
          name: true,
          dateOfBirth: true,
          gender: true,
          currentCity: true,
          currentCountry: true,
          bio: true,
          voiceIntroTranscript: true,
        },
      },
      realLifeAnswers: { select: { questionKey: true, value: true } },
      storyPromptAnswers: { select: { promptKey: true, answer: true } },
      habitLogs: { select: { id: true }, take: 1 },
      groupMemberships: {
        select: { group: { select: { name: true } } },
        take: 5,
      },
      eventRsvps: { select: { id: true }, take: 1 },
      promptResponses: { select: { id: true }, take: 1 },
    },
  });

  if (!user?.profile) return null;

  const profile = user.profile;
  const age = profile.dateOfBirth
    ? Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null;

  return {
    userId,
    name: profile.name,
    age,
    gender: profile.gender,
    country: profile.currentCountry,
    city: profile.currentCity,
    bio: profile.bio,
    realLifeAnswers: user.realLifeAnswers.map((a) => ({
      questionKey: String(a.questionKey),
      answer: typeof a.value === 'string' ? a.value : JSON.stringify(a.value),
    })),
    storyPrompts: user.storyPromptAnswers.map((s) => ({
      promptKey: String(s.promptKey),
      answer: s.answer,
    })),
    voiceIntroTranscript: profile.voiceIntroTranscript,
    habitCount: user.habitLogs.length,
    groupNames: user.groupMemberships.map((m) => m.group.name),
    eventCount: user.eventRsvps.length,
    promptResponseCount: user.promptResponses.length,
  };
}

// ── GPT prompt ────────────────────────────────────────────────────────────────

function buildIntelligencePrompt(ctx: ProfileContext): string {
  const answers = ctx.realLifeAnswers
    .map((a) => `- ${a.questionKey}: ${a.answer}`)
    .join('\n');
  const stories = ctx.storyPrompts
    .map((s) => `- ${s.promptKey}: ${s.answer}`)
    .join('\n');
  const groups = ctx.groupNames.join(', ') || 'none';
  const timezone = deriveTimezone(ctx.country);

  return `You are a matchmaking analyst for an Indian diaspora matrimony platform.
Analyse this profile and return a JSON object with EXACTLY these fields:

{
  "summary": "<150-word personality description — warm, third-person, focused on compatibility>",
  "traitTags": ["<8 to 12 tags from the provided taxonomy>"],
  "vibeScores": { "warmth": 1-10, "ambition": 1-10, "tradition": 1-10, "socialEnergy": 1-10, "openness": 1-10 },
  "compatibilityNotes": "<2-3 sentences about who this person is most likely to connect with>",
  "recommendedContactWindow": { "startHour": 8, "endHour": 22, "timezone": "${timezone}" }
}

TRAIT TAXONOMY (use only from this list): ${TRAIT_TAG_TAXONOMY.join(', ')}

PROFILE DATA:
Name: ${ctx.name}
Age: ${ctx.age ?? 'unknown'}
Gender: ${ctx.gender}
Location: ${ctx.city}, ${ctx.country}
Bio: ${ctx.bio ?? 'not provided'}

Real-life answers:
${answers || 'none yet'}

Story prompts:
${stories || 'none yet'}

Voice intro transcript: ${ctx.voiceIntroTranscript ?? 'not provided'}
Community groups: ${groups}
Events attended: ${ctx.eventCount}
Weekly prompts answered: ${ctx.promptResponseCount}
Active habit tracker: ${ctx.habitCount > 0 ? 'yes' : 'no'}

Return ONLY the JSON object — no markdown, no explanation.`;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generates AI profile intelligence for a user and upserts the ProfileEmbedding record.
 *
 * @returns ProfileEmbeddingDto if successful, null if AI not configured or profile not found.
 */
export async function generateProfileIntelligence(userId: string): Promise<ProfileEmbeddingDto | null> {
  if (!isAiConfigured()) {
    log.info('AI not configured — skipping profile intelligence', { userId });
    return null;
  }

  const ctx = await aggregateProfileContext(userId);
  if (!ctx) {
    log.warn('generateProfileIntelligence — profile not found', { userId });
    return null;
  }

  const env = getEnv();
  const client = getAiClient();

  // ── GPT analysis ───────────────────────────────────────────────────────────
  log.info('Generating profile intelligence via GPT', { userId, model: env.AI_MODEL });

  const completion = await client.chat.completions.create({
    model: env.AI_MODEL,
    messages: [
      { role: 'system', content: 'You are a matchmaking analyst. Always respond with valid JSON.' },
      { role: 'user', content: buildIntelligencePrompt(ctx) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
    max_tokens: 600,
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  let parsed: {
    summary?: string;
    traitTags?: string[];
    vibeScores?: VibeScores;
    compatibilityNotes?: string;
    recommendedContactWindow?: ContactWindow;
  };

  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    log.error('GPT returned invalid JSON for profile intelligence', { userId, raw });
    return null;
  }

  const summary = parsed.summary ?? '';
  const traitTags = Array.isArray(parsed.traitTags) ? parsed.traitTags.slice(0, 12) : [];
  const vibeScores: VibeScores = {
    warmth:       parsed.vibeScores?.warmth      ?? 5,
    ambition:     parsed.vibeScores?.ambition    ?? 5,
    tradition:    parsed.vibeScores?.tradition   ?? 5,
    socialEnergy: parsed.vibeScores?.socialEnergy ?? 5,
    openness:     parsed.vibeScores?.openness    ?? 5,
  };
  const compatibilityNotes = parsed.compatibilityNotes ?? '';
  const recommendedContactWindow: ContactWindow = parsed.recommendedContactWindow ?? {
    startHour: 8,
    endHour: 22,
    timezone: deriveTimezone(ctx.country),
  };

  // ── Embedding ──────────────────────────────────────────────────────────────
  log.info('Generating embedding vector', { userId, model: env.EMBEDDING_MODEL });

  const embeddingResponse = await client.embeddings.create({
    model: env.EMBEDDING_MODEL,
    input: summary,
  });

  const embedding = embeddingResponse.data[0]?.embedding ?? [];

  // ── DB upsert ──────────────────────────────────────────────────────────────
  // Cast typed objects to InputJsonValue for Prisma Json column compatibility
  await prisma.profileEmbedding.upsert({
    where: { userId },
    create: {
      userId,
      summary,
      traitTags,
      vibeScores: vibeScores as unknown as Parameters<typeof prisma.profileEmbedding.create>[0]['data']['vibeScores'],
      compatibilityNotes,
      recommendedContactWindow: recommendedContactWindow as unknown as Parameters<typeof prisma.profileEmbedding.create>[0]['data']['recommendedContactWindow'],
    },
    update: {
      summary,
      traitTags,
      vibeScores: vibeScores as unknown as Parameters<typeof prisma.profileEmbedding.update>[0]['data']['vibeScores'],
      compatibilityNotes,
      recommendedContactWindow: recommendedContactWindow as unknown as Parameters<typeof prisma.profileEmbedding.update>[0]['data']['recommendedContactWindow'],
    },
  });

  log.info('ProfileEmbedding upserted', { userId, traitTagCount: traitTags.length });

  return {
    userId,
    summary,
    traitTags,
    vibeScores,
    compatibilityNotes,
    recommendedContactWindow,
    embedding,
  };
}
