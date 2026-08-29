import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../env';
import * as schema from './schema';
import { sslConfigFor } from './ssl';

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  ssl: sslConfigFor(env.databaseUrl),

  // db-f1-micro caps concurrent connections low; with Cloud Run limited to a
  // couple of instances, a small per-instance pool keeps headroom for the
  // migration job and manual sessions.
  max: 5,
  idleTimeoutMillis: 30_000,
});

export const db = drizzle(pool, { schema });

export * from './schema';
