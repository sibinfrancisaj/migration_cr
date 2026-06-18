import { z } from 'zod';
import { PromptResponseType } from '@abroad-matrimony/shared';

export const promptIdParamSchema = z.object({
  promptId: z.string().uuid('promptId must be a valid UUID'),
});

export const responseIdParamSchema = z.object({
  responseId: z.string().uuid('responseId must be a valid UUID'),
});

export const respondToPromptSchema = z.object({
  text: z.string().min(1).max(2000),
  type: z.nativeEnum(PromptResponseType).default(PromptResponseType.TEXT),
  mediaUrl: z.string().url().optional(),
});

export const promptResponsesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * PROMPT-003: Schema for POST /api/v1/prompts/current/response
 * Same shape as respondToPromptSchema but named for /current route.
 */
export const currentResponseSchema = z.object({
  text: z.string().min(1).max(2000),
  type: z.nativeEnum(PromptResponseType).default(PromptResponseType.TEXT),
  mediaUrl: z.string().url().optional(),
});

/**
 * PROMPT-004: Query schema for GET /api/v1/prompts/current/responses
 */
export const currentResponsesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type PromptIdParams = z.infer<typeof promptIdParamSchema>;
export type ResponseIdParams = z.infer<typeof responseIdParamSchema>;
export type RespondToPromptBody = z.infer<typeof respondToPromptSchema>;
export type PromptResponsesQuery = z.infer<typeof promptResponsesQuerySchema>;
export type CurrentResponseBody = z.infer<typeof currentResponseSchema>;
export type CurrentResponsesQuery = z.infer<typeof currentResponsesQuerySchema>;
