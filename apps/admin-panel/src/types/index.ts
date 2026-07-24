export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'SUPERADMIN' | 'MODERATOR';
}

export interface AuthState {
  token: string;
  admin: AdminUser;
}

// ── Analytics ────────────────────────────────────────────────────────────────

export interface KpiDto {
  period: { from: string; to: string };
  users: { newRegistrations: number; totalActive: number; suspended: number };
  profiles: { avgCompletionScore: number; totalComplete: number; voiceIntroCount: number };
  connections: { requestsSent: number; accepted: number; acceptanceRate: string };
  membership: { totalActive: number; newInPeriod: number; conversionRate: string };
  diamonds: { totalSpentPaise: number; totalCreditedPaise: number };
  matching: { avgTotalScore: number };
}

export interface CohortBucket {
  cohortDate: string;
  registered: number;
  d1Retained: number;
  d7Retained: number;
  d30Retained: number;
}

export interface GroupAnalyticsDto {
  totalGroups: number;
  byType: Record<string, number>;
  totalPosts: number;
  totalMembers: number;
  activeGroupsLast7Days: number;
}

export interface DropAnalyticsDto {
  totalDrops: number;
  byStatus: Record<string, number>;
  totalPairings: number;
  earlyAccessRate: string;
  unlockRate: string;
}

export interface AiAnalyticsDto {
  totalEmbeddings: number;
  staleCount: number;
  pendingCount: number;
  coverageRate: string;
  lastComputedAt: string | null;
}

export interface DiamondAnalyticsDto {
  totalIssued: number;
  totalSpent: number;
  netBalance: number;
  topSpendReasons: Array<{ reason: string; total: number }>;
}

// ── Users ────────────────────────────────────────────────────────────────────

export interface UserListItem {
  id: string;
  phone: string;
  role: string;
  createdAt: string;
  profile?: {
    fullName: string;
    completionScore: number;
    currentCountry: string;
    gender: string;
  };
  isSeeded: boolean;
  _count?: { matchesAsA: number; matchesAsB: number };
}

export interface UserListResponse {
  users: UserListItem[];
  total: number;
  page: number;
  limit: number;
}

// ── Verification ─────────────────────────────────────────────────────────────

export interface VerificationRequest {
  id: string;
  userId: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
  documentType: string;
  documentUrl: string;
  selfieUrl: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  user?: { phone: string; profile?: { fullName: string } };
}

// ── Flags / Moderation ────────────────────────────────────────────────────────

export interface FlagItem {
  id: string;
  messageId: string;
  reporterId: string;
  reason: string;
  status: 'PENDING' | 'RESOLVED';
  actionTaken: string | null;
  createdAt: string;
  reporter?: { phone: string };
  message?: { content: string; senderId: string };
}

// ── Match Intelligence ────────────────────────────────────────────────────────

export interface ScoreBucket { range: string; count: number }

export interface MatchHealthDto {
  totalPairsComputed: number;
  avgScore: number;
  medianScore: number;
  usersWithZeroMatches: number;
  usersWithLowTopScore: number;
  scoreDistribution: ScoreBucket[];
  algorithmVersions: Array<{ version: number; count: number }>;
  lastComputedAt: string | null;
  stalePairsCount: number;
}

export interface UserMatchDto {
  matchedUserId: string;
  matchedUserName: string | null;
  matchedUserPhone: string;
  totalScore: number;
  breakdown: Record<string, number>;
  algorithmV: number;
  computedAt: string;
}

export interface UserMatchesResponse {
  user: { id: string; name: string | null; phone: string };
  matches: UserMatchDto[];
}

export interface ActivityPoint {
  date: string;
  profileViews: number;
  connectionsSent: number;
  messagesSet: number;
  habitsLogged: number;
  promptResponses: number;
}

export interface UserActivityDto {
  userId: string;
  daily: ActivityPoint[];
  weeklySummary: { profileViews: number; connectionsSent: number; messagesSent: number; habitsLogged: number };
  monthlySummary: { profileViews: number; connectionsSent: number; messagesSent: number; habitsLogged: number };
  streakDays: number;
  lastActiveAt: string | null;
}

// ── Seeder ───────────────────────────────────────────────────────────────────

export interface SeederStatus {
  isRunning: boolean;
  dripPaused: boolean;
  lastRunAt: string | null;
  lastDripAt: string | null;
  totalProfilesCreated: number;
  seededUserCount: number;
  seededProfileCount: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  requestId?: string;
  message?: string;
}
