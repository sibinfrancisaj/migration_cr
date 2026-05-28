import { prisma } from '@abroad-matrimony/db';
import { DiamondReason } from '@abroad-matrimony/shared';
import { createChildLogger } from '@abroad-matrimony/logger';
import type { CreditDiamondsParams, DiamondPackage } from './types/payment.types.js';

const log = createChildLogger({ module: 'payment:diamond' });

// ── Error classes ─────────────────────────────────────────────────────────────

export class InsufficientDiamondsError extends Error {
  constructor() {
    super('INSUFFICIENT_DIAMONDS');
    this.name = 'InsufficientDiamondsError';
  }
}

// ── Diamond packages ──────────────────────────────────────────────────────────

export const DIAMOND_PACKAGES: Record<string, DiamondPackage> = {
  DIAMONDS_50:  { packageKey: 'DIAMONDS_50',  diamonds: 50,  amountPaise: 49900,  currency: 'INR', description: '50 Diamonds (₹499)' },
  DIAMONDS_100: { packageKey: 'DIAMONDS_100', diamonds: 100, amountPaise: 89900,  currency: 'INR', description: '100 Diamonds (₹899)' },
  DIAMONDS_200: { packageKey: 'DIAMONDS_200', diamonds: 200, amountPaise: 149900, currency: 'INR', description: '200 Diamonds (₹1499)' },
};

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Return the user's current diamond balance.
 * Reads the latest `balanceAfter` from the append-only ledger.
 * Returns 0 if no entries exist.
 */
export async function getDiamondBalance(userId: string): Promise<number> {
  const latest = await prisma.diamondLedger.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { balanceAfter: true },
  });
  return latest?.balanceAfter ?? 0;
}

/**
 * Credit diamonds to a user's account.
 * Inserts an append-only DiamondLedger row inside a transaction.
 * Returns the new balance.
 */
export async function creditDiamonds(params: CreditDiamondsParams): Promise<number> {
  const { userId, delta, reason, metadata } = params;

  if (delta <= 0) {
    throw new Error(`creditDiamonds: delta must be positive, got ${delta}`);
  }

  const newBalance = await prisma.$transaction(async (tx) => {
    const latest = await tx.diamondLedger.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { balanceAfter: true },
    });
    const currentBalance = latest?.balanceAfter ?? 0;
    const balanceAfter = currentBalance + delta;

    await tx.diamondLedger.create({
      data: {
        userId,
        delta,
        reason,
        balanceAfter,
        metadata: metadata ? (metadata as object) : undefined,
      },
    });

    return balanceAfter;
  });

  log.info('Diamonds credited', { userId, delta, reason, newBalance });
  return newBalance;
}

/**
 * Deduct diamonds from a user's account.
 * Throws InsufficientDiamondsError if balance would go below 0.
 * Uses a DB transaction for atomicity.
 * Returns the new balance.
 */
export async function spendDiamonds(
  userId: string,
  amount: number,
  reason: DiamondReason,
  metadata?: Record<string, unknown>,
): Promise<number> {
  if (amount <= 0) {
    throw new Error(`spendDiamonds: amount must be positive, got ${amount}`);
  }

  const newBalance = await prisma.$transaction(async (tx) => {
    const latest = await tx.diamondLedger.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { balanceAfter: true },
    });
    const currentBalance = latest?.balanceAfter ?? 0;

    if (currentBalance < amount) {
      throw new InsufficientDiamondsError();
    }

    const balanceAfter = currentBalance - amount;

    await tx.diamondLedger.create({
      data: {
        userId,
        delta: -amount,
        reason,
        balanceAfter,
        metadata: metadata ? (metadata as object) : undefined,
      },
    });

    return balanceAfter;
  });

  log.info('Diamonds spent', { userId, amount, reason, newBalance });
  return newBalance;
}

/**
 * Insert a REFUND ledger entry (positive delta).
 * Used when a diamond purchase payment is refunded.
 * Returns the new balance.
 */
export async function refundDiamonds(
  userId: string,
  amount: number,
  metadata?: Record<string, unknown>,
): Promise<number> {
  return creditDiamonds({
    userId,
    delta: amount,
    reason: DiamondReason.REFUND,
    metadata,
  });
}
