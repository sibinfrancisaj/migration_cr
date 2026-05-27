import { Router } from 'express';
import { healthRouter } from './health.route.js';

export function registerRoutes(app: Router): void {
  app.use('/api/v1', healthRouter);
}
