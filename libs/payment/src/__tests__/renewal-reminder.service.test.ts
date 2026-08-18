import { sendMembershipRenewalReminders } from '../renewal-reminder.service.js';

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    membership: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

jest.mock('@abroad-matrimony/notification', () => ({
  enqueueNotification: jest.fn(),
  NotificationType: { PUSH: 'PUSH', EMAIL: 'EMAIL', SMS: 'SMS' },
}));

jest.mock('@abroad-matrimony/config', () => ({
  getEnv: jest.fn().mockReturnValue({ REDIS_URL: 'redis://localhost:6379' }),
}));

const { prisma } = jest.requireMock('@abroad-matrimony/db') as {
  prisma: {
    membership: { findMany: jest.Mock; update: jest.Mock };
  };
};
const { enqueueNotification } = jest.requireMock('@abroad-matrimony/notification') as { enqueueNotification: jest.Mock };

const makeActiveMembership = (overrides = {}) => ({
  id: 'm1',
  expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
  user: {
    id: 'u1',
    email: 'user@example.com',
    emailUnsubscribed: false,
    devices: [{ pushToken: 'fcm-token' }],
    profile: { name: 'Alice' },
  },
  ...overrides,
});

describe('sendMembershipRenewalReminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.membership.update.mockResolvedValue({});
  });

  it('returns { reminded: 0, skipped: 0 } when no expiring memberships', async () => {
    prisma.membership.findMany.mockResolvedValue([]);
    const result = await sendMembershipRenewalReminders();
    expect(result).toEqual({ reminded: 0, skipped: 0 });
    expect(enqueueNotification).not.toHaveBeenCalled();
  });

  it('sends push and email for a membership with token + email', async () => {
    prisma.membership.findMany.mockResolvedValue([makeActiveMembership()]);
    const result = await sendMembershipRenewalReminders();
    expect(result.reminded).toBe(1);
    expect(result.skipped).toBe(0);
    expect(enqueueNotification).toHaveBeenCalledTimes(2); // push + email
  });

  it('skips email when user has emailUnsubscribed = true', async () => {
    prisma.membership.findMany.mockResolvedValue([
      makeActiveMembership({ user: { id: 'u1', email: 'a@b.com', emailUnsubscribed: true, devices: [], profile: { name: 'A' } } }),
    ]);
    await sendMembershipRenewalReminders();
    expect(enqueueNotification).not.toHaveBeenCalled();
  });

  it('skips push when user has no push token', async () => {
    prisma.membership.findMany.mockResolvedValue([
      makeActiveMembership({ user: { id: 'u1', email: 'a@b.com', emailUnsubscribed: false, devices: [], profile: { name: 'A' } } }),
    ]);
    await sendMembershipRenewalReminders();
    expect(enqueueNotification).toHaveBeenCalledTimes(1); // email only
  });

  it('stamps renewalReminderSentAt after sending', async () => {
    prisma.membership.findMany.mockResolvedValue([makeActiveMembership()]);
    await sendMembershipRenewalReminders();
    expect(prisma.membership.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'm1' }, data: expect.objectContaining({ renewalReminderSentAt: expect.any(Date) }) }),
    );
  });

  it('counts as skipped when enqueueNotification throws', async () => {
    prisma.membership.findMany.mockResolvedValue([makeActiveMembership()]);
    enqueueNotification.mockRejectedValue(new Error('Redis unavailable'));
    const result = await sendMembershipRenewalReminders();
    expect(result.skipped).toBe(1);
    expect(result.reminded).toBe(0);
  });
});
