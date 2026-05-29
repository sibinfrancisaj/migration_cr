import {
  sendConnectionRequest,
  listConnections,
  acceptConnection,
  declineConnection,
  withdrawConnection,
  ConnectionAlreadyExistsError,
  ConnectionNotFoundError,
  ConnectionForbiddenError,
  ConnectionInvalidStatusError,
  BlockedUserError,
} from '../index.js';
import { ConnectionStatus } from '@abroad-matrimony/shared';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockUserBlockFindFirst    = jest.fn();
const mockConnectionFindFirst   = jest.fn();
const mockConnectionCreate      = jest.fn();
const mockConnectionFindMany    = jest.fn();
const mockConnectionFindUnique  = jest.fn();
const mockConnectionUpdate      = jest.fn();
const mockMatchCreate           = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    userBlock: {
      findFirst: (...a: unknown[]) => mockUserBlockFindFirst(...a),
    },
    connection: {
      findFirst:  (...a: unknown[]) => mockConnectionFindFirst(...a),
      create:     (...a: unknown[]) => mockConnectionCreate(...a),
      findMany:   (...a: unknown[]) => mockConnectionFindMany(...a),
      findUnique: (...a: unknown[]) => mockConnectionFindUnique(...a),
      update:     (...a: unknown[]) => mockConnectionUpdate(...a),
    },
    match: {
      create: (...a: unknown[]) => mockMatchCreate(...a),
    },
  },
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const SENDER_ID   = 'user-sender-uuid';
const RECEIVER_ID = 'user-receiver-uuid';
const CONN_ID     = 'conn-uuid-1';

function makeConn(overrides: Partial<{
  id: string;
  senderId: string;
  receiverId: string;
  status: string;
  message: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id:         overrides.id         ?? CONN_ID,
    senderId:   overrides.senderId   ?? SENDER_ID,
    receiverId: overrides.receiverId ?? RECEIVER_ID,
    status:     overrides.status     ?? ConnectionStatus.PENDING,
    message:    overrides.message    ?? null,
    expiresAt:  overrides.expiresAt  ?? new Date(Date.now() + 7 * 86400000),
    createdAt:  overrides.createdAt  ?? new Date('2026-05-01T10:00:00Z'),
    updatedAt:  overrides.updatedAt  ?? new Date('2026-05-01T10:00:00Z'),
  };
}

// ── sendConnectionRequest ──────────────────────────────────────────────────────

describe('sendConnectionRequest', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates and returns a connection when no block or existing connection', async () => {
    mockUserBlockFindFirst.mockResolvedValue(null);
    mockConnectionFindFirst.mockResolvedValue(null);
    const conn = makeConn();
    mockConnectionCreate.mockResolvedValue(conn);

    const result = await sendConnectionRequest(SENDER_ID, RECEIVER_ID, 'Hello!');

    expect(mockConnectionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          senderId: SENDER_ID,
          receiverId: RECEIVER_ID,
          status: ConnectionStatus.PENDING,
          message: 'Hello!',
        }),
      }),
    );
    expect(result.id).toBe(CONN_ID);
    expect(result.status).toBe(ConnectionStatus.PENDING);
    expect(result.otherUser).toBeNull();
  });

  it('creates a connection without optional message', async () => {
    mockUserBlockFindFirst.mockResolvedValue(null);
    mockConnectionFindFirst.mockResolvedValue(null);
    mockConnectionCreate.mockResolvedValue(makeConn({ message: null }));

    const result = await sendConnectionRequest(SENDER_ID, RECEIVER_ID);

    expect(mockConnectionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ message: null }) }),
    );
    expect(result.message).toBeNull();
  });

  it('throws ConnectionAlreadyExistsError when sending to self', async () => {
    await expect(sendConnectionRequest(SENDER_ID, SENDER_ID)).rejects.toBeInstanceOf(
      ConnectionAlreadyExistsError,
    );
    expect(mockUserBlockFindFirst).not.toHaveBeenCalled();
  });

  it('throws BlockedUserError when a block exists', async () => {
    mockUserBlockFindFirst.mockResolvedValue({ id: 'block-1' });

    await expect(sendConnectionRequest(SENDER_ID, RECEIVER_ID)).rejects.toBeInstanceOf(
      BlockedUserError,
    );
    expect(mockConnectionCreate).not.toHaveBeenCalled();
  });

  it('throws ConnectionAlreadyExistsError when a non-cancelled connection exists', async () => {
    mockUserBlockFindFirst.mockResolvedValue(null);
    mockConnectionFindFirst.mockResolvedValue({ id: CONN_ID, status: ConnectionStatus.PENDING });

    await expect(sendConnectionRequest(SENDER_ID, RECEIVER_ID)).rejects.toBeInstanceOf(
      ConnectionAlreadyExistsError,
    );
    expect(mockConnectionCreate).not.toHaveBeenCalled();
  });
});

