export const PROMPT_ERRORS = {
  NOT_FOUND: 'Prompt not found or expired',
  RESPONSE_NOT_FOUND: 'Prompt response not found',
  ALREADY_RESPONDED: 'Already responded to this prompt',
  ALREADY_RESONATED: 'Already resonated with this response',
  RESONATE_NOT_FOUND: 'Resonate reaction not found',
} as const;

export const PROMPT_MESSAGES = {
  RESPONSE_SUBMITTED: 'Response submitted',
  RESONATED: 'Resonated',
  RESONATE_REMOVED: 'Resonate removed',
} as const;
