import { Router } from 'express';
import { healthRouter } from './health.route.js';
import { authRouter } from './auth/index.js';
import { adminRouter } from './admin/index.js';
import { profileRouter } from './profile/index.js';
import { profilesRouter } from './profiles/index.js';
import { discoverRouter } from './discover/index.js';
import { connectionsRouter } from './connections/index.js';
import { conversationsRouter } from './conversations/index.js';
import { messagesRouter } from './messages/index.js';
import { paymentRouter } from './payment/index.js';
import { groupsRouter } from './groups/index.js';
import { verificationRouter } from './verification/index.js';
import { introductionsRouter } from './introductions/index.js';
import { eventsRouter } from './events/index.js';
import { promptsRouter } from './prompts/index.js';
import { savedRouter } from './saved/index.js';
import { signalsRouter } from './signals/index.js';
import { trustRouter } from './trust/index.js';
import { habitsRouter } from './habits/index.js';
import { matchesRouter } from './matches/index.js';

export function registerRoutes(app: Router): void {
  // ── Infrastructure ────────────────────────────────────────────────────────────
  app.use('/api/v1', healthRouter);

  // ── Auth ──────────────────────────────────────────────────────────────────────
  app.use('/api/v1/auth', authRouter);

  // ── Profile ───────────────────────────────────────────────────────────────────
  app.use('/api/v1/profile', profileRouter);
  app.use('/api/v1/profiles', profilesRouter);

  // ── Discovery & Matching ──────────────────────────────────────────────────────
  app.use('/api/v1/discover', discoverRouter);
  app.use('/api/v1/matches', matchesRouter);

  // ── Connections ───────────────────────────────────────────────────────────────
  app.use('/api/v1/connections', connectionsRouter);

  // ── Groups & Introductions ────────────────────────────────────────────────────
  app.use('/api/v1/groups', groupsRouter);
  app.use('/api/v1/introductions', introductionsRouter);

  // ── Messaging ─────────────────────────────────────────────────────────────────
  app.use('/api/v1/conversations', conversationsRouter);
  app.use('/api/v1/messages', messagesRouter);

  // ── Events / Gatherings ───────────────────────────────────────────────────────
  app.use('/api/v1/events', eventsRouter);

  // ── Weekly Prompts ────────────────────────────────────────────────────────────
  app.use('/api/v1/prompts', promptsRouter);

  // ── Saved Profiles ────────────────────────────────────────────────────────────
  app.use('/api/v1/saved', savedRouter);

  // ── Habits ────────────────────────────────────────────────────────────────────
  app.use('/api/v1/habits', habitsRouter);

  // ── Engagement & Signals ──────────────────────────────────────────────────────
  app.use('/api/v1/signals', signalsRouter);

  // ── Trust & Safety ────────────────────────────────────────────────────────────
  app.use('/api/v1/trust', trustRouter);

  // ── Verification ──────────────────────────────────────────────────────────────
  app.use('/api/v1/verification', verificationRouter);

  // ── Payments ──────────────────────────────────────────────────────────────────
  app.use('/api/v1/payment', paymentRouter);

  // ── Admin ─────────────────────────────────────────────────────────────────────
  app.use('/admin', adminRouter);
}
