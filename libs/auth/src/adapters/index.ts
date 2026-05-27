import { getEnv } from '@abroad-matrimony/config';
import type { OtpAdapter } from './base.otp.adapter.js';
import { TwilioOtpAdapter } from './twilio.otp.adapter.js';
import { MockOtpAdapter } from './mock.otp.adapter.js';

export type { OtpAdapter } from './base.otp.adapter.js';
export { TwilioOtpAdapter } from './twilio.otp.adapter.js';
export { MockOtpAdapter } from './mock.otp.adapter.js';

export function getOtpAdapter(): OtpAdapter {
  const env = getEnv();
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_VERIFY_SERVICE_SID) {
    return new TwilioOtpAdapter(
      env.TWILIO_ACCOUNT_SID,
      env.TWILIO_AUTH_TOKEN,
      env.TWILIO_VERIFY_SERVICE_SID,
    );
  }
  return new MockOtpAdapter();
}
