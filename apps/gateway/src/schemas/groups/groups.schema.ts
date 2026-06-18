import { z } from 'zod';

export const groupIdParamSchema = z.object({
  groupId: z.string().uuid('groupId must be a valid UUID'),
});

export const postIdParamSchema = z.object({
  postId: z.string().uuid('postId must be a valid UUID'),
});

export const groupAndPostParamSchema = z.object({
  groupId: z.string().uuid('groupId must be a valid UUID'),
  postId:  z.string().uuid('postId must be a valid UUID'),
});

export const listGroupsQuerySchema = z.object({
  country: z.string().max(100).optional(),
  region:  z.string().max(100).optional(),
});

export const paginationQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createPostSchema = z.object({
  text:        z.string().min(1).max(5000).optional(),
  imageUrl:    z.string().url().optional(),
  linkUrl:     z.string().url().optional(),
  linkTitle:   z.string().max(200).optional(),
  linkPreview: z.string().max(500).optional(),
}).refine(
  (d) => d.text || d.imageUrl || d.linkUrl,
  { message: 'At least one of text, imageUrl, or linkUrl is required' },
);

export const addCommentSchema = z.object({
  text: z.string().min(1).max(2000),
});

export const proposeGroupSchema = z.object({
  name:        z.string().min(3).max(100),
  description: z.string().min(10).max(1000),
  country:     z.string().max(100).optional(),
  rationale:   z.string().min(10).max(500),
});

export const suggestedGroupsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type GroupIdParams          = z.infer<typeof groupIdParamSchema>;
export type PostIdParams           = z.infer<typeof postIdParamSchema>;
export type GroupAndPostParams     = z.infer<typeof groupAndPostParamSchema>;
export type ListGroupsQuery        = z.infer<typeof listGroupsQuerySchema>;
export type PaginationQuery        = z.infer<typeof paginationQuerySchema>;
export type CreatePostBody         = z.infer<typeof createPostSchema>;
export type AddCommentBody         = z.infer<typeof addCommentSchema>;
export type ProposeGroupBody       = z.infer<typeof proposeGroupSchema>;
export type SuggestedGroupsQuery   = z.infer<typeof suggestedGroupsQuerySchema>;
