/**
 * In-memory seeder state — tracks running status, timestamps, counts.
 * Persisted partially to Redis for status API reads across restarts.
 */
import { seederLog } from './seeder-logger.js';

export interface SocialLoopSnapshot {
  ranAt: string;
  usersActive: number;
  totalProactive: number;
  connectionsHandled: number;
  introsHandled: number;
  postsLiked: number;
  commentsAdded: number;
  responsesResonated: number;
  durationMs: number;
}

export interface DripSnapshot {
  ranAt: string;
  profilesCreated: number;
  durationMs: number;
}

export interface SeederState {
  running: boolean;
  activityRunning: boolean;
  dripPaused: boolean;
  activityPaused: boolean;
  lastRunAt: Date | null;
  lastDripAt: Date | null;
  lastMatchRecomputeAt: Date | null;
  lastActivityAt: Date | null;
  totalProfilesCreated: number;
  currentJobId: string | null;
  lastSocialLoop: SocialLoopSnapshot | null;
  lastDrip: DripSnapshot | null;
  /** Rolling history — last 20 social loop runs */
  socialLoopHistory: SocialLoopSnapshot[];
  dripHistory: DripSnapshot[];
}

const state: SeederState = {
  running: false,
  activityRunning: false,
  dripPaused: false,
  activityPaused: false,
  lastRunAt: null,
  lastDripAt: null,
  lastMatchRecomputeAt: null,
  lastActivityAt: null,
  totalProfilesCreated: 0,
  currentJobId: null,
  lastSocialLoop: null,
  lastDrip: null,
  socialLoopHistory: [],
  dripHistory: [],
};

export function getState(): Readonly<SeederState> {
  return state;
}

export function setRunning(running: boolean, jobId?: string): void {
  state.running = running;
  state.currentJobId = jobId ?? null;
  if (running) state.lastRunAt = new Date();
  seederLog.debug('Seeder state updated', { running, jobId });
}

export function setDripCompleted(profilesCreated: number, durationMs = 0): void {
  const snap: DripSnapshot = {
    ranAt: new Date().toISOString(),
    profilesCreated,
    durationMs,
  };
  state.lastDripAt = new Date();
  state.lastDrip = snap;
  state.totalProfilesCreated += profilesCreated;
  state.running = false;
  state.currentJobId = null;
  state.dripHistory = [snap, ...state.dripHistory].slice(0, 20);
}

export function setMatchRecomputeAt(): void {
  state.lastMatchRecomputeAt = new Date();
}

export function setActivityRunning(running: boolean): void {
  state.activityRunning = running;
  if (running) state.lastActivityAt = new Date();
}

export function setSocialLoopCompleted(result: Omit<SocialLoopSnapshot, 'ranAt'>): void {
  const snap: SocialLoopSnapshot = { ranAt: new Date().toISOString(), ...result };
  state.lastSocialLoop = snap;
  state.lastActivityAt = new Date();
  state.activityRunning = false;
  state.socialLoopHistory = [snap, ...state.socialLoopHistory].slice(0, 20);
  seederLog.info('Social loop result saved to state', snap);
}

export function pauseDrip(): void {
  state.dripPaused = true;
  seederLog.info('Drip scheduler paused');
}

export function resumeDrip(): void {
  state.dripPaused = false;
  seederLog.info('Drip scheduler resumed');
}

export function pauseActivity(): void {
  state.activityPaused = true;
  seederLog.info('Activity scheduler paused');
}

export function resumeActivity(): void {
  state.activityPaused = false;
  seederLog.info('Activity scheduler resumed');
}
