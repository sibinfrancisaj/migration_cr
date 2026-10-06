const order: string[] = [];
const mkWorker = (name: string) => ({
  name,
  close: jest.fn(async () => {
    order.push(`close:${name}`);
  }),
});

const mockCreateEventWorker = jest.fn((_url: string, _reg: unknown) => mkWorker('events'));
const mockMerge = jest.fn((...regs: unknown[]) => ({ merged: regs }));
const mockIsAiConfigured = jest.fn(() => false);

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));
jest.mock('@abroad-matrimony/event-bus', () => ({
  createEventWorker: (url: string, reg: unknown) => mockCreateEventWorker(url, reg),
  mergeHandlerRegistries: (...regs: unknown[]) => mockMerge(...regs),
}));
jest.mock('@abroad-matrimony/matching', () => ({
  createScoreRecomputeWorker: jest.fn(() => mkWorker('matching')),
  createMatchingEventHandlers: jest.fn(() => ({ m: [] })),
}));
jest.mock('@abroad-matrimony/notification', () => ({
  createNotificationWorker: jest.fn(() => mkWorker('notification')),
  createNotificationEventHandlers: jest.fn(() => ({ n: [] })),
}));
jest.mock('@abroad-matrimony/profile', () => ({
  createProfileEventHandlers: jest.fn(() => ({ p: [] })),
}));
jest.mock('@abroad-matrimony/ai', () => ({
  isAiConfigured: () => mockIsAiConfigured(),
  createAiWorker: jest.fn(() => mkWorker('ai')),
}));
jest.mock('@abroad-matrimony/introductions', () => ({
  createWeeklyDropWorker: jest.fn(async () => mkWorker('weekly-drop')),
}));

import { startWorkers, WORKER_NAMES } from '../start-workers';

const REDIS = 'redis://localhost:6379';

beforeEach(() => {
  order.length = 0;
  jest.clearAllMocks();
  mockIsAiConfigured.mockReturnValue(false);
});

describe('startWorkers', () => {
  it('starts events, matching, notification and weekly-drop workers without AI', async () => {
    const running = await startWorkers(REDIS);
    expect(Object.keys(running.workers).sort()).toEqual(
      [WORKER_NAMES.EVENTS, WORKER_NAMES.MATCHING, WORKER_NAMES.NOTIFICATION, WORKER_NAMES.WEEKLY_DROP].sort(),
    );
    expect(running.workers.ai).toBeUndefined();
  });

  it('starts the AI worker when OPENAI_API_KEY is configured', async () => {
    mockIsAiConfigured.mockReturnValue(true);
    const running = await startWorkers(REDIS);
    expect(running.workers.ai).toBeDefined();
  });

  it('wires the event worker with notification, matching and profile handlers merged', async () => {
    await startWorkers(REDIS);
    expect(mockMerge).toHaveBeenCalledWith({ n: [] }, { m: [] }, { p: [] });
    expect(mockCreateEventWorker).toHaveBeenCalledWith(REDIS, {
      merged: [{ n: [] }, { m: [] }, { p: [] }],
    });
  });

  it('stop() closes workers in reverse start order', async () => {
    mockIsAiConfigured.mockReturnValue(true);
    const running = await startWorkers(REDIS);
    await running.stop();
    expect(order).toEqual([
      'close:weekly-drop',
      'close:ai',
      'close:notification',
      'close:matching',
      'close:events',
    ]);
  });

  it('stop() keeps closing the rest when one worker fails to close', async () => {
    const running = await startWorkers(REDIS);
    (running.workers.notification!.close as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    await expect(running.stop()).resolves.toBeUndefined();
    expect(running.workers.events!.close).toHaveBeenCalled();
    expect(running.workers.matching!.close).toHaveBeenCalled();
  });
});
