export const TRUST_ERRORS = {
  ALREADY_BLOCKED: 'User already blocked',
  BLOCK_NOT_FOUND: 'Block not found',
  BLOCK_SELF: 'Cannot block yourself',
  REPORT_SELF: 'Cannot report yourself',
} as const;

export const TRUST_MESSAGES = {
  BLOCKED: 'User blocked',
  UNBLOCKED: 'User unblocked',
  REPORT_SUBMITTED: 'Report submitted',
} as const;
