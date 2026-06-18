export const EVENT_ERRORS = {
  NOT_FOUND: 'Event not found',
  ALREADY_RSVPD: "Already RSVP'd to this event",
  RSVP_NOT_FOUND: 'RSVP not found',
  EVENT_FULL: 'Event is at full capacity',
  NOT_UPCOMING: 'Event is not open for RSVP',
} as const;

export const EVENT_MESSAGES = {
  RSVP_CONFIRMED:       'RSVP confirmed',
  RSVP_CANCELLED:       'RSVP cancelled',
  CALENDAR_RETRIEVED:   'Calendar milestones retrieved',
  ATTENDANCE_PROCESSED: 'Post-event attendance boost enqueued',
} as const;
