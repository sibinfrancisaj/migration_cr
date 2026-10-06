import type { VerificationStatus } from '../enums/index.js';

/**
 * CloudEvent `data` payloads, keyed by event type (EVT-001).
 *
 * Publishers and handlers both import these so a payload change is a compile
 * error on both sides. Never put PII (full phone, email) in an event payload —
 * handlers look contact details up by userId at delivery time.
 */

export interface ConnectionSentEventData {
  connectionId: string;
  senderId:     string;
  receiverId:   string;
}

export interface ConnectionAcceptedEventData {
  connectionId: string;
  /** Original requester — the user who gets told their request was accepted. */
  senderId:     string;
  receiverId:   string;
  matchId:      string;
}

export interface MatchCreatedEventData {
  matchId:      string;
  userAId:      string;
  userBId:      string;
  connectionId: string;
}

export interface VerificationSubmittedEventData {
  verificationId: string;
  userId:         string;
}

export interface VerificationReviewedEventData {
  verificationId: string;
  userId:         string;
  status:         VerificationStatus.APPROVED | VerificationStatus.REJECTED;
  reason?:        string;
}

export interface ProfileUpdatedEventData {
  userId:          string;
  completionScore: number;
}

export interface ProfileCompletedEventData {
  userId: string;
}

export interface MembershipActivatedEventData {
  userId: string;
  plan:   string;
}
