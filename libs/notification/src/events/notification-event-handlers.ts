import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import type { CloudEventPayload, EventHandler, EventHandlerRegistry } from '@abroad-matrimony/event-bus';
import {
  CLOUD_EVENT_TYPES,
  VerificationStatus,
  type ConnectionAcceptedEventData,
  type ConnectionSentEventData,
  type MembershipActivatedEventData,
  type VerificationReviewedEventData,
} from '@abroad-matrimony/shared';
import { enqueueNotification } from '../notification.worker.js';
import { NotificationType } from '../types/notification.types.js';
import { EVENT_HANDLER_NAMES, EVENT_PUSH_COPY, EVENT_PUSH_TYPES } from './event-notification.constants.js';

const log = createChildLogger({ module: 'notification:events' });

interface PushMessage {
  title: string;
  body:  string;
  data:  Record<string, string>;
}

/**
 * Enqueue one PUSH job per registered device of `userId`.
 *
 * The jobId is `<eventId>:<handler>:<deviceId>`, so if the event is retried
 * (another handler failed) BullMQ drops the duplicate instead of re-sending.
 * Users with no push token are skipped silently.
 */
async function pushToUser(
  redisUrl: string,
  event: CloudEventPayload,
  handlerName: string,
  userId: string,
  message: PushMessage,
): Promise<void> {
  const devices = await prisma.device.findMany({
    where:  { userId, pushToken: { not: null } },
    select: { id: true, pushToken: true },
  });

  if (devices.length === 0) {
    log.debug('No push tokens — skipping', { userId, type: event.type, eventId: event.id });
    return;
  }

  await Promise.all(
    devices.map((device) =>
      enqueueNotification(
        redisUrl,
        {
          type: NotificationType.PUSH,
          payload: { deviceToken: device.pushToken as string, userId, ...message },
        },
        { jobId: `${event.id}:${handlerName}:${device.id}` },
      ),
    ),
  );

  log.info('Event push enqueued', { userId, type: event.type, devices: devices.length });
}

async function getDisplayName(userId: string): Promise<string> {
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { name: true } });
  return profile?.name ?? EVENT_PUSH_COPY.FALLBACK_NAME;
}

/**
 * CloudEvent handlers that turn domain events into user notifications.
 * Merge into the app's registry and pass to `createEventWorker()`.
 */
export function createNotificationEventHandlers(redisUrl: string): EventHandlerRegistry {
  const connectionSent: EventHandler<ConnectionSentEventData> = {
    name: EVENT_HANDLER_NAMES.CONNECTION_SENT,
    handle: async (event) => {
      const { senderId, receiverId, connectionId } = event.data;
      const name = await getDisplayName(senderId);
      await pushToUser(redisUrl, event, EVENT_HANDLER_NAMES.CONNECTION_SENT, receiverId, {
        title: EVENT_PUSH_COPY.CONNECTION_REQUEST.title,
        body:  EVENT_PUSH_COPY.CONNECTION_REQUEST.body(name),
        data:  { type: EVENT_PUSH_TYPES.CONNECTION_REQUEST, connectionId },
      });
    },
  };

  const connectionAccepted: EventHandler<ConnectionAcceptedEventData> = {
    name: EVENT_HANDLER_NAMES.CONNECTION_ACCEPTED,
    handle: async (event) => {
      const { senderId, receiverId, connectionId, matchId } = event.data;
      const name = await getDisplayName(receiverId);
      await pushToUser(redisUrl, event, EVENT_HANDLER_NAMES.CONNECTION_ACCEPTED, senderId, {
        title: EVENT_PUSH_COPY.CONNECTION_ACCEPTED.title,
        body:  EVENT_PUSH_COPY.CONNECTION_ACCEPTED.body(name),
        data:  { type: EVENT_PUSH_TYPES.CONNECTION_ACCEPTED, connectionId, matchId },
      });
    },
  };

  const verificationReviewed: EventHandler<VerificationReviewedEventData> = {
    name: EVENT_HANDLER_NAMES.VERIFICATION_REVIEWED,
    handle: async (event) => {
      const { userId, status, verificationId } = event.data;
      const approved = status === VerificationStatus.APPROVED;
      const copy = approved ? EVENT_PUSH_COPY.VERIFICATION_APPROVED : EVENT_PUSH_COPY.VERIFICATION_REJECTED;
      await pushToUser(redisUrl, event, EVENT_HANDLER_NAMES.VERIFICATION_REVIEWED, userId, {
        title: copy.title,
        body:  copy.body,
        data:  {
          type: approved ? EVENT_PUSH_TYPES.VERIFICATION_APPROVED : EVENT_PUSH_TYPES.VERIFICATION_REJECTED,
          verificationId,
        },
      });
    },
  };

  const membershipActivated: EventHandler<MembershipActivatedEventData> = {
    name: EVENT_HANDLER_NAMES.MEMBERSHIP_ACTIVATED,
    handle: async (event) => {
      const { userId, plan } = event.data;
      await pushToUser(redisUrl, event, EVENT_HANDLER_NAMES.MEMBERSHIP_ACTIVATED, userId, {
        title: EVENT_PUSH_COPY.MEMBERSHIP_ACTIVATED.title,
        body:  EVENT_PUSH_COPY.MEMBERSHIP_ACTIVATED.body,
        data:  { type: EVENT_PUSH_TYPES.MEMBERSHIP_ACTIVATED, plan },
      });
    },
  };

  return {
    [CLOUD_EVENT_TYPES.CONNECTION_SENT]:       [connectionSent as EventHandler],
    [CLOUD_EVENT_TYPES.CONNECTION_ACCEPTED]:   [connectionAccepted as EventHandler],
    [CLOUD_EVENT_TYPES.VERIFICATION_REVIEWED]: [verificationReviewed as EventHandler],
    [CLOUD_EVENT_TYPES.MEMBERSHIP_ACTIVATED]:  [membershipActivated as EventHandler],
  };
}
