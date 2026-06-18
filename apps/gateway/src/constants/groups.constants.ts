export const GROUP_ERRORS = {
  NOT_FOUND: 'Group not found',
  ALREADY_MEMBER: 'You are already a member of this group',
  NOT_MEMBER: 'You are not a member of this group',
  GROUP_FULL: 'This group is at full capacity',
  ACCESS_DENIED: 'This group requires an invitation to join',
  POST_NOT_FOUND: 'Post not found',
  POST_FORBIDDEN: 'You do not have permission to perform this action on this post',
  PROPOSAL_NOT_FOUND: 'Group proposal not found',
  ALREADY_PROPOSED: 'You already have a pending proposal with this name',
  PROPOSAL_NOT_PENDING: 'This proposal has already been reviewed',
} as const;

export const GROUP_MESSAGES = {
  JOINED: 'Successfully joined the group',
  LEFT: 'Successfully left the group',
  POST_CREATED: 'Post created successfully',
  POST_DELETED: 'Post deleted successfully',
  LIKED: 'Post liked',
  UNLIKED: 'Post unliked',
  COMMENT_ADDED: 'Comment added',
  PINNED: 'Post pinned',
  UNPINNED: 'Post unpinned',
  PROPOSAL_CREATED: 'Group proposal submitted for review',
  PROPOSAL_APPROVED: 'Group proposal approved',
  PROPOSAL_REJECTED: 'Group proposal rejected',
} as const;
