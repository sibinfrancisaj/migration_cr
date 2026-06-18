import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { ConnectionStatus } from '@abroad-matrimony/shared';

const log = createChildLogger({ module: 'connections' });

// ─── Custom errors ────────────────────────────────────────────────────────────

export class ConnectionAlreadyExistsError extends Error {
  constructor() {
    super('CONNECTION_ALREADY_EXISTS');
    this.name = 'ConnectionAlreadyExistsError';
  }
}

export class ConnectionNotFoundError extends Error {
  constructor() {
    super('CONNECTION_NOT_FOUND');
    this.name = 'ConnectionNotFoundError';
  }
}

export class ConnectionForbiddenError extends Error {
  constructor() {
    super('CONNECTION_FORBIDDEN');
    this.name = 'ConnectionForbiddenError';
  }
}

export class ConnectionInvalidStatusError extends Error {
  constructor(message = 'CONNECTION_INVALID_STATUS') {
    super(message);
    this.name = 'ConnectionInvalidStatusError';
  }
}

export class BlockedUserError extends Error {
  constructor() {
    super('USER_IS_BLOCKED');
    this.name = 'BlockedUserError';
  }
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface ConnectionDto {
  id: string;
  senderId: string;
  receiverId: string;
  status: string;
  message: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  otherUser: {
    id: string;
    name: string;
    currentCity: string;
    currentCountry: string;
    verificationStatus: string;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toConnectionDto(
  row: {
    id: string;
    senderId: string;
    receiverId: string;
    status: string;
    message: string | null;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
  otherProfile: {
    userId: string;
    name: string;
    currentCity: string;
    currentCountry: string;
    verificationStatus: string;
  } | null = null,
): ConnectionDto {
  return {
    id: row.id,
    senderId: row.senderId,
    receiverId: row.receiverId,
    status: row.status,
    message: row.message,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    otherUser: otherProfile
      ? {
          id: otherProfile.userId,
          name: otherProfile.name,
          currentCity: otherProfile.currentCity,
          currentCountry: otherProfile.currentCountry,
          verificationStatus: otherProfile.verificationStatus,
        }
      : null,
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Send a connection request from `senderId` to `receiverId`.
 *
 * Rules:
 *  - Cannot send to yourself.
 *  - Cannot send if a non-expired connection already exists in either direction.
 *  - Cannot send to a user who has blocked you (or whom you have blocked).
 *
 * @throws {ConnectionAlreadyExistsError}
 * @throws {BlockedUserError}
 */
export async function sendConnectionRequest(
  senderId: string,
  receiverId: string,
  message?: string,
): Promise<ConnectionDto> {
  if (senderId === receiverId) {
    throw new ConnectionAlreadyExistsError();
  }

  // Check for block in either direction
  const block = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: senderId, blockedId: receiverId },
        { blockerId: receiverId, blockedId: senderId },
      ],
    },
    select: { id: true },
  });

  if (block) {
    log.warn('sendConnectionRequest — blocked user', { senderId, receiverId });
    throw new BlockedUserError();
  }

  // Check for existing connection in either direction (non-expired/cancelled)
  const existing = await prisma.connection.findFirst({
    where: {
      OR: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
      status: { notIn: [ConnectionStatus.CANCELLED, ConnectionStatus.EXPIRED, ConnectionStatus.DECLINED] },
    },
    select: { id: true, status: true },
  });

  if (existing) {
    log.warn('sendConnectionRequest — connection already exists', { senderId, receiverId, status: existing.status });
    throw new ConnectionAlreadyExistsError();
  }

  // Expire: 7 days from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const conn = await prisma.connection.create({
    data: {
      senderId,
      receiverId,
      status: ConnectionStatus.PENDING,
      message: message ?? null,
      expiresAt,
    },
  });

  log.info('sendConnectionRequest — created', { connectionId: conn.id, senderId, receiverId });

  return toConnectionDto(conn);
}

/**
 * List all connections for a user (sent + received), ordered by most recent.
 * Optionally filter by status.
 */
