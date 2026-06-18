import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import { getEnv } from '@abroad-matrimony/config';
import { createChildLogger } from '@abroad-matrimony/logger';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { notFoundMiddleware } from './middleware/not-found.middleware.js';
import { seederAuthMiddleware } from './middleware/seeder-auth.middleware.js';
import { registerRoutes } from './routes/index.js';

const log = createChildLogger({ module: 'gateway:app' });

export function createApp(): express.Application {
  const env = getEnv();
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Middleware order is fixed — do not reorder (see enterprise-patterns.md §14)
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      exposedHeaders: ['X-Request-ID'],
    }),
  );
  app.use(compression());

  // ── Webhook raw-body parsers (MUST come before express.json) ────────────────
  // Stripe and Razorpay require the raw Buffer for HMAC signature verification.
  // express.body-parser skips paths where req.body is already set.
  app.use('/api/v1/payment/stripe/webhook', express.raw({ type: 'application/json' }));
  app.use('/api/v1/payment/razorpay/webhook', express.raw({ type: 'application/json' }));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ── Seeder auth bypass (SEED-004 / ADR-014) ──────────────────────────────────
  // Must run BEFORE requireAuth so seeder tokens set req.user directly.
  // In production: strict no-op even if SEEDER_SECRET is somehow set.
  app.use(seederAuthMiddleware);

  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX_REQUESTS,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
    }),
  );

  app.use((req, _res, next) => {
    log.debug('Incoming request', { method: req.method, path: req.path, requestId: req.requestId });
    next();
  });

  registerRoutes(app);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
