// Applies any pending migrations from drizzle/, then exits. Run as a one-off:
//   npm run db:migrate
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index';

try {
  await migrate(db, { migrationsFolder: 'drizzle' });
  console.log('Migrations applied.');
} catch (err) {
  console.error('Migration failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
