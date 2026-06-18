/**
 * AI-003 — Voice Intro Transcription (Whisper).
 *
 * Downloads a voice intro audio file from S3, transcribes it via OpenAI Whisper,
 * stores the transcript in Profile.voiceIntroTranscript, and enqueues a
 * profile intelligence update job.
 *
 * Short-circuits (no-op) when OPENAI_API_KEY is absent.
 */
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@abroad-matrimony/db';
import { getEnv } from '@abroad-matrimony/config';
import { createChildLogger } from '@abroad-matrimony/logger';
import { isAiConfigured, getAiClient } from './client.js';
import { enqueueProfileIntelligence } from './enqueue-intelligence.js';
import { toFile } from 'openai';

const log = createChildLogger({ module: 'ai:whisper' });

// ── S3 download helper ────────────────────────────────────────────────────────

async function downloadFromS3(s3Key: string): Promise<Buffer> {
  const env = getEnv();

  if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY || !env.AWS_S3_BUCKET) {
    throw new Error('AWS credentials not configured for Whisper S3 download');
  }

  const client = new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const cmd = new GetObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: s3Key });
  const response = await client.send(cmd);

  if (!response.Body) throw new Error(`Empty S3 response for key: ${s3Key}`);

  // Node.js readable stream → Buffer
  const chunks: Buffer[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Transcribes a voice intro audio file using OpenAI Whisper.
 *
 * @param userId  User whose voice intro this belongs to.
 * @param s3Key   S3 object key of the audio file.
 * @returns The transcript text, or empty string if AI is not configured.
 */
export async function transcribeVoiceIntro(userId: string, s3Key: string): Promise<string> {
  if (!isAiConfigured()) {
    log.info('AI not configured — skipping voice intro transcription', { userId });
    return '';
  }

  log.info('transcribeVoiceIntro — downloading audio from S3', { userId, s3Key });

  let audioBuffer: Buffer;
  try {
    audioBuffer = await downloadFromS3(s3Key);
  } catch (err) {
    log.error('transcribeVoiceIntro — S3 download failed', { userId, s3Key, err });
    return '';
  }

  const client = getAiClient();

  // Determine filename from key for Whisper file type hint
  const ext = s3Key.split('.').pop() ?? 'mp3';
  const filename = `voice-intro.${ext}`;
  const mimeType = ext === 'webm' ? 'audio/webm' : ext === 'aac' ? 'audio/aac' : 'audio/mpeg';

  log.info('transcribeVoiceIntro — calling Whisper API', { userId, filename });

  let transcript: string;
  try {
    const audioFile = await toFile(audioBuffer, filename, { type: mimeType });
    const response = await client.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile,
      language: 'en',
    });
    transcript = response.text;
  } catch (err) {
    log.error('transcribeVoiceIntro — Whisper API error', { userId, err });
    return '';
  }

  // Store transcript on profile
  await prisma.profile.updateMany({
    where: { userId },
    data: { voiceIntroTranscript: transcript },
  });

  log.info('transcribeVoiceIntro — transcript saved', { userId, length: transcript.length });

  // Enqueue profile intelligence update (debounced 60s)
  const env = getEnv();
  await enqueueProfileIntelligence(userId, env.REDIS_URL);

  return transcript;
}
