import { processNotification } from '../notification.worker.js';
import { NotificationType } from '../types/notification.types.js';
import type { NotificationJobData } from '../types/notification.types.js';

// ── Mock dependencies ─────────────────────────────────────────────────────────

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('@abroad-matrimony/shared', () => ({
  QUEUE_NAMES: { NOTIFICATION: 'notification', MATCHING: 'matching' },
}));

const mockEmailSend = jest.fn();
const mockSmsSend   = jest.fn();
const mockPushSend  = jest.fn();

jest.mock('../adapters/email/index.js', () => ({
  getEmailAdapter: () => ({ send: mockEmailSend }),
}));

jest.mock('../adapters/sms/index.js', () => ({
  getSmsAdapter: () => ({ send: mockSmsSend }),
}));

jest.mock('../adapters/push/index.js', () => ({
  getPushAdapter: () => ({ send: mockPushSend }),
}));

// ── processNotification tests ─────────────────────────────────────────────────

describe('processNotification()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── EMAIL ──────────────────────────────────────────────────────────────────

  describe('EMAIL type', () => {
    const job: NotificationJobData = {
      type: NotificationType.EMAIL,
      payload: {
        to:       'user@example.com',
        subject:  'Welcome!',
        htmlBody: '<p>Hello</p>',
      },
    };

    it('dispatches to email adapter', async () => {
      mockEmailSend.mockResolvedValue(undefined);
      await processNotification(job);
      expect(mockEmailSend).toHaveBeenCalledWith(job.payload);
      expect(mockSmsSend).not.toHaveBeenCalled();
      expect(mockPushSend).not.toHaveBeenCalled();
    });

    it('propagates email adapter errors', async () => {
      mockEmailSend.mockRejectedValue(new Error('Brevo down'));
      await expect(processNotification(job)).rejects.toThrow('Brevo down');
    });
  });

  // ── SMS ────────────────────────────────────────────────────────────────────

  describe('SMS type', () => {
    const job: NotificationJobData = {
      type: NotificationType.SMS,
      payload: {
        to:   '+919876543210',
        body: 'Your intro drop is live!',
      },
    };

    it('dispatches to SMS adapter', async () => {
      mockSmsSend.mockResolvedValue(undefined);
      await processNotification(job);
      expect(mockSmsSend).toHaveBeenCalledWith(job.payload);
      expect(mockEmailSend).not.toHaveBeenCalled();
      expect(mockPushSend).not.toHaveBeenCalled();
    });

    it('propagates SMS adapter errors', async () => {
      mockSmsSend.mockRejectedValue(new Error('Twilio down'));
      await expect(processNotification(job)).rejects.toThrow('Twilio down');
    });
  });

  // ── PUSH ───────────────────────────────────────────────────────────────────

  describe('PUSH type', () => {
    const job: NotificationJobData = {
      type: NotificationType.PUSH,
      payload: {
        deviceToken: 'fcm-token-abc',
        title:       'New message!',
        body:        'You have a new message from Priya.',
        data:        { screen: 'chat', userId: 'user-123' },
      },
    };

    it('dispatches to push adapter', async () => {
      mockPushSend.mockResolvedValue(undefined);
      await processNotification(job);
      expect(mockPushSend).toHaveBeenCalledWith(job.payload);
      expect(mockEmailSend).not.toHaveBeenCalled();
      expect(mockSmsSend).not.toHaveBeenCalled();
    });

    it('propagates push adapter errors', async () => {
      mockPushSend.mockRejectedValue(new Error('FCM quota exceeded'));
      await expect(processNotification(job)).rejects.toThrow('FCM quota exceeded');
    });

    it('dispatches push without optional data field', async () => {
      mockPushSend.mockResolvedValue(undefined);
      const jobNoData: NotificationJobData = {
        type: NotificationType.PUSH,
        payload: { deviceToken: 'fcm-token-xyz', title: 'Hi', body: 'Hello' },
      };
      await processNotification(jobNoData);
      expect(mockPushSend).toHaveBeenCalledWith(jobNoData.payload);
    });
  });
});
