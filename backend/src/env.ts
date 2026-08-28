// Central environment access. Importing this module loads .env as a side effect,
// so every other module sees credentials no matter what order it is imported in
// — the ordering hazard the old server.js worked around with a dynamic import.
import 'dotenv/config';

const missing: string[] = [];

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    missing.push(name);
    return '';
  }
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback;
}

function list(name: string): string[] {
  return optional(name)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export const env = {
  port: Number(optional('PORT', '5000')),
  nodeEnv: optional('NODE_ENV', 'development'),

  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),

  /** Allowlisted browser origins. Vercel preview URLs are added here, not in code. */
  corsOrigins: list('CORS_ORIGINS'),

  /** How long a member stays signed in before having to log in again. */
  sessionTtl: optional('SESSION_TTL', '7d'),

  /**
   * Lifetime of a check-in QR token. Short on purpose: a screenshot of the
   * projected code must stop working long before the event ends.
   */
  checkinTokenTtlSeconds: Number(optional('CHECKIN_TOKEN_TTL_SECONDS', '60')),

  // Calendar sync. Not required to boot — the API runs fine without it, and the
  // sync itself reports a clear error if it is asked to run unconfigured.
  googleCalendarId: optional('GOOGLE_CALENDAR_ID'),
  calendarSyncIntervalMinutes: Number(optional('CALENDAR_SYNC_INTERVAL_MINUTES', '15')),
  disableSyncLoop: optional('DISABLE_SYNC_LOOP') === '1',
  syncSecret: optional('SYNC_SECRET'),
};

if (missing.length > 0) {
  throw new Error(
    `Missing required environment variable(s): ${missing.join(', ')}.\n` +
      'Copy example.env to .env and fill them in. DATABASE_URL comes from the Neon\n' +
      'integration in the Vercel dashboard; JWT_SECRET is any long random string.',
  );
}

export const isProduction = env.nodeEnv === 'production';
