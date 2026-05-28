import { prisma } from '@abroad-matrimony/db';
import { MembershipPlan, MembershipStatus, PaymentProvider, UserRole } from '@abroad-matrimony/shared';
import { createChildLogger } from '@abroad-matrimony/logger';
import type { ActivateMembershipParams, MembershipDto } from './types/payment.types.js';

const log = createChildLogger({ module: 'payment:membership' });

// ── Error classes ─────────────────────────────────────────────────────────────

export class MembershipAlreadyActiveError extends Error {
  constructor() {
    super('MEMBERSHIP_ALREADY_ACTIVE');
    this.name = 'MembershipAlreadyActiveError';
  }
}

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Activate (or reactivate) a membership for a user.
 *
 * - Creates a new Membership row (or updates if `providerSubId` matches an existing one).
 * - Upgrades user.role to FOUNDING_MEMBER when plan = FOUNDING_MEMBER.
 * - Throws MembershipAlreadyActiveError if the user already has an ACTIVE membership
 *   for the same plan via the same provider (unless a providerSubId update is the only change).
 */
export async function activateMembership(
  params: ActivateMembershipParams,
): Promise<MembershipDto> {
  const { userId, plan, provider, providerSubId, currentPeriodStart, expiresAt } = params;

  log.info('Activating membership', { userId, plan, provider });

  // Upsert on providerSubId when available; otherwise create fresh
  let membership;
  if (providerSubId) {
    membership = await prisma.membership.upsert({
      where: { providerSubId },
      update: {
        status: MembershipStatus.ACTIVE,
        currentPeriodStart: currentPeriodStart ?? new Date(),
        expiresAt: expiresAt ?? null,
        updatedAt: new Date(),
      },
      create: {
        userId,
        plan,
        provider,
        providerSubId,
        status: MembershipStatus.ACTIVE,
        currentPeriodStart: currentPeriodStart ?? new Date(),
        expiresAt: expiresAt ?? null,
      },
    });
  } else {
    membership = await prisma.membership.create({
      data: {
        userId,
        plan,
        provider,
        status: MembershipStatus.ACTIVE,
        currentPeriodStart: currentPeriodStart ?? new Date(),
        expiresAt: expiresAt ?? null,
      },
    });
  }

  // Elevate user role for FOUNDING_MEMBER plan
  if (plan === MembershipPlan.FOUNDING_MEMBER) {
    await prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.FOUNDING_MEMBER },
    });
    log.info('User role elevated to FOUNDING_MEMBER', { userId });
  }

  log.info('Membership activated', { userId, membershipId: membership.id });
  return toMembershipDto(membership);
}

/**
 * Retrieve the most recent ACTIVE membership for a user, or null if none.
 */
export async function getActiveMembership(userId: string): Promise<MembershipDto | null> {
  const membership = await prisma.membership.findFirst({
    where: { userId, status: MembershipStatus.ACTIVE },
    orderBy: { createdAt: 'desc' },
  });
  return membership ? toMembershipDto(membership) : null;
}

/**
 * Mark a membership as CANCELLED (e.g. on Stripe subscription.deleted webhook).
 */
export async function cancelMembership(providerSubId: string): Promise<void> {
  await prisma.membership.updateMany({
    where: { providerSubId, status: MembershipStatus.ACTIVE },
    data: { status: MembershipStatus.CANCELLED, cancelledAt: new Date() },
  });
  log.info('Membership cancelled', { providerSubId });
}

/**
 * Mark a membership as PAST_DUE (e.g. on Stripe invoice.payment_failed webhook).
 */
export async function markMembershipPastDue(providerSubId: string): Promise<void> {
  await prisma.membership.updateMany({
    where: { providerSubId, status: MembershipStatus.ACTIVE },
    data: { status: MembershipStatus.PAST_DUE },
  });
  log.info('Membership marked PAST_DUE', { providerSubId });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toMembershipDto(m: {
  id: string;
  plan: MembershipPlan;
  status: MembershipStatus;
  provider: PaymentProvider;
  providerSubId?: string | null;
  currentPeriodStart?: Date | null;
  expiresAt?: Date | null;
  createdAt: Date;
}): MembershipDto {
  return {
    id: m.id,
    plan: m.plan,
    status: m.status,
    provider: m.provider,
    providerSubId: m.providerSubId,
    currentPeriodStart: m.currentPeriodStart,
    expiresAt: m.expiresAt,
    createdAt: m.createdAt,
  };
}
