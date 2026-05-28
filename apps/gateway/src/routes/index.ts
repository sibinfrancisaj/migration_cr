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

export function registerRoutes(app: Router): void {
  app.use('/api/v1', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/profile', profileRouter);
  app.use('/api/v1/profiles', profilesRouter);
  app.use('/api/v1/discover', discoverRouter);
  app.use('/api/v1/connections', connectionsRouter);
  app.use('/api/v1/conversations', conversationsRouter);
  app.use('/api/v1/messages', messagesRouter);
  app.use('/api/v1/payment', paymentRouter);
  app.use('/admin', adminRouter);
}
