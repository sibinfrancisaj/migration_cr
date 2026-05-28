import type { EmailPayload } from '../../types/notification.types.js';

/**
 * Cloud-agnostic email delivery interface.
 *
 * Production: BrevoEmailAdapter (Brevo transactional email REST API).
 * Dev / test: MockEmailAdapter (logs to logger, no network).
 */
export interface EmailAdapter {
  /**
   * Send a transactional email.
   * Throws on delivery failure (transport errors, invalid address, etc.).
   */
  send(payload: EmailPayload): Promise<void>;
}
