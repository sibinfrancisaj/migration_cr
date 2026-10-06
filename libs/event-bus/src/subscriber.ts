import { Worker } from 'bullmq';
import { createChildLogger } from '@abroad-matrimony/logger';
import { QUEUE_NAMES } from '@abroad-matrimony/shared';
import { CloudEventPayload } from './types.js';

const log = createChildLogger({ module: 'event-bus:subscriber' });

const DEFAULT_CONCURRENCY = 5;

/**
 * A named handler for one CloudEvent type.
 *
 * Handlers MUST be idempotent: when any handler for an event fails, the whole
 * job is retried and every handler for that event runs again. Use `event.id`
 * to dedupe side effects (e.g. as part of a BullMQ jobId).
 */
export interface EventHandler<T = unknown> {
  name:   string;
  handle: (event: CloudEventPayload<T>) => Promise<void>;
}

/** Event type → handlers. Built by each domain lib, merged in the app. */
export type EventHandlerRegistry = Record<string, EventHandler[]>;

export class EventHandlerError extends Error {
  constructor(
    public readonly eventType: string,
    public readonly failedHandlers: string[],
  ) {
    super(`EVENT_HANDLER_FAILED: ${eventType} [${failedHandlers.join(', ')}]`);
    this.name = 'EventHandlerError';
  }
}

/** Concatenate handler lists per event type across several registries. */
export function mergeHandlerRegistries(...registries: EventHandlerRegistry[]): EventHandlerRegistry {
  const merged: EventHandlerRegistry = {};
  for (const registry of registries) {
    for (const [type, handlers] of Object.entries(registry)) {
      merged[type] = [...(merged[type] ?? []), ...handlers];
    }
  }
  return merged;
}

/**
 * Run every handler registered for `event.type`.
 *
 * All handlers run even if one fails (one broken handler must not starve the
 * others); failures are collected and rethrown as one EventHandlerError so
 * BullMQ retries the job. Events with no handlers complete as a no-op so the
 * queue drains.
 */
export async function dispatchEvent(
  event: CloudEventPayload,
  registry: EventHandlerRegistry,
): Promise<void> {
  const handlers = registry[event.type] ?? [];

  if (handlers.length === 0) {
    log.debug('No handlers for event type', { type: event.type, eventId: event.id });
    return;
  }

  const results = await Promise.allSettled(handlers.map((h) => h.handle(event)));

  const failed: string[] = [];
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      failed.push(handlers[i].name);
      log.error('Event handler failed', {
        type: event.type,
        eventId: event.id,
        handler: handlers[i].name,
        err: result.reason,
      });
    }
  });

  if (failed.length > 0) {
    throw new EventHandlerError(event.type, failed);
  }
}

/**
 * Start the BullMQ worker that consumes the EVENTS queue (ADR-002 consumer side).
 * Retry/backoff is set per job by the publisher (5 attempts, exponential).
 */
export function createEventWorker(
  redisUrl: string,
  registry: EventHandlerRegistry,
  concurrency = DEFAULT_CONCURRENCY,
): Worker<CloudEventPayload> {
  const worker = new Worker<CloudEventPayload>(
    QUEUE_NAMES.EVENTS,
    async (job) => dispatchEvent(job.data, registry),
    { connection: { url: redisUrl }, concurrency },
  );

  worker.on('failed', (job, err) => {
    log.warn('Event job failed', {
      jobId: job?.id,
      type: job?.data.type,
      attemptsMade: job?.attemptsMade,
      err: err.message,
    });
  });

  log.info('Event worker started', {
    concurrency,
    eventTypes: Object.keys(registry).length,
  });

  return worker;
}
