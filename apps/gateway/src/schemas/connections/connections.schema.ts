import { z } from 'zod';
import { ConnectionStatus } from '@abroad-matrimony/shared';

export const sendConnectionSchema = z.object({
  receiverId: z.string().uuid('receiverId must be a valid UUID'),
  message: z.string().max(500).optional(),
});

export const connectionIdParamSchema = z.object({
  connectionId: z.string().uuid('connectionId must be a valid UUID'),
});

export const listConnectionsQuerySchema = z.object({
  status: z.nativeEnum(ConnectionStatus).optional(),
});

export type SendConnectionBody = z.infer<typeof sendConnectionSchema>;
export type ConnectionIdParams = z.infer<typeof connectionIdParamSchema>;
export type ListConnectionsQuery = z.infer<typeof listConnectionsQuerySchema>;
