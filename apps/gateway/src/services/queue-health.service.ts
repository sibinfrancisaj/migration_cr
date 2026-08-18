import { Queue } from 'bullmq';
import { getEnv } from '@abroad-matrimony/config';
import { createChildLogger } from '@abroad-matrimony/logger';
import { QUEUE_NAMES } from '@abroad-matrimony/shared';

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  paused: number;
  workerCount: number;
}

export interface QueueHealthDto {
  queues: QueueStats[];
  checkedAt: string;
}

const log = createChildLogger({ module: 'gateway:queue-health' });

// All queues in the system
const MONITORED_QUEUES: string[] = [
  QUEUE_NAMES.MATCHING,
  QUEUE_NAMES.NOTIFICATION,
  QUEUE_NAMES.PROFILE_INTELLIGENCE,
  QUEUE_NAMES.WEEKLY_INTROS,
  QUEUE_NAMES.EVENTS,
  'renewal-reminder',
  'seeder-drip',
  'seeder-activity',
  'seeder-match-recompute',
];

async function getQueueStats(name: string, redisUrl: string): Promise<QueueStats> {
  const q = new Queue(name, { connection: { url: redisUrl } });
  try {
    const [counts, workers] = await Promise.all([
      q.getJobCounts('waiting', 'active', 'delayed', 'failed', 'paused'),
      q.getWorkers(),
    ]);
    return {
      name,
      waiting:     counts['waiting']  ?? 0,
      active:      counts['active']   ?? 0,
      delayed:     counts['delayed']  ?? 0,
      failed:      counts['failed']   ?? 0,
      paused:      counts['paused']   ?? 0,
      workerCount: workers.length,
    };
  } finally {
    await q.close();
  }
}

export async function getQueueHealth(): Promise<QueueHealthDto> {
  const { REDIS_URL } = getEnv();
  log.info('Fetching queue health for all queues');

  const results = await Promise.allSettled(
    MONITORED_QUEUES.map(name => getQueueStats(name, REDIS_URL)),
  );

  const queues: QueueStats[] = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    log.warn('Failed to fetch stats for queue', { queue: MONITORED_QUEUES[i], err: r.reason });
    return {
      name:        MONITORED_QUEUES[i]!,
      waiting:     -1,
      active:      -1,
      delayed:     -1,
      failed:      -1,
      paused:      -1,
      workerCount: -1,
    };
  });

  return { queues, checkedAt: new Date().toISOString() };
}
