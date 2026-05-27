export interface OtpAdapter {
  send(phone: string): Promise<void>;
  verify(phone: string, code: string): Promise<boolean>;
}