export async function listConnections(
  userId: string,
  status?: ConnectionStatus,
): Promise<ConnectionDto[]> {
  const where = status
    ? {
        OR: [{ senderId: userId }, { receiverId: userId }],
        status,
      }
    : {
        OR: [{ senderId: userId }, { receiverId: userId }],
      };

  const rows = await prisma.connection.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      sender: { include: { profile: true } },
      receiver: { include: { profile: true } },
    },
  });

  return rows.map((row) => {
    const otherUser = row.senderId === userId ? row.receiver : row.sender;
    const profile = otherUser.profile;
    return toConnectionDto(row, profile ? { ...profile } : null);
  });
}

/**
 * Accept an incoming connection request.
 *
 * On accept: creates a Match record (and eventually a Conversation).
 *
 * @throws {ConnectionNotFoundError}
 * @throws {ConnectionForbiddenError} — caller is not the receiver
 * @throws {ConnectionInvalidStatusError} — connection is not PENDING
 */
export async function acceptConnection(
  connectionId: string,
  userId: string,
): Promise<ConnectionDto> {
  const conn = await prisma.connection.findUnique({
    where: { id: connectionId },
    select: {
      id: true, senderId: true, receiverId: true, status: true,
      message: true, expiresAt: true, createdAt: true, updatedAt: true,
    },
  });

  if (!conn) {
    throw new ConnectionNotFoundError();
  }

  if (conn.receiverId !== userId) {
    log.warn('acceptConnection — forbidden', { connectionId, userId });
    throw new ConnectionForbiddenError();
  }

  if (conn.status !== ConnectionStatus.PENDING) {
    throw new ConnectionInvalidStatusError();
  }

  const updated = await prisma.connection.update({
    where: { id: connectionId },
    data: { status: ConnectionStatus.ACCEPTED },
  });

  // Create a Match record
  await prisma.match.create({
    data: {
      userAId: conn.senderId,
      userBId: conn.receiverId,
      connectionId,
    },
  });

  log.info('acceptConnection — accepted + match created', {
    connectionId,
    userA: conn.senderId,
    userB: conn.receiverId,
  });

  return toConnectionDto(updated);
}

/**
 * Decline an incoming connection request.
 *
 * @throws {ConnectionNotFoundError}
 * @throws {ConnectionForbiddenError} — caller is not the receiver
 * @throws {ConnectionInvalidStatusError} — connection is not PENDING
 */
export async function declineConnection(
  connectionId: string,
  userId: string,
): Promise<ConnectionDto> {
  const conn = await prisma.connection.findUnique({
    where: { id: connectionId },
    select: {
      id: true, senderId: true, receiverId: true, status: true,
      message: true, expiresAt: true, createdAt: true, updatedAt: true,
    },
  });

  if (!conn) {
    throw new ConnectionNotFoundError();
  }

  if (conn.receiverId !== userId) {
    log.warn('declineConnection — forbidden', { connectionId, userId });
    throw new ConnectionForbiddenError();
  }

  if (conn.status !== ConnectionStatus.PENDING) {
    throw new ConnectionInvalidStatusError();
  }

  const updated = await prisma.connection.update({
    where: { id: connectionId },
    data: { status: ConnectionStatus.DECLINED },
  });

  log.info('declineConnection — declined', { connectionId, userId });

  return toConnectionDto(updated);
}

/**
 * Withdraw / cancel a connection request sent by `userId`.
 *
 * @throws {ConnectionNotFoundError}
 * @throws {ConnectionForbiddenError} — caller is not the sender
 * @throws {ConnectionInvalidStatusError} — not in a withdrawable state
 */
export async function withdrawConnection(
  connectionId: string,
  userId: string,
): Promise<ConnectionDto> {
  const conn = await prisma.connection.findUnique({
    where: { id: connectionId },
    select: {
      id: true, senderId: true, receiverId: true, status: true,
      message: true, expiresAt: true, createdAt: true, updatedAt: true,
    },
  });

  if (!conn) {
    throw new ConnectionNotFoundError();
  }

  if (conn.senderId !== userId) {
    log.warn('withdrawConnection — forbidden', { connectionId, userId });
    throw new ConnectionForbiddenError();
  }

  if (conn.status !== ConnectionStatus.PENDING) {
    throw new ConnectionInvalidStatusError();
  }

  const updated = await prisma.connection.update({
    where: { id: connectionId },
    data: { status: ConnectionStatus.WITHDRAWN },
  });

  log.info('withdrawConnection — withdrawn', { connectionId, userId });

  return toConnectionDto(updated);
}
