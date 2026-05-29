export const GROUP_ERRORS = {
  NOT_FOUND: 'Group not found',
  ALREADY_MEMBER: 'You are already a member of this group',
  NOT_MEMBER: 'You are not a member of this group',
  GROUP_FULL: 'This group is at full capacity',
  ACCESS_DENIED: 'This group requires an invitation to join',
} as const;

export const GROUP_MESSAGES = {
  JOINED: 'Successfully joined the group',
  LEFT: 'Successfully left the group',
} as const;
