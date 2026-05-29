import { z } from 'zod';
import { EventTag } from '@abroad-matrimony/shared';

export const eventIdParamSchema = z.object({
  eventId: z.string().uuid('eventId must be a valid UUID'),
});

export const listEventsQuerySchema = z.object({
  tag: z.nativeEnum(EventTag).optional(),
});

export type EventIdParams = z.infer<typeof eventIdParamSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
