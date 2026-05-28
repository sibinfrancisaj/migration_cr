import type { PushPayload } from '../../types/notification.types.js';

/**
 * Cloud-agnostic push notification interface.
 *
 * Production: FirebasePushAdapter (Firebase Admin SDK — FCM).
 * Dev / test: MockPushAdapter (logs, no network).
 */
export interface PushAdapter {
  /**
   * Send a push notification to a single device.
   * @param payload  Must include a valid FCM registration token.
   * Throws on delivery failure (invalid token, FCM quota exceeded, etc.).
   */
  send(payload: PushPayload): Promise<void>;
}
