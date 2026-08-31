import { createApp } from './app';
import { startCalendarSyncLoop } from './calendar/sync';
import { env } from './env';

const app = createApp();

app.listen(env.port, () => {
  console.log(`API listening on port ${env.port} (${env.nodeEnv})`);

  if (env.corsOrigins.length === 0) {
    console.warn('CORS_ORIGINS is empty — every origin is allowed. Set it in production.');
  }

  // Local development only. Production sets DISABLE_SYNC_LOOP=1 and lets
  // Cloud Scheduler call /api/sync/calendar instead, because Cloud Run
  // throttles the CPU outside a request and an in-process timer would fire
  // unpredictably — if the instance still exists at all.
  if (!env.disableSyncLoop) startCalendarSyncLoop();
});
