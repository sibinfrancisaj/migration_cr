import type { SmsPayload } from '../../types/notification.types.js';

/**
 * Cloud-agnostic SMS delivery interface.
 *
 * Production: TwilioSmsAdapter (Twilio Programmable Messaging).
 * Dev / test: MockSmsAdapter (logs, no network).
 *
 * Note: Twilio Verify (OTP) lives in libs/auth — this adapter is for
 * general-purpose transactional/notification SMS (e.g. "Your intro drop is live").
 */
export interface SmsAdapter {
  /**
   * Send a plain-text SMS.
   * Throws on delivery failure.
   */
  send(payload: SmsPayload): Promise<void>;
}
