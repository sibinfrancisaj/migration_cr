import { getEnv } from '@abroad-matrimony/config';
import { TwilioSmsAdapter } from './twilio.sms.adapter.js';
import { MockSmsAdapter } from './mock.sms.adapter.js';
import type { SmsAdapter } from './base.sms.adapter.js';

export { TwilioSmsAdapter } from './twilio.sms.adapter.js';
export { MockSmsAdapter } from './mock.sms.adapter.js';
export type { SmsAdapter } from './base.sms.adapter.js';

let _adapter: SmsAdapter | null = null;

/**
 * Returns the singleton SMS adapter.
 * Uses TwilioSmsAdapter when TWILIO_ACCOUNT_SID + TWILIO_PHONE_NUMBER are set;
 * falls back to MockSmsAdapter.
 */
export function getSmsAdapter(): SmsAdapter {
  if (_adapter) return _adapter;

  const env = getEnv();
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER) {
    _adapter = new TwilioSmsAdapter(
      env.TWILIO_ACCOUNT_SID,
      env.TWILIO_AUTH_TOKEN,
      env.TWILIO_PHONE_NUMBER,
    );
  } else {
    _adapter = new MockSmsAdapter();
  }

  return _adapter;
}

/** Reset the singleton — test helper only. */
export function _resetSmsAdapter(): void {
  _adapter = null;
}
