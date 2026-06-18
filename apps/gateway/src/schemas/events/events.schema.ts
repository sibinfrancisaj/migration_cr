import { z } from 'zod';
import { EventTag } from '@abroad-matrimony/shared';

export const eventIdParamSchema = z.object({
  eventId: z.string().uuid('eventId must be a valid UUID'),
});

export const listEventsQuerySchema = z.object({
  tag:      z.nativeEnum(EventTag).optional(),
  limit:    z.string().optional()
              .transform(v => (v ? parseInt(v, 10) : undefined))
              .pipe(z.number().int().min(1).max(100).optional()),
  upcoming: z.enum(['true', 'false']).optional()
              .transform(v => v === undefined ? true : v === 'true'),
});

export type EventIdParams   = z.infer<typeof eventIdParamSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
