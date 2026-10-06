import { Queue } from 'bullmq';
import { createChildLogger } from '@abroad-matrimony/logger';

const log = createChildLogger({ module: 'queue:registry' });

const queues = new Map<string, Queue>();

function registryKey(name: string, redisUrl: string): string {
  return `${redisUrl}|${name}`;
}

/**
 * Returns a shared BullMQ Queue for `name` on `redisUrl`, creating it on first use (F-053).
 *
 * Enqueue helpers call this instead of `new Queue()` + `close()` per job, so a
 * request path no longer opens and tears down a Redis connection for every add.
 * Never call `close()` on the returned queue — use `closeQueues()` at shutdown.
 */
export function getQueue<T = unknown>(name: string, redisUrl: string): Queue<T> {
  const key = registryKey(name, redisUrl);
  let queue = queues.get(key);
  if (!queue) {
    queue = new Queue(name, { connection: { url: redisUrl } });
    queue.on('error', (err) => log.error('Queue connection error', { queue: name, err }));
    queues.set(key, queue);
  }
  return queue as unknown as Queue<T>;
}

/** Number of open shared queues — for health checks and tests. */
export function getOpenQueueCount(): number {
  return queues.size;
}

/**
 * Close every shared queue. Call once during graceful shutdown, after workers
 * stop. Never throws; a queue that fails to close is logged and dropped.
 */
export async function closeQueues(): Promise<void> {
  const open = [...queues.entries()];
  queues.clear();
  await Promise.all(
    open.map(async ([key, queue]) => {
      try {
        await queue.close();
      } catch (err) {
        log.error('Queue failed to close', { queue: key.split('|')[1], err });
      }
    }),
  );
}
