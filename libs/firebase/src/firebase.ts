import * as admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
import type { Database } from 'firebase-admin/database';
import type { Messaging } from 'firebase-admin/messaging';
import type { Auth } from 'firebase-admin/auth';
import { getEnv } from '@abroad-matrimony/config';
import { createChildLogger } from '@abroad-matrimony/logger';

const log = createChildLogger({ module: 'firebase' });

let _app: admin.app.App | null = null;

/**
 * Returns true when all three Firebase credentials are present in env.
 * Falls back to MockMessagingAdapter when false — no network access required for dev/test.
 */
export function isFirebaseConfigured(): boolean {
  const env = getEnv();
  return !!(
    env.FIREBASE_PROJECT_ID &&
    env.FIREBASE_CLIENT_EMAIL &&
    env.FIREBASE_PRIVATE_KEY
  );
}

/**
 * Initialise Firebase Admin SDK once.
 * Subsequent calls return the existing app.
 * Throws if credentials are missing — call isFirebaseConfigured() first.
 */
export function initFirebase(): admin.app.App {
  if (_app) return _app;

  const env = getEnv();

  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase credentials missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.',
    );
  }

  _app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID!,
      clientEmail: env.FIREBASE_CLIENT_EMAIL!,
      // .env stores \n as literal backslash-n; replace to actual newline
      privateKey: env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
    databaseURL: `https://${env.FIREBASE_PROJECT_ID!}-default-rtdb.firebaseio.com`,
  });

  log.info('Firebase Admin SDK initialised', { projectId: env.FIREBASE_PROJECT_ID });
  return _app;
}

/**
 * Get Firestore instance (lazy — initialises Firebase if not yet done).
 */
export function getFirestoreDb(): Firestore {
  const app = _app ?? initFirebase();
  return app.firestore() as unknown as Firestore;
}

/**
 * Get Firebase Realtime Database instance (presence / onDisconnect hooks).
 */
export function getRealtimeDb(): Database {
  const app = _app ?? initFirebase();
  return app.database() as unknown as Database;
}

/**
 * Get Firebase Cloud Messaging instance (push notifications).
 */
export function getFirebaseMessaging(): Messaging {
  const app = _app ?? initFirebase();
  return app.messaging() as unknown as Messaging;
}

/**
 * Get Firebase Auth instance (custom token generation for Flutter clients).
 */
export function getFirebaseAuth(): Auth {
  const app = _app ?? initFirebase();
  return app.auth() as unknown as Auth;
}

/**
 * Gracefully shut down the Firebase Admin SDK.
 * Call during server shutdown after closing other services.
 */
export async function shutdownFirebase(): Promise<void> {
  if (!_app) return;
  await _app.delete();
  _app = null;
  log.info('Firebase Admin SDK shut down');
}
