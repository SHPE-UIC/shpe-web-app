import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../env';
import * as schema from './schema';

const isLocal = /@(localhost|127\.0\.0\.1)/.test(env.databaseUrl);

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,

  // Neon terminates TLS with a publicly trusted certificate, so full
  // verification works. A self-hosted Postgres over a self-signed cert would
  // need { rejectUnauthorized: false } here instead.
  ssl: isLocal ? undefined : { rejectUnauthorized: true },

  // Render's free instance is small and Neon's free plan caps connections;
  // a large pool buys nothing and risks exhausting the server side.
  max: 5,
  idleTimeoutMillis: 30_000,
});

export const db = drizzle(pool, { schema });

export * from './schema';
