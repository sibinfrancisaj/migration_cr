/**
 * PROD-004 — Subscription renewal reminder service.
 *
 * Queries memberships expiring within 3 days and 1 day, sends push + email
 * reminders, and stamps `renewalReminderSentAt` to prevent duplicates.
 *
 * Called by a daily BullMQ cron job (renewal-reminder.worker.ts).
 */
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { enqueueNotification } from '@abroad-matrimony/notification';
import { NotificationType } from '@abroad-matrimony/notification';
import { getEnv } from '@abroad-matrimony/config';

const log = createChildLogger({ module: 'payment:renewal-reminder' });

const REMINDER_WINDOWS_DAYS = [3, 1] as const;

export interface RenewalReminderResult {
  reminded: number;
  skipped: number;
}

/**
 * Sends renewal reminders for memberships expiring in 1d or 3d.
 * Idempotent — `renewalReminderSentAt` prevents a second send for the same cycle.
 */
export async function sendMembershipRenewalReminders(): Promise<RenewalReminderResult> {
  const env = getEnv();
  const now = new Date();

  // Upper bound: 3 days from now; lower bound: memberships that haven't expired yet
  const upperBound = new Date(now.getTime() + REMINDER_WINDOWS_DAYS[0] * 24 * 60 * 60 * 1000);

  const memberships = await prisma.membership.findMany({
    where: {
      status: 'ACTIVE',
      expiresAt: { gte: now, lte: upperBound },
      renewalReminderSentAt: null,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          emailUnsubscribed: true,
          devices: {
            where: { pushToken: { not: null } },
            select: { pushToken: true },
            take: 1,
          },
          profile: { select: { name: true } },
        },
      },
    },
  });

  let reminded = 0;
  let skipped = 0;

  for (const membership of memberships) {
    const { user } = membership;
    const expiresAt = membership.expiresAt!;
    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const name = user.profile?.name ?? 'Member';

    try {
      // Push notification
      const pushToken = user.devices[0]?.pushToken;
      if (pushToken) {
        await enqueueNotification(env.REDIS_URL, {
          type: NotificationType.PUSH,
          payload: {
            deviceToken: pushToken,
            title: 'Membership Expiring Soon',
            body: `Hi ${name}, your Founding Member subscription expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Renew to keep access.`,
            data: { membershipId: membership.id, daysLeft: String(daysLeft) },
            userId: user.id,
          },
        });
      }

      // Email notification (skip if unsubscribed)
      if (user.email && !user.emailUnsubscribed) {
        await enqueueNotification(env.REDIS_URL, {
          type: NotificationType.EMAIL,
          payload: {
            to: user.email,
            toName: name,
            subject: `Your Founding Member subscription expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
            htmlBody: `<p>Hi ${name},</p><p>Your Founding Member subscription expires on <strong>${expiresAt.toDateString()}</strong>.</p><p>Renew now to keep your full access and diamond benefits.</p>`,
            userId: user.id,
          },
        });
      }

      // Stamp so we don't re-send
      await prisma.membership.update({
        where: { id: membership.id },
        data: { renewalReminderSentAt: now },
      });

      reminded++;
      log.info('Renewal reminder sent', { membershipId: membership.id, userId: user.id, daysLeft });
    } catch (err) {
      log.error('Failed to send renewal reminder', { membershipId: membership.id, err });
      skipped++;
    }
  }

  log.info('Renewal reminder run complete', { reminded, skipped });
  return { reminded, skipped };
}
