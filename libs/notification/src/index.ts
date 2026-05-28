// Types
export {
  NotificationType,
} from './types/notification.types.js';
export type {
  EmailPayload,
  SmsPayload,
  PushPayload,
  NotificationJobData,
} from './types/notification.types.js';

// Email adapter
export { BrevoEmailAdapter, MockEmailAdapter, getEmailAdapter, _resetEmailAdapter } from './adapters/email/index.js';
export type { EmailAdapter } from './adapters/email/index.js';

// SMS adapter
export { TwilioSmsAdapter, MockSmsAdapter, getSmsAdapter, _resetSmsAdapter } from './adapters/sms/index.js';
export type { SmsAdapter } from './adapters/sms/index.js';

// Push adapter
export { FirebasePushAdapter, MockPushAdapter, getPushAdapter, _resetPushAdapter } from './adapters/push/index.js';
export type { PushAdapter } from './adapters/push/index.js';

// BullMQ worker
export {
  processNotification,
  createNotificationWorker,
  enqueueNotification,
} from './notification.worker.js';
