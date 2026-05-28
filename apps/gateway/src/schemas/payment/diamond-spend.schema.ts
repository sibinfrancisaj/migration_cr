import { z } from 'zod';
import { DiamondReason } from '@abroad-matrimony/shared';

export const diamondSpendBodySchema = z.object({
  amount: z.number().int().positive(),
  reason: z.nativeEnum(DiamondReason),
  /** Optional context stored in ledger metadata */
  reference: z.string().max(100).optional(),
});

export type DiamondSpendBody = z.infer<typeof diamondSpendBodySchema>;
