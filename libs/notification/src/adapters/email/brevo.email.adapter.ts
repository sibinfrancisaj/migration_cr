import { createChildLogger } from '@abroad-matrimony/logger';
import { prisma } from '@abroad-matrimony/db';
import type { EmailAdapter } from './base.email.adapter.js';
import type { EmailPayload } from '../../types/notification.types.js';
import { generateUnsubscribeToken } from '../../unsubscribe.service.js';

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
  headers?: Record<string, string>;
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
    // CAN-SPAM / PROD-001: skip marketing emails for unsubscribed users
    if (payload.userId) {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { emailUnsubscribed: true },
      });
      if (user?.emailUnsubscribed) {
        log.info('Skipping email — user is unsubscribed', { userId: payload.userId });
        return;
      }
    }

    const unsubscribeToken = payload.userId ? generateUnsubscribeToken(payload.userId) : null;
    const unsubscribeUrl = unsubscribeToken
      ? `https://api.abroadmatrimony.com/api/v1/auth/unsubscribe?token=${unsubscribeToken}`
      : null;

    const body: BrevoSendEmailBody = {
      sender: { email: this.fromEmail, name: this.fromName },
      to: [{ email: payload.to, ...(payload.toName ? { name: payload.toName } : {}) }],
      subject: payload.subject,
      htmlContent: payload.htmlBody,
      ...(payload.textBody ? { textContent: payload.textBody } : {}),
      ...(unsubscribeUrl ? {
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      } : {}),
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
