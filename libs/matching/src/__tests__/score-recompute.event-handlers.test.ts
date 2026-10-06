import { createMatchingEventHandlers, RECOMPUTE_HANDLER_NAME } from '../score-recompute.event-handlers.js';
import { CLOUD_EVENT_TYPES } from '@abroad-matrimony/shared';

const mockEnqueue = jest.fn();
jest.mock('../score-recompute.worker.js', () => ({
  enqueueScoreRecompute: (...a: unknown[]) => mockEnqueue(...a),
}));

const event = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  source: 'test',
  type: CLOUD_EVENT_TYPES.PROFILE_UPDATED,
  time: new Date().toISOString(),
  dataContentType: 'application/json',
  data: { userId: 'user-1', completionScore: 60 },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEnqueue.mockResolvedValue(undefined);
});

describe('createMatchingEventHandlers', () => {
  it('registers exactly one handler, for PROFILE_UPDATED', () => {
    const registry = createMatchingEventHandlers('redis://x');
    expect(Object.keys(registry)).toEqual([CLOUD_EVENT_TYPES.PROFILE_UPDATED]);
    expect(registry[CLOUD_EVENT_TYPES.PROFILE_UPDATED].map((h) => h.name)).toEqual([RECOMPUTE_HANDLER_NAME]);
  });

  it('enqueues a per-user recompute for the updated user', async () => {
    const [handler] = createMatchingEventHandlers('redis://x')[CLOUD_EVENT_TYPES.PROFILE_UPDATED];
    await handler.handle(event);
    expect(mockEnqueue).toHaveBeenCalledWith('redis://x', { userId: 'user-1', requestedBy: 'user-1' });
  });

  it('propagates enqueue failures so the event is retried', async () => {
    mockEnqueue.mockRejectedValue(new Error('Redis down'));
    const [handler] = createMatchingEventHandlers('redis://x')[CLOUD_EVENT_TYPES.PROFILE_UPDATED];
    await expect(handler.handle(event)).rejects.toThrow('Redis down');
  });
});
