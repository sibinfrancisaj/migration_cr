export const CONNECTION_ERRORS = {
  NOT_FOUND: 'Connection not found',
  FORBIDDEN: 'You are not allowed to perform this action on this connection',
  ALREADY_EXISTS: 'A connection request already exists with this user',
  INVALID_STATUS: 'This connection is not in a valid state for this action',
  BLOCKED: 'Cannot connect with this user',
} as const;

export const CONNECTION_MESSAGES = {
  REQUEST_SENT: 'Connection request sent',
  ACCEPTED: 'Connection accepted',
  DECLINED: 'Connection declined',
  WITHDRAWN: 'Connection request withdrawn',
} as const;
