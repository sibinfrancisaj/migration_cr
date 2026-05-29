/**
 * @abroad-matrimony/ai — OpenAI integration for profile intelligence, Whisper transcription,
 * intro drop proposals, and event pre-connections.
 *
 * All exports are no-ops when OPENAI_API_KEY is absent (isAiConfigured() returns false).
 * ADR-017: gpt-4o-mini + text-embedding-3-small + Whisper via OpenAI SDK.
 */

// Client + configuration
export { isAiConfigured, getAiClient, AiNotConfiguredError, _resetAiClient } from './client.js';

// Services
export { generateProfileIntelligence } from './profile-intelligence.service.js';
export { transcribeVoiceIntro } from './whisper.service.js';
export { proposeIntroductionDrops } from './intro-grouping.service.js';
export { generateEventPreConnections } from './event-preconnect.service.js';

// Quiet window helpers (AI-006)
export { getContactWindow, isWithinWindow, msUntilWindowOpens } from './quiet-window.js';

// BullMQ worker + enqueue (AI-007)
export { createAiWorker, processProfileIntelligence, triggerProfileIntelligenceNow } from './ai.worker.js';
export { enqueueProfileIntelligence } from './enqueue-intelligence.js';

// Types
export type { ProfileEmbeddingDto, IntroductionDropDraftDto, VibeScores, ContactWindow, ProfileIntelligenceJobData } from './types/ai.types.js';
