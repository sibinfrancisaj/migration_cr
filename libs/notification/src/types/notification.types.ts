/**
 * Canonical notification types processed by the notification worker.
 */
export enum NotificationType {
  EMAIL = 'EMAIL',
  SMS   = 'SMS',
  PUSH  = 'PUSH',
}

// ── Channel-specific payloads ─────────────────────────────────────────────────

export interface EmailPayload {
  /** Recipient email address. */
  to: string;
  /** Optional display name for the recipient. */
  toName?: string;
  subject: string;
  /** Full HTML body. */
  htmlBody: string;
  /** Plain-text fallback (generated from htmlBody by Brevo when omitted). */
  textBody?: string;
  /**
   * Recipient user ID — used for unsubscribe token generation and opt-out check.
   * Optional: if absent, unsubscribe headers are omitted.
   */
  userId?: string;
}

export interface SmsPayload {
  /** Recipient phone number in E.164 format (e.g. +919876543210). */
  to: string;
  body: string;
  /** Recipient user ID — used for per-user channel opt-out check (PROD-005). */
  userId?: string;
}

export interface PushPayload {
  /** FCM registration token for the target device. */
  deviceToken: string;
  title: string;
  body: string;
  /** Arbitrary key-value pairs surfaced to the app via `data` field. */
  data?: Record<string, string>;
  /**
   * User ID of the recipient — used for quiet window checking (AI-006).
   * Optional: if absent, quiet window check is skipped and notification is delivered immediately.
   */
  userId?: string;
}

// ── Discriminated union used as the BullMQ job payload ───────────────────────

export type NotificationJobData =
  | { type: NotificationType.EMAIL; payload: EmailPayload }
  | { type: NotificationType.SMS;   payload: SmsPayload }
  | { type: NotificationType.PUSH;  payload: PushPayload };
