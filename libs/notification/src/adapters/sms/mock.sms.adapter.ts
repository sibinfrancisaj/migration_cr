import { createChildLogger } from '@abroad-matrimony/logger';
import type { SmsAdapter } from './base.sms.adapter.js';
import type { SmsPayload } from '../../types/notification.types.js';

const log = createChildLogger({ module: 'notification:mock-sms' });

/**
 * No-op SMS adapter for dev / test environments.
 * Logs instead of calling Twilio.
 * Tracks sent messages in-memory for test assertions.
 */
export class MockSmsAdapter implements SmsAdapter {
  /** SMS messages sent since last `_reset()`. */
  public readonly sent: SmsPayload[] = [];

  async send(payload: SmsPayload): Promise<void> {
    this.sent.push(payload);
    log.info('[MOCK] SMS not sent — Twilio SMS not configured', {
      to:   payload.to.slice(0, 6) + '****',
      body: payload.body,
    });
  }

  /** Clear the sent log between tests. */
  _reset(): void {
    this.sent.length = 0;
  }
}
