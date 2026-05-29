import {
  AdminRole,
  ConnectionStatus,
  DiamondReason,
  EventStatus,
  FlagStatus,
  Gender,
  GroupStatus,
  MediaType,
  MembershipPlan,
  MembershipStatus,
  MessageType,
  NotificationChannel,
  NotificationStatus,
  PaymentProvider,
  PaymentStatus,
  RealLifeQuestionKey,
  StoryPromptKey,
  UserRole,
  VerificationStatus,
} from '../enums/index.js';

// ─── Common ─────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: PaginationMeta;
  requestId?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

export interface PaginationMeta {
  cursor?: string;
  hasMore?: boolean;
  total?: number;
  page?: number;
  limit?: number;
  message?: string;
}

export interface JwtPayload {
  sub: string;
  role: UserRole;
  deviceId: string;
  iat?: number;
  exp?: number;
}

export interface AdminJwtPayload {
  sub: string;
  role: AdminRole;
  email: string;
  iat?: number;
  exp?: number;
}

// ─── User & Auth ─────────────────────────────────────────────────────────────

export interface UserDto {
  id: string;
  phone: string;
  email?: string;
  role: UserRole;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  createdAt: Date;
}

export interface DeviceDto {
  id: string;
  userId: string;
  fingerprint: string;
  name?: string;
  platform?: string;
  lastSeenAt: Date;
  isTrusted: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export interface ProfileDto {
  id: string;
  userId: string;
  name: string;
  dateOfBirth: Date;
  gender: Gender;
  currentCity: string;
  currentCountry: string;
  settlementIntent: string;
  bio?: string;
  completionScore: number;
  verificationStatus: VerificationStatus;
  isVerified: boolean;
  photos: MediaDto[];
  realLifeAnswers: RealLifeAnswerDto[];
  storyPrompts: StoryPromptAnswerDto[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RealLifeAnswerDto {
  questionKey: RealLifeQuestionKey;
  value: string | string[];
  updatedAt: Date;
}

export interface StoryPromptAnswerDto {
  promptKey: StoryPromptKey;
  answer: string;
  updatedAt: Date;
}

export interface MediaDto {
  id: string;
  type: MediaType;
  url: string;
  order?: number;
  isVerified: boolean;
  createdAt: Date;
}

// ─── Groups ──────────────────────────────────────────────────────────────────

export interface GroupDto {
  id: string;
  name: string;
  region: string;
  status: GroupStatus;
  launchDate: Date;
  introDayOfWeek: number;
  capacity: number;
  memberCount: number;
  createdAt: Date;
}

export interface GroupMemberDto {
  userId: string;
  groupId: string;
  joinedAt: Date;
  status: string;
}

// ─── Matching ────────────────────────────────────────────────────────────────

export interface DiscoveryItemDto {
  userId: string;
  name: string;
  age: number;
  currentCity: string;
  currentCountry: string;
  settlementIntent: string;
  completionScore: number;
  verificationStatus: VerificationStatus;
  photoUrl?: string;
  totalScore: number;
  scoreBreakdown: ScoreBreakdown;
}

export interface DiscoveryFeedDto {
  items: DiscoveryItemDto[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface MatchScoreDto {
  userAId: string;
  userBId: string;
  totalScore: number;
  breakdown: ScoreBreakdown;
  computedAt: Date;
}

export interface ScoreBreakdown {
  verification: number;
  settlementIntent: number;
  realLifeAnswers: number;
  profileCompleteness: number;
  checkInRecency: number;
  ageCompatibility: number;
  groupMembership: number;
  languageMatch: number;
  faithAlignment: number;
}

export interface ConnectionDto {
  id: string;
  senderId: string;
  receiverId: string;
  status: ConnectionStatus;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MatchDto {
  id: string;
  userAId: string;
  userBId: string;
  matchedAt: Date;
  conversationId?: string;
}

// ─── Messaging ───────────────────────────────────────────────────────────────

export interface ConversationDto {
  id: string;
  matchId: string;
  participants: string[];
  lastMessageAt?: Date;
  isArchived: boolean;
  createdAt: Date;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  content: string;
  readAt?: Date;
  createdAt: Date;
}

// ─── Check-ins ───────────────────────────────────────────────────────────────

export interface CheckInDto {
  id: string;
  userId: string;
  weekKey: string;
  answers: Record<string, unknown>;
  submittedAt: Date;
}

// ─── Events ──────────────────────────────────────────────────────────────────

export interface EventDto {
  id: string;
  groupId: string;
  title: string;
  description?: string;
  status: EventStatus;
  startAt: Date;
  endAt?: Date;
  location?: string;
  capacity?: number;
  rsvpCount: number;
  createdAt: Date;
}

// ─── Payments ────────────────────────────────────────────────────────────────

export interface MembershipDto {
  id: string;
  userId: string;
  plan: MembershipPlan;
  provider: PaymentProvider;
  status: MembershipStatus;
  expiresAt?: Date;
  createdAt: Date;
}

export interface DiamondLedgerEntryDto {
  id: string;
  userId: string;
  delta: number;
  reason: DiamondReason;
  balanceAfter: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export interface AdminUserDto {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  isTotpEnabled: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
}

export interface AuditLogDto {
  id: string;
  adminUserId: string;
  action: string;
  entity: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress: string;
  createdAt: Date;
}

export interface FlagDto {
  id: string;
  reporterId: string;
  targetUserId: string;
  targetEntityType: string;
  targetEntityId?: string;
  reason: string;
  description?: string;
  status: FlagStatus;
  moderatorId?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface NotificationDto {
  id: string;
  userId: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  status: NotificationStatus;
  metadata?: Record<string, unknown>;
  sentAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
}

// ─── Feature Flags ───────────────────────────────────────────────────────────

export interface FeatureFlagDto {
  id: string;
  key: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  allowedUserIds: string[];
  allowedEnvironments: string[];
  metadata?: Record<string, unknown>;
  updatedAt: Date;
}

// ─── Verification ────────────────────────────────────────────────────────────

export interface VerificationRequestDto {
  id: string;
  userId: string;
  idDocType: string;
  status: VerificationStatus;
  reviewerId?: string;
  reviewNote?: string;
  submittedAt: Date;
  reviewedAt?: Date;
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export interface PaymentIntentDto {
  id: string;
  userId: string;
  provider: PaymentProvider;
  providerPaymentId: string;
  amountPaise: number;
  currency: string;
  status: PaymentStatus;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
