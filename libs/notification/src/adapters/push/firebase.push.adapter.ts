import { getFirebaseMessaging } from '@abroad-matrimony/firebase';
import { createChildLogger } from '@abroad-matrimony/logger';
import type { PushAdapter } from './base.push.adapter.js';
import type { PushPayload } from '../../types/notification.types.js';

const log = createChildLogger({ module: 'notification:fcm' });

/**
 * Sends push notifications via Firebase Cloud Messaging (FCM).
 * Uses the Firebase Admin SDK from libs/firebase — must be initialised
 * (isFirebaseConfigured() === true) before this adapter is created.
 */
export class FirebasePushAdapter implements PushAdapter {
  async send(payload: PushPayload): Promise<void> {
    log.info('Sending FCM push', { token: payload.deviceToken.slice(0, 10) + '…' });

    await getFirebaseMessaging().send({
      token: payload.deviceToken,
      notification: {
        title: payload.title,
        body:  payload.body,
      },
      ...(payload.data ? { data: payload.data } : {}),
    });

    log.info('FCM push sent', { token: payload.deviceToken.slice(0, 10) + '…' });
  }
}
