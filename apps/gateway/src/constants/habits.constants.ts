export const HABIT_ERRORS = {
  NOT_FOUND: 'Habit log entry not found',
  ALREADY_LOGGED: 'You have already logged this habit for this date',
  PROFILE_NOT_FOUND: 'User profile not found',
} as const;

export const HABIT_MESSAGES = {
  LOGGED: 'Habit logged successfully',
  DELETED: 'Habit log deleted',
  REFLECTION_SAVED: 'Reflection saved',
  VISIBILITY_UPDATED: 'Habit summary visibility updated',
} as const;
