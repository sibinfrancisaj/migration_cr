import { getOtpAdapter } from './adapters/index.js';

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  return getOtpAdapter().verify(phone, code);
}
