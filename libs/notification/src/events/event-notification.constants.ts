/**
 * Copy and deep-link keys for notifications triggered by domain CloudEvents (EVT-003).
 * The `type` value is sent in the push `data` so the app can route the tap.
 */
export const EVENT_PUSH_TYPES = {
  CONNECTION_REQUEST:    'CONNECTION_REQUEST',
  CONNECTION_ACCEPTED:   'CONNECTION_ACCEPTED',
  VERIFICATION_APPROVED: 'VERIFICATION_APPROVED',
  VERIFICATION_REJECTED: 'VERIFICATION_REJECTED',
  MEMBERSHIP_ACTIVATED:  'MEMBERSHIP_ACTIVATED',
} as const;

export const EVENT_PUSH_COPY = {
  FALLBACK_NAME: 'Someone',
  CONNECTION_REQUEST: {
    title: 'New connection request',
    body:  (name: string) => `${name} would like to connect with you`,
  },
  CONNECTION_ACCEPTED: {
    title: "It's a match",
    body:  (name: string) => `${name} accepted your connection request. Say hello!`,
  },
  VERIFICATION_APPROVED: {
    title: 'You are verified',
    body:  'Your identity has been verified. Your profile now shows the verified badge.',
  },
  VERIFICATION_REJECTED: {
    title: 'Verification needs another try',
    body:  'We could not verify your documents. Open the app to see why and resubmit.',
  },
  MEMBERSHIP_ACTIVATED: {
    title: 'Welcome, Founding Member',
    body:  'Your membership is active. Full connections and your diamond credits are unlocked.',
  },
} as const;

/** Handler names — also part of each notification's dedupe jobId. */
export const EVENT_HANDLER_NAMES = {
  CONNECTION_SENT:       'notification:connection-sent',
  CONNECTION_ACCEPTED:   'notification:connection-accepted',
  VERIFICATION_REVIEWED: 'notification:verification-reviewed',
  MEMBERSHIP_ACTIVATED:  'notification:membership-activated',
} as const;
