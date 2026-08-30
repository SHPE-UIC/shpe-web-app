// One-shot calendar sync, for running as a scheduled job rather than in the
// server process. Usage: npm run sync  (add --full to ignore the syncToken)
import { pool } from './db';
import { runSyncSafely } from './calendar/sync';

try {
  const result = await runSyncSafely({ forceFullSync: process.argv.includes('--full') });
  console.log('Calendar sync complete:', result);
} catch (err) {
  console.error('Calendar sync failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  // The pool would otherwise hold the process open until the job times out.
  await pool.end();
}
