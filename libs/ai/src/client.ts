/**
 * OpenAI client singleton for libs/ai.
 *
 * All AI paths are guarded by `isAiConfigured()`.
 * When OPENAI_API_KEY is absent the helper returns false and every service
 * that calls it will short-circuit with a no-op (log + return null/empty).
 *
 * ADR-017: gpt-4o-mini (completions), text-embedding-3-small (embeddings), Whisper (voice).
 */
import OpenAI from 'openai';
import { getEnv } from '@abroad-matrimony/config';
import { createChildLogger } from '@abroad-matrimony/logger';

const log = createChildLogger({ module: 'ai:client' });

// ── Singleton ─────────────────────────────────────────────────────────────────

let _client: OpenAI | null = null;

/**
 * Returns true when OPENAI_API_KEY is present in the environment.
 * All AI service functions MUST check this before making any OpenAI call.
 */
export function isAiConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.OPENAI_API_KEY);
}

/**
 * Returns the OpenAI client singleton.
 * @throws {AiNotConfiguredError} When OPENAI_API_KEY is absent.
 */
export function getAiClient(): OpenAI {
  if (!isAiConfigured()) {
    throw new AiNotConfiguredError();
  }

  if (!_client) {
    const env = getEnv();
    _client = new OpenAI({ apiKey: env.OPENAI_API_KEY! });
    log.info('OpenAI client initialised', {
      model: env.AI_MODEL,
      embeddingModel: env.EMBEDDING_MODEL,
    });
  }

  return _client;
}

/**
 * Reset the singleton (test isolation only).
 * @internal
 */
export function _resetAiClient(): void {
  _client = null;
}

// ── Error classes ─────────────────────────────────────────────────────────────

/**
 * Thrown when an AI service function is called without OPENAI_API_KEY set.
 * Callers should catch this only in tests; production code uses `isAiConfigured()`
 * to short-circuit before calling `getAiClient()`.
 */
export class AiNotConfiguredError extends Error {
  constructor() {
    super('AI_NOT_CONFIGURED');
    this.name = 'AiNotConfiguredError';
  }
}
