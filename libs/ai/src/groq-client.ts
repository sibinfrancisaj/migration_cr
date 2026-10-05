/**
 * Groq client singleton for libs/ai.
 *
 * Groq provides an OpenAI-compatible API at https://api.groq.com/openai/v1,
 * so we reuse the `openai` SDK with a custom baseURL — no extra package needed.
 *
 * Models available (free tier, generous limits):
 *   - llama-3.3-70b-versatile  — best quality for complex tasks (profile analysis, narratives)
 *   - llama-3.1-8b-instant     — fast, lighter tasks
 *   - whisper-large-v3         — audio transcription (faster + free vs OpenAI Whisper)
 *
 * Embeddings: Groq does NOT support text embeddings — keep using OpenAI for those.
 */
import OpenAI from 'openai';
import { getEnv } from '@abroad-matrimony/config';
import { createChildLogger } from '@abroad-matrimony/logger';

const log = createChildLogger({ module: 'ai:groq-client' });

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

let _groqClient: OpenAI | null = null;

export function isGroqConfigured(): boolean {
  return Boolean(getEnv().GROQ_API_KEY);
}

export function getGroqClient(): OpenAI {
  if (!isGroqConfigured()) throw new GroqNotConfiguredError();

  if (!_groqClient) {
    const env = getEnv();
    _groqClient = new OpenAI({
      apiKey: env.GROQ_API_KEY!,
      baseURL: GROQ_BASE_URL,
    });
    log.info('Groq client initialised', {
      model: env.GROQ_MODEL,
      whisperModel: env.GROQ_WHISPER_MODEL,
    });
  }

  return _groqClient;
}

export function _resetGroqClient(): void {
  _groqClient = null;
}

export class GroqNotConfiguredError extends Error {
  constructor() {
    super('GROQ_NOT_CONFIGURED');
    this.name = 'GroqNotConfiguredError';
  }
}
