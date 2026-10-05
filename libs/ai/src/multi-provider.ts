/**
 * Multi-provider AI completion utility.
 *
 * Strategy (in order):
 *   1. Groq  — primary; free tier, llama-3.3-70b-versatile
 *   2. OpenAI — fallback; gpt-4o-mini
 *   3. Throws AiNotConfiguredError if neither is configured
 *
 * For audio transcription (Whisper):
 *   1. Groq whisper-large-v3 — primary (faster, free)
 *   2. OpenAI whisper-1      — fallback
 *
 * Embeddings: always OpenAI only (Groq has no embedding API).
 */
import OpenAI, { toFile } from 'openai';
import { getEnv } from '@abroad-matrimony/config';
import { createChildLogger } from '@abroad-matrimony/logger';
import { isGroqConfigured, getGroqClient } from './groq-client.js';
import { isAiConfigured, getAiClient, AiNotConfiguredError } from './client.js';

const log = createChildLogger({ module: 'ai:multi-provider' });

export interface ChatCompleteParams {
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  /** System prompt (shorthand — prepended before messages if provided). */
  system?: string;
  /** Max output tokens. Default 800. */
  maxTokens?: number;
  /** Temperature 0–2. Default 0.4. */
  temperature?: number;
  /** Force JSON object response. Default false. */
  jsonMode?: boolean;
  /** Override Groq model (default: env.GROQ_MODEL). */
  groqModel?: string;
  /** Override OpenAI model (default: env.AI_MODEL). */
  openaiModel?: string;
}

/**
 * Calls Groq first, falls back to OpenAI. Throws if neither is configured.
 * Never use this on the hot HTTP path — always call fire-and-forget from a BullMQ job.
 */
export async function chatComplete(params: ChatCompleteParams): Promise<string> {
  const env = getEnv();

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = params.system
    ? [{ role: 'system', content: params.system }, ...params.messages]
    : params.messages;

  const responseFormat = params.jsonMode
    ? { type: 'json_object' as const }
    : undefined;

  // ── 1. Groq ───────────────────────────────────────────────────────────────
  if (isGroqConfigured()) {
    try {
      const client = getGroqClient();
      const model = params.groqModel ?? env.GROQ_MODEL;
      log.debug('chatComplete → Groq', { model });

      const response = await client.chat.completions.create({
        model,
        messages,
        max_tokens: params.maxTokens ?? 800,
        temperature: params.temperature ?? 0.4,
        ...(responseFormat ? { response_format: responseFormat } : {}),
      });

      return response.choices[0]?.message?.content ?? '';
    } catch (err) {
      log.warn('chatComplete — Groq failed, falling back to OpenAI', { err });
    }
  }

  // ── 2. OpenAI ────────────────────────────────────────────────────────────
  if (isAiConfigured()) {
    const client = getAiClient();
    const model = params.openaiModel ?? env.AI_MODEL;
    log.debug('chatComplete → OpenAI', { model });

    const response = await client.chat.completions.create({
      model,
      messages,
      max_tokens: params.maxTokens ?? 800,
      temperature: params.temperature ?? 0.4,
      ...(responseFormat ? { response_format: responseFormat } : {}),
    });

    return response.choices[0]?.message?.content ?? '';
  }

  throw new AiNotConfiguredError();
}

// ── Audio transcription ───────────────────────────────────────────────────────

export interface TranscribeParams {
  audioBuffer: Buffer;
  filename: string;
  mimeType: string;
  language?: string;
}

/**
 * Transcribes audio via Groq Whisper (primary) or OpenAI Whisper (fallback).
 * Returns empty string on any failure — never throws.
 */
export async function transcribeAudio(params: TranscribeParams): Promise<string> {
  const env = getEnv();
  const audioFile = await toFile(params.audioBuffer, params.filename, { type: params.mimeType });

  // ── 1. Groq Whisper ───────────────────────────────────────────────────────
  if (isGroqConfigured()) {
    try {
      const client = getGroqClient();
      log.debug('transcribeAudio → Groq', { model: env.GROQ_WHISPER_MODEL });

      const response = await client.audio.transcriptions.create({
        model: env.GROQ_WHISPER_MODEL,
        file: audioFile,
        language: params.language ?? 'en',
      });

      return response.text;
    } catch (err) {
      log.warn('transcribeAudio — Groq Whisper failed, falling back to OpenAI', { err });
    }
  }

  // ── 2. OpenAI Whisper ─────────────────────────────────────────────────────
  if (isAiConfigured()) {
    try {
      const client = getAiClient();
      log.debug('transcribeAudio → OpenAI Whisper');

      const response = await client.audio.transcriptions.create({
        model: 'whisper-1',
        file: audioFile,
        language: params.language ?? 'en',
      });

      return response.text;
    } catch (err) {
      log.warn('transcribeAudio — OpenAI Whisper failed', { err });
    }
  }

  return '';
}

/**
 * Returns true when at least one chat-completion provider is configured.
 * Use this instead of `isAiConfigured()` when Groq alone is sufficient.
 */
export function isAnyChatProviderConfigured(): boolean {
  return isGroqConfigured() || isAiConfigured();
}
