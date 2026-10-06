import type * as PublisherModule from '../publisher.js';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockAddBulk = jest.fn();
const mockClose = jest.fn();
const mockQueueCtor = jest.fn();
const mockLogError = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation((name: string, opts: unknown) => {
    mockQueueCtor(name, opts);
    return { addBulk: mockAddBulk, close: mockClose };
  }),
}));

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: mockLogError, debug: jest.fn() }),
}));

// The publisher keeps module-level state (buffer, queue), so each test gets a fresh copy.
function loadPublisher(): typeof PublisherModule {
  let mod!: typeof PublisherModule;
  jest.isolateModules(() => {
    mod = jest.requireActual('../publisher.js');
  });
  return mod;
}

const TYPE = 'com.abroadmatrimony.test.happened';

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockAddBulk.mockResolvedValue([]);
  mockClose.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('buildCloudEvent', () => {
  it('builds a CloudEvent with id, source, type, subject, time and data', () => {
    const { buildCloudEvent } = loadPublisher();
    const event = buildCloudEvent(TYPE, { a: 1 }, 'user:1');
    expect(event).toMatchObject({
      source: 'abroad-matrimony-api',
      type: TYPE,
      subject: 'user:1',
      dataContentType: 'application/json',
      data: { a: 1 },
    });
    expect(event.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(event.time).toString()).not.toBe('Invalid Date');
  });

  it('gives every event a unique id', () => {
    const { buildCloudEvent } = loadPublisher();
    expect(buildCloudEvent(TYPE, {}).id).not.toBe(buildCloudEvent(TYPE, {}).id);
  });
});

describe('publish + flush', () => {
  it('buffers events without touching Redis until a flush', async () => {
    const pub = loadPublisher();
    pub.initEventBus('redis://x');
    await pub.publish(TYPE, { n: 1 });
    expect(pub.getWalBufferSize()).toBe(1);
    expect(mockAddBulk).not.toHaveBeenCalled();
  });

  it('flushes the buffer on the 500ms interval as one addBulk call', async () => {
    const pub = loadPublisher();
    pub.initEventBus('redis://x');
    await pub.publish(TYPE, { n: 1 });
    await pub.publish(TYPE, { n: 2 });
    await jest.advanceTimersByTimeAsync(500);
    expect(mockAddBulk).toHaveBeenCalledTimes(1);
    expect(mockAddBulk.mock.calls[0][0]).toHaveLength(2);
    expect(mockAddBulk.mock.calls[0][0][0]).toMatchObject({ name: TYPE, data: { type: TYPE, data: { n: 1 } } });
    expect(pub.getWalBufferSize()).toBe(0);
  });

  it('flushes immediately once 50 events are buffered', async () => {
    const pub = loadPublisher();
    pub.initEventBus('redis://x');
    for (let i = 0; i < 50; i++) await pub.publish(TYPE, { i });
    expect(mockAddBulk).toHaveBeenCalledTimes(1);
    expect(mockAddBulk.mock.calls[0][0]).toHaveLength(50);
  });

  it('re-queues the batch at the front when Redis is down', async () => {
    const pub = loadPublisher();
    pub.initEventBus('redis://x');
    mockAddBulk.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await pub.publish(TYPE, { n: 1 });
    await jest.advanceTimersByTimeAsync(500);
    expect(pub.getWalBufferSize()).toBe(1);

    await jest.advanceTimersByTimeAsync(500);
    expect(mockAddBulk).toHaveBeenCalledTimes(2);
    expect(pub.getWalBufferSize()).toBe(0);
  });

  it('drops the oldest events once the buffer exceeds WAL_MAX_BUFFER', async () => {
    const pub = loadPublisher();
    // No initEventBus → no queue, so nothing flushes and the buffer only grows.
    for (let i = 0; i < pub.WAL_MAX_BUFFER + 3; i++) await pub.publish(TYPE, { i });
    expect(pub.getWalBufferSize()).toBe(pub.WAL_MAX_BUFFER);
    expect(mockLogError).toHaveBeenCalledWith('WAL buffer full — dropping oldest events', expect.objectContaining({ dropped: 1 }));
  });

  it('keeps events buffered when the bus was never initialised', async () => {
    const pub = loadPublisher();
    await pub.publish(TYPE, {});
    await jest.advanceTimersByTimeAsync(1000);
    expect(mockAddBulk).not.toHaveBeenCalled();
    expect(pub.getWalBufferSize()).toBe(1);
  });
});

describe('shutdownEventBus', () => {
  it('flushes remaining events and closes the queue', async () => {
    const pub = loadPublisher();
    pub.initEventBus('redis://x');
    await pub.publish(TYPE, {});
    await pub.shutdownEventBus();
    expect(mockAddBulk).toHaveBeenCalledTimes(1);
    expect(mockClose).toHaveBeenCalled();
  });

  it('stops the flush timer', async () => {
    const pub = loadPublisher();
    pub.initEventBus('redis://x');
    await pub.shutdownEventBus();
    await pub.publish(TYPE, {});
    await jest.advanceTimersByTimeAsync(1000);
    expect(mockAddBulk).not.toHaveBeenCalled();
  });
});
