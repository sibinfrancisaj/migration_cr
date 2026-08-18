/**
 * PROD-005 — Notification preferences per user.
 *
 * Stores per-user channel opt-out choices in the notification_preferences table.
 * Defaults to all enabled when no preference row exists (opt-out model).
 */
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';

const log = createChildLogger({ module: 'notification:preferences' });

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface NotificationPreferenceDto {
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  marketingEnabled: boolean;
}

export interface UpdateNotificationPreferenceInput {
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  pushEnabled?: boolean;
  marketingEnabled?: boolean;
}

// ── Service ───────────────────────────────────────────────────────────────────

const DEFAULT_PREFS: NotificationPreferenceDto = {
  emailEnabled: true,
  smsEnabled: true,
  pushEnabled: true,
  marketingEnabled: true,
};

/**
 * Returns the user's notification preferences.
 * Returns all-enabled defaults when no preference row exists (opt-out model).
 */
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferenceDto> {
  const row = await prisma.notificationPreference.findUnique({ where: { userId } });

  if (!row) return { ...DEFAULT_PREFS };

  return {
    emailEnabled: row.emailEnabled,
    smsEnabled: row.smsEnabled,
    pushEnabled: row.pushEnabled,
    marketingEnabled: row.marketingEnabled,
  };
}

/**
 * Upserts the user's notification preferences (partial update — only supplied
 * fields are changed).
 */
export async function updateNotificationPreferences(
  userId: string,
  input: UpdateNotificationPreferenceInput,
): Promise<NotificationPreferenceDto> {
  const existing = await prisma.notificationPreference.findUnique({ where: { userId } });
  const base = existing ?? DEFAULT_PREFS;

  const updated = await prisma.notificationPreference.upsert({
    where: { userId },
    create: {
      userId,
      emailEnabled:    input.emailEnabled    ?? base.emailEnabled,
      smsEnabled:      input.smsEnabled      ?? base.smsEnabled,
      pushEnabled:     input.pushEnabled     ?? base.pushEnabled,
      marketingEnabled: input.marketingEnabled ?? base.marketingEnabled,
    },
    update: {
      ...(input.emailEnabled    !== undefined ? { emailEnabled:    input.emailEnabled }    : {}),
      ...(input.smsEnabled      !== undefined ? { smsEnabled:      input.smsEnabled }      : {}),
      ...(input.pushEnabled     !== undefined ? { pushEnabled:     input.pushEnabled }     : {}),
      ...(input.marketingEnabled !== undefined ? { marketingEnabled: input.marketingEnabled } : {}),
    },
  });

  log.info('Notification preferences updated', { userId });

  return {
    emailEnabled: updated.emailEnabled,
    smsEnabled: updated.smsEnabled,
    pushEnabled: updated.pushEnabled,
    marketingEnabled: updated.marketingEnabled,
  };
}
