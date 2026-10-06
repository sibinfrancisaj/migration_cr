import { Queue } from 'bullmq';
import { createChildLogger } from '@abroad-matrimony/logger';
import { CLOUD_EVENT_SOURCE, QUEUE_NAMES } from '@abroad-matrimony/shared';
import { CloudEventPayload, WalEntry } from './types.js';

const log = createChildLogger({ module: 'event-bus' });

const WAL_FLUSH_THRESHOLD = 50;
const WAL_FLUSH_INTERVAL_MS = 500;
/** Upper bound on buffered events while Redis is unreachable; oldest are dropped past this. */
export const WAL_MAX_BUFFER = 10_000;

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
  // Don't let the flush timer alone keep the process (or a test run) alive.
  flushTimer.unref();
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
  trimWal();

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
    trimWal();
  }
}

/** Drop the oldest entries when Redis has been down long enough to fill the buffer. */
function trimWal(): void {
  const overflow = walBuffer.length - WAL_MAX_BUFFER;
  if (overflow > 0) {
    const dropped = walBuffer.splice(0, overflow);
    log.error('WAL buffer full — dropping oldest events', {
      dropped: dropped.length,
      types: [...new Set(dropped.map((e) => e.event.type))],
    });
  }
}

/** Number of events waiting to be flushed (for health checks and tests). */
export function getWalBufferSize(): number {
  return walBuffer.length;
}

export async function shutdownEventBus(): Promise<void> {
  if (flushTimer) clearInterval(flushTimer);
  await flushWal();
  await _queue?.close();
  _queue = null;
}
