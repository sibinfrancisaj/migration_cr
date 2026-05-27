import { Router } from 'express';
import { healthRouter } from './health.route.js';
import { authRouter } from './auth/index.js';
import { adminRouter } from './admin/index.js';
import { profileRouter } from './profile/index.js';

export function registerRoutes(app: Router): void {
  app.use('/api/v1', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/profile', profileRouter);
  app.use('/admin', adminRouter);
}
