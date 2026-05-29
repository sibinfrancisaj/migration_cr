import { z } from 'zod';

export const groupIdParamSchema = z.object({
  groupId: z.string().uuid('groupId must be a valid UUID'),
});

export const listGroupsQuerySchema = z.object({
  country: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
});

export type GroupIdParams = z.infer<typeof groupIdParamSchema>;
export type ListGroupsQuery = z.infer<typeof listGroupsQuerySchema>;
