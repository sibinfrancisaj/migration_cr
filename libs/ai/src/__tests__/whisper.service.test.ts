/**
 * AI-003 tests — Voice Intro Transcription (Whisper).
 */

// ── Env mock ──────────────────────────────────────────────────────────────────
const mockEnv = {
  OPENAI_API_KEY: 'sk-test',
  AI_MODEL: 'gpt-4o-mini',
  EMBEDDING_MODEL: 'text-embedding-3-small',
  REDIS_URL: 'redis://localhost:6379',
  AWS_ACCESS_KEY_ID: 'test-key',
  AWS_SECRET_ACCESS_KEY: 'test-secret',
  AWS_S3_BUCKET: 'test-bucket',
  AWS_REGION: 'us-east-1',
};

jest.mock('@abroad-matrimony/config', () => ({ getEnv: () => mockEnv }));
jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

// ── AI client mock ────────────────────────────────────────────────────────────
const mockTranscriptCreate = jest.fn();
jest.mock('../client.js', () => ({
  isAiConfigured: jest.fn(() => true),
  getAiClient: jest.fn(() => ({
    audio: { transcriptions: { create: mockTranscriptCreate } },
  })),
  AiNotConfiguredError: class AiNotConfiguredError extends Error {},
}));

// ── S3 mock ───────────────────────────────────────────────────────────────────
const mockS3Send = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: mockS3Send })),
  GetObjectCommand: jest.fn((params: unknown) => ({ _params: params })),
}));

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockProfileUpdate = jest.fn();
jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    profile: { updateMany: (...a: unknown[]) => mockProfileUpdate(...a) },
  },
}));

// ── Enqueue mock ──────────────────────────────────────────────────────────────
jest.mock('../enqueue-intelligence.js', () => ({
  enqueueProfileIntelligence: jest.fn().mockResolvedValue(undefined),
}));

// ── openai toFile mock ─────────────────────────────────────────────────────────
jest.mock('openai', () => ({
  toFile: jest.fn().mockResolvedValue({ name: 'voice-intro.mp3' }),
}));

import { transcribeVoiceIntro } from '../whisper.service.js';
import { isAiConfigured } from '../client.js';
import { enqueueProfileIntelligence } from '../enqueue-intelligence.js';

// Helper to create a mock S3 stream
function mockS3Stream(text: string) {
  const buf = Buffer.from(text);
  async function* gen() { yield buf; }
  return gen();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockS3Send.mockResolvedValue({ Body: mockS3Stream('fake-audio-bytes') });
  mockTranscriptCreate.mockResolvedValue({ text: 'Hello, I am Priya from London.' });
  mockProfileUpdate.mockResolvedValue({ count: 1 });
});

describe('transcribeVoiceIntro()', () => {
  it('returns transcript text on success', async () => {
    const result = await transcribeVoiceIntro('user-bbb', 'voice-intros/user-bbb/audio.mp3');
    expect(result).toBe('Hello, I am Priya from London.');
  });

  it('updates Profile.voiceIntroTranscript in DB', async () => {
    await transcribeVoiceIntro('user-bbb', 'voice-intros/user-bbb/audio.mp3');
    expect(mockProfileUpdate).toHaveBeenCalledWith({
      where: { userId: 'user-bbb' },
      data: { voiceIntroTranscript: 'Hello, I am Priya from London.' },
    });
  });

  it('enqueues profile intelligence job after transcription', async () => {
    await transcribeVoiceIntro('user-bbb', 'voice-intros/user-bbb/audio.mp3');
    expect(enqueueProfileIntelligence).toHaveBeenCalledWith('user-bbb', 'redis://localhost:6379');
  });

  it('returns empty string when AI is not configured', async () => {
    (isAiConfigured as jest.Mock).mockReturnValueOnce(false);
    const result = await transcribeVoiceIntro('user-bbb', 'voice-intros/user-bbb/audio.mp3');
    expect(result).toBe('');
    expect(mockTranscriptCreate).not.toHaveBeenCalled();
  });

  it('returns empty string when S3 download fails', async () => {
    mockS3Send.mockRejectedValueOnce(new Error('S3 timeout'));
    const result = await transcribeVoiceIntro('user-bbb', 'voice-intros/user-bbb/audio.mp3');
    expect(result).toBe('');
    expect(mockTranscriptCreate).not.toHaveBeenCalled();
  });

  it('returns empty string when Whisper API errors', async () => {
    mockTranscriptCreate.mockRejectedValueOnce(new Error('Whisper API error'));
    const result = await transcribeVoiceIntro('user-bbb', 'voice-intros/user-bbb/audio.mp3');
    expect(result).toBe('');
    expect(mockProfileUpdate).not.toHaveBeenCalled();
  });

  it('derives extension from s3Key for the filename', async () => {
    await transcribeVoiceIntro('user-bbb', 'voice-intros/user-bbb/audio.webm');
    expect(mockTranscriptCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'whisper-1', language: 'en' }),
    );
  });
});
