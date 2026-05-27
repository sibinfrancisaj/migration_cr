import twilio from 'twilio';
import { createChildLogger } from '@abroad-matrimony/logger';
import type { OtpAdapter } from './base.otp.adapter.js';

const log = createChildLogger({ module: 'auth:twilio-otp' });

export class TwilioOtpAdapter implements OtpAdapter {
  private readonly client: ReturnType<typeof twilio>;

  constructor(
    accountSid: string,
    authToken: string,
    private readonly serviceSid: string,
  ) {
    this.client = twilio(accountSid, authToken);
  }

  async send(phone: string): Promise<void> {
    log.info('Sending OTP', { phone: phone.slice(0, 5) + '***' });
    await this.client.verify.v2.services(this.serviceSid).verifications.create({
      to: phone,
      channel: 'sms',
    });
  }

  async verify(phone: string, code: string): Promise<boolean> {
    const check = await this.client.verify.v2
      .services(this.serviceSid)
      .verificationChecks.create({ to: phone, code });
    return check.status === 'approved';
  }
}
