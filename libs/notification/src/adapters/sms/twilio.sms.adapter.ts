import twilio from 'twilio';
import { createChildLogger } from '@abroad-matrimony/logger';
import type { SmsAdapter } from './base.sms.adapter.js';
import type { SmsPayload } from '../../types/notification.types.js';

const log = createChildLogger({ module: 'notification:twilio-sms' });

/**
 * Sends notification SMS via Twilio Programmable Messaging.
 *
 * Distinct from libs/auth TwilioOtpAdapter which uses Twilio Verify.
 * This uses the standard Messages API: client.messages.create().
 */
export class TwilioSmsAdapter implements SmsAdapter {
  private readonly client: ReturnType<typeof twilio>;

  constructor(
    accountSid: string,
    authToken: string,
    private readonly fromNumber: string,
  ) {
    this.client = twilio(accountSid, authToken);
  }

  async send(payload: SmsPayload): Promise<void> {
    log.info('Sending SMS via Twilio', { to: payload.to.slice(0, 6) + '****' });

    await this.client.messages.create({
      from: this.fromNumber,
      to:   payload.to,
      body: payload.body,
    });

    log.info('Twilio SMS sent', { to: payload.to.slice(0, 6) + '****' });
  }
}
