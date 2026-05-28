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
}

export interface SmsPayload {
  /** Recipient phone number in E.164 format (e.g. +919876543210). */
  to: string;
  body: string;
}

export interface PushPayload {
  /** FCM registration token for the target device. */
  deviceToken: string;
  title: string;
  body: string;
  /** Arbitrary key-value pairs surfaced to the app via `data` field. */
  data?: Record<string, string>;
}

// ── Discriminated union used as the BullMQ job payload ───────────────────────

export type NotificationJobData =
  | { type: NotificationType.EMAIL; payload: EmailPayload }
  | { type: NotificationType.SMS;   payload: SmsPayload }
  | { type: NotificationType.PUSH;  payload: PushPayload };
