import { createChildLogger } from '@abroad-matrimony/logger';
import type { EmailAdapter } from './base.email.adapter.js';
import type { EmailPayload } from '../../types/notification.types.js';

const log = createChildLogger({ module: 'notification:brevo' });

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

interface BrevoRecipient {
  email: string;
  name?: string;
}

interface BrevoSendEmailBody {
  sender: BrevoRecipient;
  to: BrevoRecipient[];
  subject: string;
  htmlContent: string;
  textContent?: string;
}

/**
 * Sends transactional emails via the Brevo REST API (v3).
 * Uses Node 22's built-in `fetch` — no extra HTTP client required.
 *
 * Reference: https://developers.brevo.com/reference/sendtransacemail
 */
export class BrevoEmailAdapter implements EmailAdapter {
  constructor(
    private readonly apiKey: string,
    private readonly fromEmail: string,
    private readonly fromName: string,
  ) {}

  async send(payload: EmailPayload): Promise<void> {
    const body: BrevoSendEmailBody = {
      sender: { email: this.fromEmail, name: this.fromName },
      to: [{ email: payload.to, ...(payload.toName ? { name: payload.toName } : {}) }],
      subject: payload.subject,
      htmlContent: payload.htmlBody,
      ...(payload.textBody ? { textContent: payload.textBody } : {}),
    };

    log.info('Sending transactional email via Brevo', { to: payload.to, subject: payload.subject });

    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '(no body)');
      log.error('Brevo email delivery failed', { status: res.status, body: text, to: payload.to });
      throw new Error(`Brevo email failed: HTTP ${res.status} — ${text}`);
    }

    log.info('Brevo email sent', { to: payload.to });
  }
}
