import { generateUnsubscribeToken, processUnsubscribe, resubscribeEmail, UnsubscribeTokenInvalidError } from '../unsubscribe.service.js';

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    user: {
      update: jest.fn(),
    },
  },
}));

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

jest.mock('@abroad-matrimony/config', () => ({
  getEnv: jest.fn().mockReturnValue({
    JWT_ACCESS_SECRET: 'test-secret-at-least-32-characters-long',
  }),
}));

const { prisma } = jest.requireMock('@abroad-matrimony/db') as { prisma: { user: { update: jest.Mock } } };

describe('generateUnsubscribeToken', () => {
  it('returns a non-empty string token', () => {
    const token = generateUnsubscribeToken('user-123');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);
  });

  it('returns different tokens for different users', () => {
    const t1 = generateUnsubscribeToken('user-aaa');
    const t2 = generateUnsubscribeToken('user-bbb');
    expect(t1).not.toBe(t2);
  });

  it('token contains two dots (payload.signature format)', () => {
    const token = generateUnsubscribeToken('user-123');
    expect(token.split('.').length).toBe(2);
  });
});

describe('processUnsubscribe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.update.mockResolvedValue({ id: 'user-123', emailUnsubscribed: true });
  });

  it('accepts a valid token and sets emailUnsubscribed = true', async () => {
    const token = generateUnsubscribeToken('user-123');
    await processUnsubscribe(token);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: { emailUnsubscribed: true },
    });
  });

  it('throws UnsubscribeTokenInvalidError for a garbage token', async () => {
    await expect(processUnsubscribe('not-a-valid-token')).rejects.toThrow(UnsubscribeTokenInvalidError);
  });

  it('throws UnsubscribeTokenInvalidError for a tampered signature', async () => {
    const token = generateUnsubscribeToken('user-123');
    const tampered = token.slice(0, -4) + 'XXXX';
    await expect(processUnsubscribe(tampered)).rejects.toThrow(UnsubscribeTokenInvalidError);
  });
});

describe('resubscribeEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.update.mockResolvedValue({ id: 'user-123', emailUnsubscribed: false });
  });

  it('sets emailUnsubscribed = false', async () => {
    await resubscribeEmail('user-123');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: { emailUnsubscribed: false },
    });
  });
});