// ── listConnections ────────────────────────────────────────────────────────────

describe('listConnections', () => {
  beforeEach(() => jest.clearAllMocks());

  const otherProfile = {
    name: 'Priya',
    currentCity: 'London',
    currentCountry: 'UK',
    verificationStatus: 'APPROVED',
    userId: RECEIVER_ID,
  };

  const connRow = {
    ...makeConn(),
    sender: {
      id: SENDER_ID,
      profile: { ...otherProfile, userId: SENDER_ID, name: 'Rahul' },
    },
    receiver: {
      id: RECEIVER_ID,
      profile: otherProfile,
    },
  };

  it('returns all connections when no status filter', async () => {
    mockConnectionFindMany.mockResolvedValue([connRow]);

    const result = await listConnections(SENDER_ID);

    expect(mockConnectionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: [{ senderId: SENDER_ID }, { receiverId: SENDER_ID }] }),
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].otherUser?.name).toBe('Priya');
  });

  it('applies status filter when provided', async () => {
    mockConnectionFindMany.mockResolvedValue([connRow]);

    await listConnections(SENDER_ID, ConnectionStatus.PENDING);

    expect(mockConnectionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: ConnectionStatus.PENDING }),
      }),
    );
  });

  it('returns empty array when no connections', async () => {
    mockConnectionFindMany.mockResolvedValue([]);
    const result = await listConnections(SENDER_ID);
    expect(result).toEqual([]);
  });

  it('sets otherUser correctly when caller is receiver', async () => {
    // caller is RECEIVER_ID, so other user is the sender
    const row = {
      ...makeConn(),
      sender: {
        id: SENDER_ID,
        profile: { ...otherProfile, userId: SENDER_ID, name: 'Rahul' },
      },
      receiver: {
        id: RECEIVER_ID,
        profile: null,
      },
    };
    mockConnectionFindMany.mockResolvedValue([row]);

    const result = await listConnections(RECEIVER_ID);
    // other user is sender (Rahul)
    expect(result[0].otherUser?.name).toBe('Rahul');
  });
});

// ── acceptConnection ───────────────────────────────────────────────────────────

describe('acceptConnection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('accepts connection and creates a Match', async () => {
    mockConnectionFindUnique.mockResolvedValue(makeConn());
    mockConnectionUpdate.mockResolvedValue(makeConn({ status: ConnectionStatus.ACCEPTED }));
    mockMatchCreate.mockResolvedValue({ id: 'match-1' });

    const result = await acceptConnection(CONN_ID, RECEIVER_ID);

    expect(mockConnectionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: ConnectionStatus.ACCEPTED } }),
    );
    expect(mockMatchCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userAId: SENDER_ID,
          userBId: RECEIVER_ID,
          connectionId: CONN_ID,
        }),
      }),
    );
    expect(result.status).toBe(ConnectionStatus.ACCEPTED);
  });

  it('throws ConnectionNotFoundError when connection does not exist', async () => {
    mockConnectionFindUnique.mockResolvedValue(null);

    await expect(acceptConnection(CONN_ID, RECEIVER_ID)).rejects.toBeInstanceOf(
      ConnectionNotFoundError,
    );
  });

  it('throws ConnectionForbiddenError when caller is not the receiver', async () => {
    mockConnectionFindUnique.mockResolvedValue(makeConn());

    // SENDER_ID is trying to accept — they're the sender, not receiver
    await expect(acceptConnection(CONN_ID, SENDER_ID)).rejects.toBeInstanceOf(
      ConnectionForbiddenError,
    );
    expect(mockConnectionUpdate).not.toHaveBeenCalled();
  });

  it('throws ConnectionInvalidStatusError when connection is not PENDING', async () => {
    mockConnectionFindUnique.mockResolvedValue(makeConn({ status: ConnectionStatus.ACCEPTED }));

    await expect(acceptConnection(CONN_ID, RECEIVER_ID)).rejects.toBeInstanceOf(
      ConnectionInvalidStatusError,
    );
  });
});

