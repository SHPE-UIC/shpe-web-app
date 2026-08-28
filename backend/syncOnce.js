// One-shot calendar sync, for running as a scheduled job rather than a server.
// Usage: node backend/syncOnce.js [--full]

import dotenv from 'dotenv';
dotenv.config();

try {
  // Imported inside the try, and after dotenv.config(), so that a missing or
  // malformed credential surfaces as a readable message rather than an
  // unhandled module-initialization stack trace.
  const { runSyncSafely } = await import('./calendarSync.js');

  const result = await runSyncSafely({ forceFullSync: process.argv.includes('--full') });
  console.log('Calendar sync complete:', result);

  // firebase-admin keeps its gRPC connection open, which would hold the process
  // alive until the job times out. Exit explicitly.
  process.exit(0);
} catch (err) {
  console.error('Calendar sync failed:', err.message);
  process.exit(1);
}
