/**
 * Async narrative generator — called from a BullMQ job, never on the hot path.
 *
 * Tries Groq (llama-3.3-70b-versatile) first, falls back to OpenAI.
 * On any failure: leaves narrative null — the rule-based summary is always present.
 */
import { createChildLogger } from '@abroad-matrimony/logger';
import type { DecisionLogEventType } from './types/decision-log.types.js';
import {
  formatMatchScoreNarrativePrompt,
  formatDiscoveryFeedNarrativePrompt,
  formatImplicitSignalNarrativePrompt,
  formatIntroPairingNarrativePrompt,
  formatDropReleasedNarrativePrompt,
} from './formatters/index.js';

const log = createChildLogger({ module: 'decision-log:narrative' });

/** Maps each event type to the appropriate prompt builder. */
function buildNarrativePrompt(
  eventType: DecisionLogEventType,
  data: Record<string, unknown>,
): string | null {
  try {
    switch (eventType) {
      case 'MATCH_SCORE_COMPUTED':
      case 'MATCH_SCORE_UPDATED':
        return formatMatchScoreNarrativePrompt(data as never);
      case 'DISCOVERY_FEED_GENERATED':
        return formatDiscoveryFeedNarrativePrompt(data as never);
      case 'IMPLICIT_SIGNAL_APPLIED':
        return formatImplicitSignalNarrativePrompt(data as never);
      case 'INTRO_PAIRING_CREATED':
        return formatIntroPairingNarrativePrompt(data as never);
      case 'INTRO_DROP_RELEASED':
        return formatDropReleasedNarrativePrompt(data as never);
      default:
        // Generic fallback — ask LLM to explain the raw JSON
        return `Explain the following algorithmic decision event in 3–5 plain-English sentences for a non-technical admin. Event type: ${eventType}. Raw data: ${JSON.stringify(data, null, 2).slice(0, 800)}`;
    }
  } catch {
    return null;
  }
}

/**
 * Generates a plain-English narrative for a decision log entry using Groq (primary)
 * or OpenAI (fallback). Returns null when no provider is configured or on any error.
 */
export async function generateNarrative(
  logId: string,
  eventType: DecisionLogEventType,
  data: Record<string, unknown>,
): Promise<string | null> {
  const prompt = buildNarrativePrompt(eventType, data);
  if (!prompt) return null;

  try {
    const ai = await import('@abroad-matrimony/ai');
    if (!ai.isAnyChatProviderConfigured()) {
      log.debug('narrative-generator — no AI provider, skipping', { logId, eventType });
      return null;
    }

    const narrative = await ai.chatComplete({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 400,
      temperature: 0.3,
      groqModel: 'llama-3.1-8b-instant', // faster model for narrative generation (async, not quality-critical)
    });

    log.debug('narrative-generator — success', { logId, eventType, length: narrative.length });
    return narrative.trim() || null;
  } catch (err) {
    log.warn('narrative-generator — failed (non-fatal)', { logId, eventType, err });
    return null;
  }
}
