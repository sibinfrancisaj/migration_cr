import { createChildLogger } from '@abroad-matrimony/logger';

const log = createChildLogger({ module: 'ai:fallback' });

export interface AiFallbackOptions<T> {
  /** Human label for logs — e.g. 'semantic-search', 'vibe-score', 'cf-recommendations'. */
  name: string;
  /** The AI call. Must resolve or reject within timeoutMs. */
  primary: () => Promise<T>;
  /**
   * Deterministic fallback — MUST NOT call any AI or external service.
   * Called when primary() throws, rejects, or exceeds timeoutMs.
   */
  fallback: () => T | Promise<T>;
  /** Abort primary after this many ms. Default 5 000. */
  timeoutMs?: number;
  /** Optional context merged into the warning log entry. */
  context?: Record<string, unknown>;
}

/**
 * Runs `primary()` with a hard timeout. On any failure — error, timeout, or
 * rejection — logs a structured warning and returns `fallback()` instead.
 *
 * The caller never needs to know whether AI was used. The returned value is
 * always the same shape; the origin differs.
 *
 * Design rule: fallback() must be synchronous or near-instant — it must never
 * call OpenAI, pgvector, Redis, or any external service.
 */
export async function withAiFallback<T>(opts: AiFallbackOptions<T>): Promise<T> {
  const { name, primary, fallback, timeoutMs = 5_000, context } = opts;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`[ai:timeout] ${name} exceeded ${timeoutMs}ms`)), timeoutMs),
  );

  try {
    return await Promise.race([primary(), timeoutPromise]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn('AI path failed — using deterministic fallback', {
      name,
      message,
      ...context,
    });
    return fallback();
  }
}
