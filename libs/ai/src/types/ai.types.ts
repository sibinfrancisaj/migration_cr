/**
 * AI service types — DTOs for profile intelligence, intro drops, event pre-connections.
 * These are pure TypeScript types; no runtime deps.
 */

// ── Profile Intelligence ──────────────────────────────────────────────────────

/** Five personality dimensions scored 1–10 by GPT based on profile signals. */
export interface VibeScores {
  warmth: number;
  ambition: number;
  tradition: number;
  socialEnergy: number;
  openness: number;
}

/**
 * Recommended quiet window for notifications.
 * AI derives this from country/city → IANA timezone + profession context.
 * For seeded profiles, set directly from country without an AI call.
 */
export interface ContactWindow {
  /** First hour of the delivery window (0–23, local time). */
  startHour: number;
  /** Last hour of the delivery window (inclusive, 0–23, local time). */
  endHour: number;
  /** IANA timezone string — e.g. "Europe/London", "Asia/Kolkata". */
  timezone: string;
}

/**
 * Full AI-generated profile intelligence snapshot.
 * Written to the `profile_embeddings` table via Prisma upsert.
 */
export interface ProfileEmbeddingDto {
  userId: string;
  /** 150-word personality description written for the admin dashboard. */
  summary: string;
  /** 8–12 trait tags from the canonical taxonomy. */
  traitTags: string[];
  vibeScores: VibeScores;
  /** 2–3 sentence compatibility-oriented notes for matching context. */
  compatibilityNotes: string;
  recommendedContactWindow: ContactWindow;
  /** 1536-dimensional OpenAI text-embedding-3-small vector. */
  embedding: number[];
}

// ── Intro Drop Drafts ─────────────────────────────────────────────────────────

/**
 * A single AI-proposed introduction drop (status: DRAFT).
 * Admin must approve before it becomes SCHEDULED → LIVE.
 */
export interface IntroductionDropDraftDto {
  /** Human-readable theme name, e.g. "Gujarati Professionals in London". */
  name: string;
  /** AI rationale for this grouping (shown to admin). */
  rationale: string;
  /** User IDs AI selected for this pool. */
  memberIds: string[];
  /** AI recommendation for release date (ISO string). */
  releaseRecommendation: string;
  /** Region identifier used to scope the query. */
  region: string;
}

// ── AI Job Payload ────────────────────────────────────────────────────────────

/** BullMQ job payload for PROFILE_INTELLIGENCE_UPDATE jobs. */
export interface ProfileIntelligenceJobData {
  userId: string;
}
