import { createProfileEventHandlers, COMPLETION_HANDLER_NAME } from '../profile.event-handlers.js';
import { CLOUD_EVENT_TYPES, VerificationStatus } from '@abroad-matrimony/shared';

const mockRecalculate = jest.fn();
jest.mock('../score.service.js', () => ({
  recalculateCompletionScore: (...a: unknown[]) => mockRecalculate(...a),
}));

const event = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  source: 'test',
  type: CLOUD_EVENT_TYPES.VERIFICATION_REVIEWED,
  time: new Date().toISOString(),
  dataContentType: 'application/json',
  data: { verificationId: 'ver-1', userId: 'user-1', status: VerificationStatus.APPROVED },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRecalculate.mockResolvedValue(100);
});

describe('createProfileEventHandlers', () => {
  it('registers one handler, for VERIFICATION_REVIEWED', () => {
    const registry = createProfileEventHandlers();
    expect(Object.keys(registry)).toEqual([CLOUD_EVENT_TYPES.VERIFICATION_REVIEWED]);
    expect(registry[CLOUD_EVENT_TYPES.VERIFICATION_REVIEWED].map((h) => h.name)).toEqual([COMPLETION_HANDLER_NAME]);
  });

  it('recalculates the reviewed user’s completion score', async () => {
    const [handler] = createProfileEventHandlers()[CLOUD_EVENT_TYPES.VERIFICATION_REVIEWED];
    await handler.handle(event);
    expect(mockRecalculate).toHaveBeenCalledWith('user-1');
  });

  it('propagates failures so the event is retried', async () => {
    mockRecalculate.mockRejectedValue(new Error('DB down'));
    const [handler] = createProfileEventHandlers()[CLOUD_EVENT_TYPES.VERIFICATION_REVIEWED];
    await expect(handler.handle(event)).rejects.toThrow('DB down');
  });
});
