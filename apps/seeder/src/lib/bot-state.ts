/**
 * Bot persona and state persistence.
 *
 * Each seeded user gets a deterministic persona derived from their userId hash.
 * State (pending IDs, last action time) is persisted in Redis so the bot
 * "remembers" what it was doing between activity job runs.
 */
import IORedis from 'ioredis';
import { getSeederEnv } from './seeder-env.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BotPersona {
  /** 0–1: how often they initiate connections and new activity */
  aggressiveness: number;
  /** 0–1: how often they post, comment, and resonate */
  chattiness: number;
  /** 0–1: how consistently they log habits */
  habitConsistency: number;
  /** 0–1: probability of accepting an incoming connection request */
  connectionAcceptRate: number;
  /** 0–1: probability of accepting an introduction */
  introAcceptRate: number;
}

export interface BotState {
  persona: BotPersona;
  lastActionAt: string | null;
  /** Connection IDs this bot sent that are still PENDING */
  sentConnectionIds: string[];
}

// ── Redis key ─────────────────────────────────────────────────────────────────

const BOT_STATE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

function botStateKey(userId: string): string {
  return `seeder:bot:${userId}`;
}

// ── Persona generation ────────────────────────────────────────────────────────

/**
 * Deterministic persona from userId so the same user always has
 * the same personality across restarts.
 */
export function generatePersona(userId: string): BotPersona {
  // Simple hash: sum char codes at strategic positions
  const chars = userId.replace(/-/g, '');
  const h = (offset: number): number => {
    let v = 0;
    for (let i = offset; i < chars.length; i += 5) {
      v = (v * 31 + (chars.charCodeAt(i) || 0)) & 0xffff;
    }
    return v / 0xffff; // 0–1
  };

  return {
    aggressiveness:      clamp(h(0), 0.2, 0.9),
    chattiness:          clamp(h(1), 0.1, 0.95),
    habitConsistency:    clamp(h(2), 0.1, 1.0),
    connectionAcceptRate: clamp(h(3), 0.5, 0.95),
    introAcceptRate:     clamp(h(4), 0.5, 0.90),
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

// ── Redis client ──────────────────────────────────────────────────────────────

let _redis: IORedis | null = null;

function getRedis(): IORedis {
  if (_redis) return _redis;
  _redis = new IORedis(getSeederEnv().REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
  return _redis;
}

export async function closeBotStateRedis(): Promise<void> {
  if (_redis) { await _redis.quit(); _redis = null; }
}

// ── State accessors ───────────────────────────────────────────────────────────

export async function getBotState(userId: string): Promise<BotState> {
  try {
    const redis = getRedis();
    const raw = await redis.get(botStateKey(userId));
    if (raw) {
      return JSON.parse(raw) as BotState;
    }
  } catch {
    // Redis unavailable — fall back to fresh state
  }

  return {
    persona: generatePersona(userId),
    lastActionAt: null,
    sentConnectionIds: [],
  };
}

export async function saveBotState(userId: string, state: BotState): Promise<void> {
  try {
    const redis = getRedis();
    await redis.set(botStateKey(userId), JSON.stringify(state), 'EX', BOT_STATE_TTL_SECONDS);
  } catch {
    // Non-fatal — state just won't persist across runs
  }
}
