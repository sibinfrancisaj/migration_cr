import { exportUserData, deleteAccount, AccountAlreadyDeletedError } from '../gdpr.service.js';

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn() },
    profile: { findUnique: jest.fn(), updateMany: jest.fn() },
    realLifeAnswer: { findMany: jest.fn().mockResolvedValue([]) },
    storyPromptAnswer: { findMany: jest.fn().mockResolvedValue([]) },
    media: { findMany: jest.fn().mockResolvedValue([]) },
    habitLog: { findMany: jest.fn().mockResolvedValue([]) },
    promptResponse: { findMany: jest.fn().mockResolvedValue([]) },
    connection: { findMany: jest.fn().mockResolvedValue([]) },
    eventRsvp: { findMany: jest.fn().mockResolvedValue([]) },
    savedProfile: { findMany: jest.fn().mockResolvedValue([]) },
    userBlock: { findMany: jest.fn().mockResolvedValue([]) },
    verificationRequest: { findMany: jest.fn().mockResolvedValue([]) },
    membership: { findMany: jest.fn().mockResolvedValue([]) },
    diamondLedger: { findMany: jest.fn().mockResolvedValue([]) },
    checkIn: { findMany: jest.fn().mockResolvedValue([]) },
    refreshToken: { updateMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }),
}));

const { prisma } = jest.requireMock('@abroad-matrimony/db') as { prisma: Record<string, jest.Mock & { findUnique?: jest.Mock; findMany?: jest.Mock; updateMany?: jest.Mock }> };

describe('exportUserData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma['user'] as unknown as Record<string, jest.Mock>)['findUnique'].mockResolvedValue({ id: 'u1', phone: '+1234', email: 'a@b.com', createdAt: new Date() });
    (prisma['profile'] as unknown as Record<string, jest.Mock>)['findUnique'].mockResolvedValue({ name: 'Test', dateOfBirth: new Date(), gender: 'MALE', currentCity: 'London', currentCountry: 'GB' });
  });

  it('returns a DataExportSummaryDto with sections array and note', async () => {
    const result = await exportUserData('u1');
    expect(result.exportedAt).toBeDefined();
    expect(Array.isArray(result.sections)).toBe(true);
    expect(result.sections.length).toBe(15);
    expect(result.note).toContain('Firestore');
  });

  it('reflects 0 records when related tables are empty', async () => {
    const result = await exportUserData('u1');
    const habitSection = result.sections.find(s => s.startsWith('habit logs'));
    expect(habitSection).toContain('0 records');
  });
});

describe('deleteAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma['$transaction'] as jest.Mock).mockResolvedValue(undefined);
  });

  it('throws AccountAlreadyDeletedError if user is already deleted', async () => {
    (prisma['user'] as unknown as Record<string, jest.Mock>)['findUnique'].mockResolvedValue({ id: 'u1', deletedAt: new Date() });
    await expect(deleteAccount('u1')).rejects.toThrow(AccountAlreadyDeletedError);
  });

  it('throws AccountAlreadyDeletedError if user not found', async () => {
    (prisma['user'] as unknown as Record<string, jest.Mock>)['findUnique'].mockResolvedValue(null);
    await expect(deleteAccount('u1')).rejects.toThrow(AccountAlreadyDeletedError);
  });

  it('calls $transaction for active user', async () => {
    (prisma['user'] as unknown as Record<string, jest.Mock>)['findUnique'].mockResolvedValue({ id: 'u1', deletedAt: null });
    await deleteAccount('u1');
    expect(prisma['$transaction']).toHaveBeenCalled();
  });
});
