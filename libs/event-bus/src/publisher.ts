import { Queue } from 'bullmq';
import { createChildLogger } from '@abroad-matrimony/logger';
import { CLOUD_EVENT_SOURCE, QUEUE_NAMES } from '@abroad-matrimony/shared';
import { CloudEventPayload, WalEntry } from './types.js';

const log = createChildLogger({ module: 'event-bus' });

const WAL_FLUSH_THRESHOLD = 50;
const WAL_FLUSH_INTERVAL_MS = 500;

let _queue: Queue | null = null;
const walBuffer: WalEntry[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

export function initEventBus(redisUrl: string): void {
  _queue = new Queue(QUEUE_NAMES.EVENTS, {
    connection: { url: redisUrl },
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 60000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  });

  flushTimer = setInterval(() => void flushWal(), WAL_FLUSH_INTERVAL_MS);
}

export function buildCloudEvent<T>(type: string, data: T, subject?: string): CloudEventPayload<T> {
  return {
    id: crypto.randomUUID(),
    source: CLOUD_EVENT_SOURCE,
    type,
    subject,
    time: new Date().toISOString(),
    dataContentType: 'application/json',
    data,
  };
}

export async function publish<T>(type: string, data: T, subject?: string): Promise<void> {
  const event = buildCloudEvent(type, data, subject);
  walBuffer.push({ event, queuedAt: Date.now(), attempts: 0 });

  if (walBuffer.length >= WAL_FLUSH_THRESHOLD) {
    await flushWal();
  }
}

async function flushWal(): Promise<void> {
  if (!_queue || walBuffer.length === 0) return;

  const batch = walBuffer.splice(0, walBuffer.length);
  try {
    await _queue.addBulk(
      batch.map((entry) => ({
        name: entry.event.type,
        data: entry.event,
      })),
    );
  } catch (err) {
    log.error('WAL flush failed — re-queuing batch', { count: batch.length, err });
    walBuffer.unshift(...batch);
  }
}

export async function shutdownEventBus(): Promise<void> {
  if (flushTimer) clearInterval(flushTimer);
  await flushWal();
  await _queue?.close();
  _queue = null;
}
