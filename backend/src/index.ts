import { createApp } from './app';
import { env } from './env';

const app = createApp();

app.listen(env.port, () => {
  console.log(`API listening on port ${env.port} (${env.nodeEnv})`);

  if (env.corsOrigins.length === 0) {
    console.warn('CORS_ORIGINS is empty — every origin is allowed. Set it in production.');
  }
});
