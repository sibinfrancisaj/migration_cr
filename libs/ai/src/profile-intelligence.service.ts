/**
 * AI-002 — Profile Intelligence Service.
 *
 * Aggregates all profile signals → GPT for personality analysis → 3 embeddings:
 *   1. personality  — AI summary text (primary, used for RRF + vibe scores)
 *   2. story        — concatenated story prompt answers
 *   3. habits       — habit activity text
 *
 * All 3 vectors are saved via $executeRaw (pgvector Unsupported columns).
 * Short-circuits (no-op) when OPENAI_API_KEY is absent.
 */
import { prisma } from '@abroad-matrimony/db';
import { getEnv } from '@abroad-matrimony/config';
import { createChildLogger } from '@abroad-matrimony/logger';
import { isEmbeddingsConfigured, getAiClient } from './client.js';
import { chatComplete, isAnyChatProviderConfigured } from './multi-provider.js';
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
  habitKeys: string[];
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
      habitLogs: {
        select: { habitKey: true },
        distinct: ['habitKey'],
      },
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

  const habitKeys = user.habitLogs.map((h) => String(h.habitKey));

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
    habitKeys,
    habitCount: habitKeys.length,
    groupNames: user.groupMemberships.map((m) => m.group.name),
    eventCount: user.eventRsvps.length,
    promptResponseCount: user.promptResponses.length,
  };
}

// ── Text builders ─────────────────────────────────────────────────────────────

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

/** Text for story embedding — concatenated prompt answers. */
function buildStoryText(ctx: ProfileContext): string {
  if (ctx.storyPrompts.length === 0) return ctx.bio ?? ctx.name;
  return ctx.storyPrompts.map((s) => `${s.promptKey}: ${s.answer}`).join('\n\n');
}

/** Text for habits embedding — activity signals. */
function buildHabitsText(ctx: ProfileContext): string {
  const habits = ctx.habitKeys.length > 0
    ? `Active habits: ${ctx.habitKeys.join(', ')}.`
    : 'No habit tracking yet.';
  const voice = ctx.voiceIntroTranscript
    ? `Voice intro: ${ctx.voiceIntroTranscript.slice(0, 300)}`
    : '';
  const groups = ctx.groupNames.length > 0
    ? `Community groups: ${ctx.groupNames.join(', ')}.`
    : '';
  return [habits, groups, voice].filter(Boolean).join(' ');
}

// ── Vector persistence (raw SQL required for pgvector Unsupported columns) ───

async function saveVectors(
  userId: string,
  personality: number[],
  story: number[],
  habits: number[],
): Promise<void> {
  const toSql = (v: number[]) => `[${v.join(',')}]`;
  await prisma.$executeRaw`
    UPDATE profile_embeddings
    SET
      embedding        = ${toSql(personality)}::vector,
      "storyEmbedding" = ${toSql(story)}::vector,
      "habitsEmbedding" = ${toSql(habits)}::vector
    WHERE user_id = ${userId}
  `;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generates AI profile intelligence for a user and upserts the ProfileEmbedding record.
 * Saves 3 embedding vectors (personality, story, habits) via raw SQL.
 *
 * @returns ProfileEmbeddingDto if successful, null if AI not configured or profile not found.
 */
export async function generateProfileIntelligence(userId: string): Promise<ProfileEmbeddingDto | null> {
  if (!isAnyChatProviderConfigured()) {
    log.info('No AI provider configured — skipping profile intelligence', { userId });
    return null;
  }

  const ctx = await aggregateProfileContext(userId);
  if (!ctx) {
    log.warn('generateProfileIntelligence — profile not found', { userId });
    return null;
  }

  const env = getEnv();

  // ── Chat analysis (Groq → OpenAI fallback) ────────────────────────────────
  log.info('Generating profile intelligence via multi-provider AI', { userId });

  const raw = await chatComplete({
    system: 'You are a matchmaking analyst. Always respond with valid JSON.',
    messages: [{ role: 'user', content: buildIntelligencePrompt(ctx) }],
    jsonMode: true,
    temperature: 0.4,
    maxTokens: 600,
  });
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
    warmth:       parsed.vibeScores?.warmth       ?? 5,
    ambition:     parsed.vibeScores?.ambition     ?? 5,
    tradition:    parsed.vibeScores?.tradition    ?? 5,
    socialEnergy: parsed.vibeScores?.socialEnergy ?? 5,
    openness:     parsed.vibeScores?.openness     ?? 5,
  };
  const compatibilityNotes = parsed.compatibilityNotes ?? '';
  const recommendedContactWindow: ContactWindow = parsed.recommendedContactWindow ?? {
    startHour: 8,
    endHour: 22,
    timezone: deriveTimezone(ctx.country),
  };

  // ── 3 Embeddings in parallel (OpenAI only — Groq has no embedding API) ───
  if (!isEmbeddingsConfigured()) {
    log.info('OpenAI not configured — skipping embedding vectors, saving metadata only', { userId });
    await prisma.profileEmbedding.upsert({
      where: { userId },
      create: { userId, summary, traitTags, vibeScores: vibeScores as never, compatibilityNotes, recommendedContactWindow: recommendedContactWindow as never },
      update: { summary, traitTags, vibeScores: vibeScores as never, compatibilityNotes, recommendedContactWindow: recommendedContactWindow as never },
    });
    return { userId, summary, traitTags, vibeScores, compatibilityNotes, recommendedContactWindow, embedding: [] };
  }

  const client = getAiClient();
  log.info('Generating 3 embedding vectors', { userId, model: env.EMBEDDING_MODEL });

  const storyText  = buildStoryText(ctx);
  const habitsText = buildHabitsText(ctx);

  const [personalityEmb, storyEmb, habitsEmb] = await Promise.all([
    client.embeddings.create({ model: env.EMBEDDING_MODEL, input: summary }),
    client.embeddings.create({ model: env.EMBEDDING_MODEL, input: storyText }),
    client.embeddings.create({ model: env.EMBEDDING_MODEL, input: habitsText }),
  ]);

  const personalityVector = personalityEmb.data[0]?.embedding ?? [];
  const storyVector       = storyEmb.data[0]?.embedding ?? [];
  const habitsVector      = habitsEmb.data[0]?.embedding ?? [];

  // ── DB upsert (metadata) then vector update ────────────────────────────────
  await prisma.profileEmbedding.upsert({
    where: { userId },
    create: {
      userId,
      summary,
      traitTags,
      vibeScores:              vibeScores as unknown as Parameters<typeof prisma.profileEmbedding.create>[0]['data']['vibeScores'],
      compatibilityNotes,
      recommendedContactWindow: recommendedContactWindow as unknown as Parameters<typeof prisma.profileEmbedding.create>[0]['data']['recommendedContactWindow'],
    },
    update: {
      summary,
      traitTags,
      vibeScores:              vibeScores as unknown as Parameters<typeof prisma.profileEmbedding.update>[0]['data']['vibeScores'],
      compatibilityNotes,
      recommendedContactWindow: recommendedContactWindow as unknown as Parameters<typeof prisma.profileEmbedding.update>[0]['data']['recommendedContactWindow'],
    },
  });

  // Save all 3 vectors via raw SQL (Unsupported pgvector columns)
  if (personalityVector.length > 0) {
    await saveVectors(userId, personalityVector, storyVector, habitsVector);
  }

  log.info('ProfileEmbedding upserted with 3 vectors', { userId, traitTagCount: traitTags.length });

  return {
    userId,
    summary,
    traitTags,
    vibeScores,
    compatibilityNotes,
    recommendedContactWindow,
    embedding: personalityVector,
  };
}
