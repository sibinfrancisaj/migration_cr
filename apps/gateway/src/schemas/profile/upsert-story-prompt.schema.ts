import { z } from 'zod';
import { StoryPromptKey } from '@abroad-matrimony/shared';

// ── Route params schema ───────────────────────────────────────────────────────

export const storyPromptParamsSchema = z.object({
  promptKey: z.nativeEnum(StoryPromptKey, {
    required_error: 'Prompt key is required.',
    invalid_type_error:
      `Invalid promptKey. Must be one of: ${Object.values(StoryPromptKey).join(', ')}.`,
  }),
});

export type StoryPromptParams = z.infer<typeof storyPromptParamsSchema>;

// ── Request body schema ───────────────────────────────────────────────────────

export const upsertStoryPromptSchema = z.object({
  answer: z
    .string({ required_error: 'Answer is required.' })
    .min(1,    'Answer cannot be empty.')
    .max(1000, 'Answer must not exceed 1000 characters.'),
});

export type UpsertStoryPromptBody = z.infer<typeof upsertStoryPromptSchema>;
