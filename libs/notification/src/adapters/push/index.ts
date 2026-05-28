import { isFirebaseConfigured } from '@abroad-matrimony/firebase';
import { FirebasePushAdapter } from './firebase.push.adapter.js';
import { MockPushAdapter } from './mock.push.adapter.js';
import type { PushAdapter } from './base.push.adapter.js';

export { FirebasePushAdapter } from './firebase.push.adapter.js';
export { MockPushAdapter } from './mock.push.adapter.js';
export type { PushAdapter } from './base.push.adapter.js';

let _adapter: PushAdapter | null = null;

/**
 * Returns the singleton push adapter.
 * Uses FirebasePushAdapter when Firebase is configured; falls back to MockPushAdapter.
 */
export function getPushAdapter(): PushAdapter {
  if (_adapter) return _adapter;

  _adapter = isFirebaseConfigured()
    ? new FirebasePushAdapter()
    : new MockPushAdapter();

  return _adapter;
}

/** Reset the singleton — test helper only. */
export function _resetPushAdapter(): void {
  _adapter = null;
}
