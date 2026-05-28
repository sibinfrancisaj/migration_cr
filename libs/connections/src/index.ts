/**
 * @abroad-matrimony/connections — Phase 5 stub
 *
 * Error classes and service function signatures are declared now so that:
 *   - The gateway routes/connections router can import them for type safety
 *   - Test mocks can reference the real module shape
 *
 * Full business logic will be implemented in Phase 5 (Connections & Messaging).
 */

// ── Domain errors ─────────────────────────────────────────────────────────────

export class ConnectionAlreadyExistsError extends Error {
  constructor() {
    super('A connection request between these users already exists');
    this.name = 'ConnectionAlreadyExistsError';
  }
}

export class ConnectionNotFoundError extends Error {
  constructor() {
    super('Connection not found');
    this.name = 'ConnectionNotFoundError';
  }
}

export class ConnectionForbiddenError extends Error {
  constructor() {
    super('You are not allowed to perform this action on this connection');
    this.name = 'ConnectionForbiddenError';
  }
}

// ── Service stubs ─────────────────────────────────────────────────────────────

/** Phase 5: sends a connection request from `senderId` to `receiverId`. */
export async function sendConnectionService(
  _senderId: string,
  _receiverId: string,
): Promise<void> {
  throw new Error('sendConnectionService not yet implemented');
}

/** Phase 5: accepts an incoming connection request on behalf of `userId`. */
export async function acceptConnectionService(
  _connectionId: string,
  _userId: string,
): Promise<void> {
  throw new Error('acceptConnectionService not yet implemented');
}

/** Phase 5: declines an incoming connection request on behalf of `userId`. */
export async function declineConnectionService(
  _connectionId: string,
  _userId: string,
): Promise<void> {
  throw new Error('declineConnectionService not yet implemented');
}
