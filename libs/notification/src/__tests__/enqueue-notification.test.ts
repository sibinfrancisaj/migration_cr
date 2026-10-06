import { enqueueNotification } from '../notification.worker.js';
import { NotificationType } from '../types/notification.types.js';

const mockAdd = jest.fn();
const mockClose = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({ add: mockAdd, close: mockClose })),
  Worker: jest.fn(),
}));

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

const job = {
  type: NotificationType.PUSH as const,
  payload: { deviceToken: 'tok', title: 't', body: 'b' },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAdd.mockResolvedValue({});
  mockClose.mockResolvedValue(undefined);
});

describe('enqueueNotification', () => {
  it('passes the jobId through to BullMQ for deduplication', async () => {
    await enqueueNotification('redis://x', job, { jobId: 'evt:handler:dev' });
    expect(mockAdd).toHaveBeenCalledWith('notification', job, expect.objectContaining({ jobId: 'evt:handler:dev', attempts: 3 }));
  });

  it('lets BullMQ assign an id when no jobId is given', async () => {
    await enqueueNotification('redis://x', job);
    expect(mockAdd.mock.calls[0][2].jobId).toBeUndefined();
  });

  it('closes the queue even when add fails', async () => {
    mockAdd.mockRejectedValue(new Error('down'));
    await expect(enqueueNotification('redis://x', job)).rejects.toThrow('down');
    expect(mockClose).toHaveBeenCalled();
  });
});
