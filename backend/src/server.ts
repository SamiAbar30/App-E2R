import mongoose from 'mongoose';
import { createApp } from './app';
import { env } from './config/env';
import { getAdditiveCount } from './parsers/additiveMap';

/**
 * Server bootstrap and lifecycle management.
 * Connects to MongoDB, loads static data, starts HTTP listener.
 * Implements graceful shutdown on SIGTERM/SIGINT.
 * @trace NFR-REL-001 — Graceful degradation and shutdown
 */
async function bootstrap(): Promise<void> {
  const app = createApp();

  // ── 1. Connect to MongoDB ────────────────────────────────────────
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log(`[DB] MongoDB connected: ${env.MONGODB_URI.replace(/\/\/.*@/, '//***@')}`);
  } catch (error) {
    console.error('[DB] MongoDB connection failed:', (error as Error).message);
    console.warn('[DB] Server will continue — DB-dependent features will fail.');
  }

  // ── 2. Verify Static Data Loaded ─────────────────────────────────
  const additiveCount = getAdditiveCount();
  console.log(`[DATA] EU Additive Map loaded: ${additiveCount} entries`);

  // ── 3. Start HTTP Server ─────────────────────────────────────────
  const server = app.listen(env.PORT, () => {
    console.log(`[SERVER] Running on port ${env.PORT} (${env.NODE_ENV})`);
    console.log(`[SERVER] OCR provider: ${env.OCR_PROVIDER}`);
    console.log(`[SERVER] FACILE host: ${env.FACILE_HOST}`);
    console.log(`[SERVER] Health: http://localhost:${env.PORT}/health`);
    console.log(`[SERVER] Analyze: POST http://localhost:${env.PORT}/api/v1/ingredients/analyze`);
  });

  // ── 4. Graceful Shutdown ─────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n[SHUTDOWN] Received ${signal}. Closing gracefully...`);

    server.close(() => {
      console.log('[SHUTDOWN] HTTP server closed.');
    });

    try {
      await mongoose.connection.close();
      console.log('[SHUTDOWN] MongoDB connection closed.');
    } catch (err) {
      console.error('[SHUTDOWN] Error closing MongoDB:', (err as Error).message);
    }

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[FATAL] Server failed to start:', err);
  process.exit(1);
});
