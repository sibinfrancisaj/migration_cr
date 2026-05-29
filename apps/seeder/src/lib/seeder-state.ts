/**
 * In-memory seeder state — tracks running status, timestamps, counts.
 * Persisted partially to Redis for status API reads across restarts.
 */
import { seederLog } from './seeder-logger.js';

export interface SeederState {
  running: boolean;
  dripPaused: boolean;
  lastRunAt: Date | null;
  lastDripAt: Date | null;
  lastMatchRecomputeAt: Date | null;
  totalProfilesCreated: number;
  currentJobId: string | null;
}

const state: SeederState = {
  running: false,
  dripPaused: false,
  lastRunAt: null,
  lastDripAt: null,
  lastMatchRecomputeAt: null,
  totalProfilesCreated: 0,
  currentJobId: null,
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

export function setDripCompleted(profilesCreated: number): void {
  state.lastDripAt = new Date();
  state.totalProfilesCreated += profilesCreated;
  state.running = false;
  state.currentJobId = null;
}

export function setMatchRecomputeAt(): void {
  state.lastMatchRecomputeAt = new Date();
}

export function pauseDrip(): void {
  state.dripPaused = true;
  seederLog.info('Drip scheduler paused');
}

export function resumeDrip(): void {
  state.dripPaused = false;
  seederLog.info('Drip scheduler resumed');
}
