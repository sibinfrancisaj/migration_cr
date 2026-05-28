import { isFirebaseConfigured, getFirestoreDb } from '@abroad-matrimony/firebase';
import { FirestoreMessagingAdapter } from './firestore.messaging.adapter.js';
import { MockMessagingAdapter } from './mock.messaging.adapter.js';
import type { MessagingAdapter } from './base.messaging.adapter.js';

let _adapter: MessagingAdapter | null = null;

/**
 * Returns the singleton MessagingAdapter.
 *
 * - When Firebase credentials are present → FirestoreMessagingAdapter (production).
 * - When credentials are absent → MockMessagingAdapter (dev / CI).
 *
 * This allows local development and CI to work without Firebase credentials.
 * The adapter is created lazily on first call so Jest mocks are in place
 * before any module-level code runs.
 */
export function getMessagingAdapter(): MessagingAdapter {
  if (_adapter) return _adapter;

  if (isFirebaseConfigured()) {
    _adapter = new FirestoreMessagingAdapter(getFirestoreDb());
  } else {
    _adapter = new MockMessagingAdapter();
  }

  return _adapter;
}

/**
 * Reset the singleton. Used in tests to inject a fresh MockMessagingAdapter.
 */
export function resetMessagingAdapter(): void {
  _adapter = null;
}

export type { MessagingAdapter } from './base.messaging.adapter.js';
export { FirestoreMessagingAdapter } from './firestore.messaging.adapter.js';
export { MockMessagingAdapter } from './mock.messaging.adapter.js';
