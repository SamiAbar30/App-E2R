import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth.middleware';
import { imageSizeMiddleware } from './middleware/imageSizeMiddleware';
import { analyzeHandler } from './controllers/analyze.controller';
import { env } from './config/env';

/**
 * Express application factory.
 * Assembles the middleware chain and route bindings.
 * @trace NFR-SEC-001 — Security middleware ordering
 * @trace NFR-PERF-001 — Minimal middleware overhead
 */
export function createApp(): express.Application {
  const app = express();

  // ── 1. Security Headers ──────────────────────────────────────────
  app.use(helmet());

  // ── 2. CORS ──────────────────────────────────────────────────────
  app.use(cors({
    origin: env.NODE_ENV === 'production' ? false : '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // ── 3. Body Parser (with ceiling) ────────────────────────────────
  app.use(express.json({ limit: '5mb' }));

  // ── 4. Health Check (no auth required) ───────────────────────────
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'success' as const,
      data: {
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
      },
      code: 'HEALTHY',
    });
  });

  // ── 5. Protected Routes ──────────────────────────────────────────
  app.post(
    '/api/v1/ingredients/analyze',
    authMiddleware,
    imageSizeMiddleware,
    analyzeHandler
  );

  // ── 6. 404 Handler ───────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      status: 'error' as const,
      data: null,
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    });
  });

  // ── 7. Global Error Handler (must be last) ───────────────────────
  app.use(errorHandler);

  return app;
}
