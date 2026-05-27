import { createChildLogger } from '@abroad-matrimony/logger';
import type { OtpAdapter } from './base.otp.adapter.js';

const log = createChildLogger({ module: 'auth:mock-otp' });

const MOCK_VALID_CODE = '000000';

export class MockOtpAdapter implements OtpAdapter {
  async send(phone: string): Promise<void> {
    log.info('[MOCK OTP] OTP sent — use 000000 to verify', { phone: phone.slice(0, 5) + '***' });
  }

  async verify(_phone: string, code: string): Promise<boolean> {
    return code === MOCK_VALID_CODE;
  }
}