// ── declineConnection ──────────────────────────────────────────────────────────

describe('declineConnection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('declines a PENDING connection', async () => {
    mockConnectionFindUnique.mockResolvedValue(makeConn());
    mockConnectionUpdate.mockResolvedValue(makeConn({ status: ConnectionStatus.DECLINED }));

    const result = await declineConnection(CONN_ID, RECEIVER_ID);

    expect(mockConnectionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: ConnectionStatus.DECLINED } }),
    );
    expect(result.status).toBe(ConnectionStatus.DECLINED);
  });

  it('throws ConnectionNotFoundError when not found', async () => {
    mockConnectionFindUnique.mockResolvedValue(null);

    await expect(declineConnection(CONN_ID, RECEIVER_ID)).rejects.toBeInstanceOf(
      ConnectionNotFoundError,
    );
  });

  it('throws ConnectionForbiddenError when caller is not the receiver', async () => {
    mockConnectionFindUnique.mockResolvedValue(makeConn());

    await expect(declineConnection(CONN_ID, SENDER_ID)).rejects.toBeInstanceOf(
      ConnectionForbiddenError,
    );
  });

  it('throws ConnectionInvalidStatusError when not PENDING', async () => {
    mockConnectionFindUnique.mockResolvedValue(makeConn({ status: ConnectionStatus.WITHDRAWN }));

    await expect(declineConnection(CONN_ID, RECEIVER_ID)).rejects.toBeInstanceOf(
      ConnectionInvalidStatusError,
    );
  });
});

// ── withdrawConnection ─────────────────────────────────────────────────────────

describe('withdrawConnection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('withdraws a PENDING connection by the sender', async () => {
    mockConnectionFindUnique.mockResolvedValue(makeConn());
    mockConnectionUpdate.mockResolvedValue(makeConn({ status: ConnectionStatus.WITHDRAWN }));

    const result = await withdrawConnection(CONN_ID, SENDER_ID);

    expect(mockConnectionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: ConnectionStatus.WITHDRAWN } }),
    );
    expect(result.status).toBe(ConnectionStatus.WITHDRAWN);
  });

  it('throws ConnectionNotFoundError when not found', async () => {
    mockConnectionFindUnique.mockResolvedValue(null);

    await expect(withdrawConnection(CONN_ID, SENDER_ID)).rejects.toBeInstanceOf(
      ConnectionNotFoundError,
    );
  });

  it('throws ConnectionForbiddenError when caller is not the sender', async () => {
    mockConnectionFindUnique.mockResolvedValue(makeConn());

    // RECEIVER_ID tries to withdraw — only sender can withdraw
    await expect(withdrawConnection(CONN_ID, RECEIVER_ID)).rejects.toBeInstanceOf(
      ConnectionForbiddenError,
    );
  });

  it('throws ConnectionInvalidStatusError when not PENDING', async () => {
    mockConnectionFindUnique.mockResolvedValue(makeConn({ status: ConnectionStatus.ACCEPTED }));

    await expect(withdrawConnection(CONN_ID, SENDER_ID)).rejects.toBeInstanceOf(
      ConnectionInvalidStatusError,
    );
  });
});
