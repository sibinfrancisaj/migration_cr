import { getFirebaseAuth, isFirebaseConfigured } from '@abroad-matrimony/firebase';
import { createChildLogger } from '@abroad-matrimony/logger';

const log = createChildLogger({ module: 'messaging:firebase-token' });

/**
 * Thrown when Firebase credentials are absent and a custom token is requested.
 * Maps to HTTP 503 in the controller.
 */
export class FirebaseNotConfiguredError extends Error {
  constructor() {
    super('Firebase is not configured on this server. Custom tokens unavailable.');
    this.name = 'FirebaseNotConfiguredError';
  }
}

/**
 * Generate a Firebase custom auth token for the given userId.
 *
 * Flutter clients exchange this token for a Firebase ID token via
 * `signInWithCustomToken()`, then use the ID token to authenticate
 * direct Firestore reads/writes via security rules.
 *
 * @throws {FirebaseNotConfiguredError} when Firebase credentials are absent.
 */
export async function createFirebaseToken(userId: string): Promise<string> {
  if (!isFirebaseConfigured()) {
    throw new FirebaseNotConfiguredError();
  }

  const auth = getFirebaseAuth();
  const token = await auth.createCustomToken(userId);

  log.info('Firebase custom token issued', { userId });
  return token;
}
