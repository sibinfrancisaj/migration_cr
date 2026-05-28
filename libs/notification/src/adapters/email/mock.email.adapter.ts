import { createChildLogger } from '@abroad-matrimony/logger';
import type { EmailAdapter } from './base.email.adapter.js';
import type { EmailPayload } from '../../types/notification.types.js';

const log = createChildLogger({ module: 'notification:mock-email' });

/**
 * No-op email adapter for dev / test environments.
 * Logs the email details instead of calling the Brevo API.
 * Tracks sent emails in-memory for test assertions.
 */
export class MockEmailAdapter implements EmailAdapter {
  /** Emails sent since last `_reset()`. Useful for test assertions. */
  public readonly sent: EmailPayload[] = [];

  async send(payload: EmailPayload): Promise<void> {
    this.sent.push(payload);
    log.info('[MOCK] Email not sent — Brevo not configured', {
      to:      payload.to,
      subject: payload.subject,
    });
  }

  /** Clear the sent log between tests. */
  _reset(): void {
    this.sent.length = 0;
  }
}
