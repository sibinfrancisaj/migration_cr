import { createChildLogger } from '@abroad-matrimony/logger';
import type { PushAdapter } from './base.push.adapter.js';
import type { PushPayload } from '../../types/notification.types.js';

const log = createChildLogger({ module: 'notification:mock-push' });

/**
 * No-op push adapter for dev / test environments.
 * Logs instead of calling FCM.
 * Tracks sent pushes in-memory for test assertions.
 */
export class MockPushAdapter implements PushAdapter {
  /** Push notifications sent since last `_reset()`. */
  public readonly sent: PushPayload[] = [];

  async send(payload: PushPayload): Promise<void> {
    this.sent.push(payload);
    log.info('[MOCK] Push not sent — Firebase not configured', {
      token: payload.deviceToken.slice(0, 10) + '…',
      title: payload.title,
    });
  }

  /** Clear the sent log between tests. */
  _reset(): void {
    this.sent.length = 0;
  }
}
