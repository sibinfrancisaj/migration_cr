import {
  dispatchEvent,
  mergeHandlerRegistries,
  createEventWorker,
  EventHandlerError,
  type EventHandler,
  type EventHandlerRegistry,
} from '../subscriber.js';
import type { CloudEventPayload } from '../types.js';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockWorkerOn = jest.fn();
let capturedProcessor: ((job: { data: CloudEventPayload }) => Promise<void>) | null = null;
const mockWorkerCtor = jest.fn();

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation((queue: string, processor: typeof capturedProcessor, opts: unknown) => {
    mockWorkerCtor(queue, opts);
    capturedProcessor = processor;
    return { on: mockWorkerOn };
  }),
}));

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

const TYPE_A = 'com.abroadmatrimony.test.a';
const TYPE_B = 'com.abroadmatrimony.test.b';

function makeEvent(type = TYPE_A): CloudEventPayload {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    source: 'test',
    type,
    time: new Date().toISOString(),
    dataContentType: 'application/json',
    data: { foo: 'bar' },
  };
}

function handler(name: string, impl?: () => Promise<void>): EventHandler & { handle: jest.Mock } {
  return { name, handle: jest.fn(impl ?? (() => Promise.resolve())) };
}

beforeEach(() => {
  jest.clearAllMocks();
  capturedProcessor = null;
});

// ── mergeHandlerRegistries ─────────────────────────────────────────────────────

describe('mergeHandlerRegistries', () => {
  it('concatenates handlers for the same event type in argument order', () => {
    const h1 = handler('h1');
    const h2 = handler('h2');
    const merged = mergeHandlerRegistries({ [TYPE_A]: [h1] }, { [TYPE_A]: [h2] });
    expect(merged[TYPE_A].map((h) => h.name)).toEqual(['h1', 'h2']);
  });

  it('keeps distinct event types separate', () => {
    const merged = mergeHandlerRegistries({ [TYPE_A]: [handler('a')] }, { [TYPE_B]: [handler('b')] });
    expect(Object.keys(merged).sort()).toEqual([TYPE_A, TYPE_B].sort());
  });

  it('returns an empty registry when given none', () => {
    expect(mergeHandlerRegistries()).toEqual({});
  });

  it('does not mutate the input registries', () => {
    const r1: EventHandlerRegistry = { [TYPE_A]: [handler('h1')] };
    mergeHandlerRegistries(r1, { [TYPE_A]: [handler('h2')] });
    expect(r1[TYPE_A]).toHaveLength(1);
  });
});

// ── dispatchEvent ──────────────────────────────────────────────────────────────

describe('dispatchEvent', () => {
  it('calls every handler registered for the event type with the event', async () => {
    const h1 = handler('h1');
    const h2 = handler('h2');
    const event = makeEvent();
    await dispatchEvent(event, { [TYPE_A]: [h1, h2] });
    expect(h1.handle).toHaveBeenCalledWith(event);
    expect(h2.handle).toHaveBeenCalledWith(event);
  });

  it('does not call handlers registered for other types', async () => {
    const other = handler('other');
    await dispatchEvent(makeEvent(TYPE_A), { [TYPE_B]: [other] });
    expect(other.handle).not.toHaveBeenCalled();
  });

  it('resolves as a no-op when no handlers are registered', async () => {
    await expect(dispatchEvent(makeEvent(), {})).resolves.toBeUndefined();
  });

  it('still runs the remaining handlers when one fails', async () => {
    const bad = handler('bad', () => Promise.reject(new Error('boom')));
    const good = handler('good');
    await expect(dispatchEvent(makeEvent(), { [TYPE_A]: [bad, good] })).rejects.toThrow(EventHandlerError);
    expect(good.handle).toHaveBeenCalled();
  });

  it('throws EventHandlerError naming every failed handler', async () => {
    const bad1 = handler('bad1', () => Promise.reject(new Error('x')));
    const bad2 = handler('bad2', () => Promise.reject(new Error('y')));
    const err = await dispatchEvent(makeEvent(), { [TYPE_A]: [bad1, handler('ok'), bad2] }).catch((e) => e);
    expect(err).toBeInstanceOf(EventHandlerError);
    expect(err.eventType).toBe(TYPE_A);
    expect(err.failedHandlers).toEqual(['bad1', 'bad2']);
  });
});

// ── createEventWorker ──────────────────────────────────────────────────────────

describe('createEventWorker', () => {
  it('consumes the events queue with the given Redis URL and default concurrency', () => {
    createEventWorker('redis://localhost:6379', {});
    expect(mockWorkerCtor).toHaveBeenCalledWith('events', {
      connection: { url: 'redis://localhost:6379' },
      concurrency: 5,
    });
  });

  it('honours a custom concurrency', () => {
    createEventWorker('redis://x', {}, 2);
    expect(mockWorkerCtor).toHaveBeenCalledWith('events', expect.objectContaining({ concurrency: 2 }));
  });

  it('dispatches each job to the registry', async () => {
    const h = handler('h');
    createEventWorker('redis://x', { [TYPE_A]: [h] });
    const event = makeEvent();
    await capturedProcessor!({ data: event });
    expect(h.handle).toHaveBeenCalledWith(event);
  });

  it('propagates handler failure so BullMQ retries the job', async () => {
    createEventWorker('redis://x', { [TYPE_A]: [handler('bad', () => Promise.reject(new Error('down')))] });
    await expect(capturedProcessor!({ data: makeEvent() })).rejects.toThrow(EventHandlerError);
  });

  it('registers a failed-job listener', () => {
    createEventWorker('redis://x', {});
    expect(mockWorkerOn).toHaveBeenCalledWith('failed', expect.any(Function));
  });
});
