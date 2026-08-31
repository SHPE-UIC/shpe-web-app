import cors from 'cors';
import express from 'express';
import { env } from './env';
import { errorHandler, forbidden, notFound } from './middleware/errors';
import { pool } from './db';
import { authRoutes } from './routes/auth';
import { adminRoutes } from './routes/admin';
import { announcementRoutes } from './routes/announcements';
import { checkInRoutes } from './routes/checkIns';
import { eventRoutes } from './routes/events';
import { profileRoutes } from './routes/profile';
import { syncRoutes } from './routes/sync';

/**
 * Node wraps a failed multi-address connect in an AggregateError, whose own
 * message is always empty — reporting it raw makes an unreachable database look
 * like a bug with no detail. Unwrap to the first real cause.
 */
function describeError(err: unknown): string {
  if (err instanceof AggregateError && err.errors.length > 0) {
    return describeError(err.errors[0]);
  }
  if (err instanceof Error) return err.message || err.name;
  return 'database unreachable';
}

export function createApp() {
  const app = express();

  // Cloud Run terminates TLS in front of the process, so req.protocol and the
  // client IP come from X-Forwarded-* headers.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(express.json({ limit: '100kb' }));

  app.use(
    cors({
      origin(origin, callback) {
        // No Origin header: curl, uptime checks, native app builds. Not a
        // browser, so the same-origin policy this guards is not in play.
        if (!origin) return callback(null, true);

        // An empty allowlist means local development — accept anything rather
        // than making every contributor configure CORS to run the app.
        if (env.corsOrigins.length === 0) return callback(null, true);

        if (env.corsOrigins.includes(origin)) return callback(null, true);

        // A bare Error here would reach the error handler unclassified and be
        // reported as a 500, which reads like the API is broken rather than
        // like the origin was refused.
        return callback(forbidden(`Origin ${origin} is not allowed`, 'cors_origin'));
      },
    }),
  );

  /**
   * Shallow liveness check: no database, so it answers even when Postgres is
   * unreachable. Cloud Run's startup probe uses it.
   *
   * Note that this path is **not** reachable from outside on a run.app URL —
   * Google's frontend reserves the exact path /healthz and answers its own
   * 404 before the request arrives. Probes bypass that frontend, so the
   * startup probe still works; external monitoring has to use /healthz/db.
   */
  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, uptime: Math.round(process.uptime()), env: env.nodeEnv });
  });

  /**
   * Deep check — confirms Cloud SQL is actually reachable. This is the one the
   * uptime check watches, both because it is externally reachable and because
   * a database outage should trip the alert.
   */
  app.get('/healthz/db', async (_req, res) => {
    try {
      const result = await pool.query('select now() as now');
      res.json({ ok: true, now: result.rows[0]?.now });
    } catch (err) {
      res.status(503).json({ ok: false, error: describeError(err) });
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/check-ins', checkInRoutes);
  app.use('/api/announcements', announcementRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/sync', syncRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
