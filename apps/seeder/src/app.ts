/**
 * Seeder Express application setup.
 * Minimal — control API only. No rate limiting or auth middleware
 * beyond the X-Seeder-Key header checked per-route.
 */
import express from 'express';
import { seedRouter } from './routes/seed.routes.js';

export function createSeederApp(): express.Application {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  // Health check — no auth required
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'seeder' });
  });

  // Control API
  app.use('/seed', seedRouter);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Not found' });
  });

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ success: false, error: err.message ?? 'Internal seeder error' });
  });

  return app;
}
