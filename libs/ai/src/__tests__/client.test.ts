/**
 * AI-001 tests — OpenAI client singleton + isAiConfigured().
 */

// ── Env mock ──────────────────────────────────────────────────────────────────
const mockEnv = {
  OPENAI_API_KEY: undefined as string | undefined,
  AI_MODEL: 'gpt-4o-mini',
  EMBEDDING_MODEL: 'text-embedding-3-small',
};

jest.mock('@abroad-matrimony/config', () => ({
  getEnv: () => mockEnv,
}));

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

// Mock OpenAI constructor
const mockOpenAIConstructor = jest.fn();
jest.mock('openai', () => ({
  __esModule: true,
  default: function MockOpenAI(opts: { apiKey: string }) {
    mockOpenAIConstructor(opts);
    return { _apiKey: opts.apiKey };
  },
}));

// Import AFTER mocks are set up
import { isAiConfigured, getAiClient, AiNotConfiguredError, _resetAiClient } from '../client.js';

beforeEach(() => {
  jest.clearAllMocks();
  _resetAiClient();
  mockEnv.OPENAI_API_KEY = undefined;
});

// ── isAiConfigured ────────────────────────────────────────────────────────────
describe('isAiConfigured()', () => {
  it('returns false when OPENAI_API_KEY is absent', () => {
    mockEnv.OPENAI_API_KEY = undefined;
    expect(isAiConfigured()).toBe(false);
  });

  it('returns false when OPENAI_API_KEY is empty string', () => {
    mockEnv.OPENAI_API_KEY = '';
    expect(isAiConfigured()).toBe(false);
  });

  it('returns true when OPENAI_API_KEY is set', () => {
    mockEnv.OPENAI_API_KEY = 'sk-test-key-123';
    expect(isAiConfigured()).toBe(true);
  });
});

// ── getAiClient ───────────────────────────────────────────────────────────────
describe('getAiClient()', () => {
  it('throws AiNotConfiguredError when API key is absent', () => {
    mockEnv.OPENAI_API_KEY = undefined;
    expect(() => getAiClient()).toThrow(AiNotConfiguredError);
    expect(() => getAiClient()).toThrow('AI_NOT_CONFIGURED');
  });

  it('returns an OpenAI instance when API key is set', () => {
    mockEnv.OPENAI_API_KEY = 'sk-test-key-456';
    const client = getAiClient();
    expect(client).toBeDefined();
    expect(mockOpenAIConstructor).toHaveBeenCalledWith({ apiKey: 'sk-test-key-456' });
  });

  it('returns the same singleton on repeated calls', () => {
    mockEnv.OPENAI_API_KEY = 'sk-test-key-789';
    const client1 = getAiClient();
    const client2 = getAiClient();
    expect(client1).toBe(client2);
    expect(mockOpenAIConstructor).toHaveBeenCalledTimes(1);
  });

  it('creates a new instance after _resetAiClient()', () => {
    mockEnv.OPENAI_API_KEY = 'sk-test-key-reset';
    getAiClient();
    _resetAiClient();
    getAiClient();
    expect(mockOpenAIConstructor).toHaveBeenCalledTimes(2);
  });
});

// ── AiNotConfiguredError ──────────────────────────────────────────────────────
describe('AiNotConfiguredError', () => {
  it('has correct name and message', () => {
    const err = new AiNotConfiguredError();
    expect(err.name).toBe('AiNotConfiguredError');
    expect(err.message).toBe('AI_NOT_CONFIGURED');
  });

  it('is an instance of Error', () => {
    expect(new AiNotConfiguredError()).toBeInstanceOf(Error);
  });
});
