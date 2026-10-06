const mockClose = jest.fn();
const mockOn = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation((name: string) => ({ name, close: mockClose, on: mockOn })),
}));
jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { Queue } from 'bullmq';
import { getQueue, closeQueues, getOpenQueueCount } from '../queue-registry';

const MockedQueue = jest.mocked(Queue);

beforeEach(async () => {
  await closeQueues();
  jest.clearAllMocks();
  mockClose.mockResolvedValue(undefined);
});

describe('getQueue', () => {
  it('creates a queue with the redis connection on first use', () => {
    getQueue('notification', 'redis://a');
    expect(MockedQueue).toHaveBeenCalledWith('notification', { connection: { url: 'redis://a' } });
  });

  it('returns the same instance for the same name and url', () => {
    const a = getQueue('notification', 'redis://a');
    const b = getQueue('notification', 'redis://a');
    expect(a).toBe(b);
    expect(MockedQueue).toHaveBeenCalledTimes(1);
  });

  it('keeps separate queues per name and per url', () => {
    getQueue('notification', 'redis://a');
    getQueue('matching', 'redis://a');
    getQueue('notification', 'redis://b');
    expect(getOpenQueueCount()).toBe(3);
  });

  it('logs connection errors instead of crashing', () => {
    getQueue('notification', 'redis://a');
    expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
  });
});

describe('closeQueues', () => {
  it('closes every queue and empties the registry', async () => {
    getQueue('notification', 'redis://a');
    getQueue('matching', 'redis://a');
    await closeQueues();
    expect(mockClose).toHaveBeenCalledTimes(2);
    expect(getOpenQueueCount()).toBe(0);
  });

  it('creates a fresh queue after close', async () => {
    const first = getQueue('notification', 'redis://a');
    await closeQueues();
    expect(getQueue('notification', 'redis://a')).not.toBe(first);
  });

  it('never throws when a queue fails to close', async () => {
    getQueue('notification', 'redis://a');
    getQueue('matching', 'redis://a');
    mockClose.mockRejectedValueOnce(new Error('boom'));
    await expect(closeQueues()).resolves.toBeUndefined();
    expect(mockClose).toHaveBeenCalledTimes(2);
  });
});
