import { createApp } from './app';
import { startCalendarSyncLoop } from './calendar/sync';
import { env } from './env';

const app = createApp();

app.listen(env.port, () => {
  console.log(`API listening on port ${env.port} (${env.nodeEnv})`);

  if (env.corsOrigins.length === 0) {
    console.warn('CORS_ORIGINS is empty — every origin is allowed. Set it in production.');
  }

  // The in-process timer stops whenever the host suspends an idle instance,
  // which Render's free tier does after about 15 minutes. The uptime pinger
  // that keeps the service awake is what actually keeps this running; the
  // /api/sync/calendar endpoint is the manual fallback.
  if (!env.disableSyncLoop) startCalendarSyncLoop();
});
