import { getNotificationPreferences, updateNotificationPreferences } from '../preferences.service.js';

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    notificationPreference: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

const { prisma } = jest.requireMock('@abroad-matrimony/db') as {
  prisma: {
    notificationPreference: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };
};

describe('getNotificationPreferences', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns all-enabled defaults when no row exists', async () => {
    prisma.notificationPreference.findUnique.mockResolvedValue(null);
    const prefs = await getNotificationPreferences('u1');
    expect(prefs).toEqual({ emailEnabled: true, smsEnabled: true, pushEnabled: true, marketingEnabled: true });
  });

  it('returns stored values when row exists', async () => {
    prisma.notificationPreference.findUnique.mockResolvedValue({
      emailEnabled: false, smsEnabled: true, pushEnabled: false, marketingEnabled: false,
    });
    const prefs = await getNotificationPreferences('u1');
    expect(prefs.emailEnabled).toBe(false);
    expect(prefs.pushEnabled).toBe(false);
  });
});

describe('updateNotificationPreferences', () => {
  beforeEach(() => jest.clearAllMocks());

  it('upserts with supplied values', async () => {
    prisma.notificationPreference.findUnique.mockResolvedValue(null);
    prisma.notificationPreference.upsert.mockResolvedValue({
      emailEnabled: false, smsEnabled: true, pushEnabled: true, marketingEnabled: true,
    });
    const result = await updateNotificationPreferences('u1', { emailEnabled: false });
    expect(prisma.notificationPreference.upsert).toHaveBeenCalled();
    expect(result.emailEnabled).toBe(false);
  });

  it('merges with existing values on partial update', async () => {
    prisma.notificationPreference.findUnique.mockResolvedValue({
      emailEnabled: true, smsEnabled: true, pushEnabled: true, marketingEnabled: true,
    });
    prisma.notificationPreference.upsert.mockResolvedValue({
      emailEnabled: true, smsEnabled: false, pushEnabled: true, marketingEnabled: true,
    });
    const result = await updateNotificationPreferences('u1', { smsEnabled: false });
    const callArgs = prisma.notificationPreference.upsert.mock.calls[0]?.[0] as { update: Record<string, boolean> };
    expect(callArgs.update).toEqual({ smsEnabled: false });
    expect(result.smsEnabled).toBe(false);
  });
});
