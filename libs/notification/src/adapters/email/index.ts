import { getEnv } from '@abroad-matrimony/config';
import { BrevoEmailAdapter } from './brevo.email.adapter.js';
import { MockEmailAdapter } from './mock.email.adapter.js';
import type { EmailAdapter } from './base.email.adapter.js';

export { BrevoEmailAdapter } from './brevo.email.adapter.js';
export { MockEmailAdapter } from './mock.email.adapter.js';
export type { EmailAdapter } from './base.email.adapter.js';

let _adapter: EmailAdapter | null = null;

/**
 * Returns the singleton email adapter.
 * Uses BrevoEmailAdapter when BREVO_API_KEY is set; falls back to MockEmailAdapter.
 * Call _resetEmailAdapter() in tests to inject a fresh mock.
 */
export function getEmailAdapter(): EmailAdapter {
  if (_adapter) return _adapter;

  const env = getEnv();
  if (env.BREVO_API_KEY) {
    _adapter = new BrevoEmailAdapter(env.BREVO_API_KEY, env.BREVO_FROM_EMAIL, env.BREVO_FROM_NAME);
  } else {
    _adapter = new MockEmailAdapter();
  }

  return _adapter;
}

/** Reset the singleton — test helper only. */
export function _resetEmailAdapter(): void {
  _adapter = null;
}
