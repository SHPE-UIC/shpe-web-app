import { Router } from 'express';
import type { RequestHandler } from 'express';
import { runSyncSafely } from '../calendar/sync';
import { env } from '../env';
import { unauthorized } from '../middleware/errors';

/**
 * Only callers holding SYNC_SECRET may trigger a sync. Without this, an open
 * endpoint lets anyone burn through the Google API quota. Skipped when the
 * variable is unset, so local development stays frictionless.
 */
const requireSyncSecret: RequestHandler = (req, _res, next) => {
  if (!env.syncSecret) return next();
  if (req.get('x-sync-secret') !== env.syncSecret) {
    return next(unauthorized('Bad or missing sync secret', 'bad_sync_secret'));
  }
  next();
};

export const syncRoutes = Router();

// Pass ?full=1 to ignore the stored syncToken and re-import from scratch.
syncRoutes.post('/calendar', requireSyncSecret, async (req, res) => {
  const result = await runSyncSafely({ forceFullSync: req.query.full === '1' });
  res.json(result ?? { skipped: 'a sync is already running' });
});
