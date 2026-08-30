/**
 * One-shot cutover step: copy every not-yet-linked member into Firebase
 * Authentication, bcrypt hash included, so existing passwords keep working.
 *
 *   DATABASE_URL=<cloud-sql-or-proxy DSN> \
 *   GOOGLE_CLOUD_PROJECT=<project-id> \
 *   npx tsx scripts/import-users-to-firebase.ts
 *
 * Credentials come from Application Default Credentials
 * (`gcloud auth application-default login`). Idempotent: rows with
 * firebase_uid set are never touched, so a partial run can simply be re-run.
 */
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type UserImportRecord } from 'firebase-admin/auth';
import pg from 'pg';
import { sslConfigFor } from '../backend/src/db/ssl';

const BATCH_SIZE = 1000; // importUsers' hard cap per call

type Row = {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
};

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Set DATABASE_URL to the target database');

  if (getApps().length === 0) initializeApp();
  const auth = getAuth();

  const pool = new pg.Pool({ connectionString: databaseUrl, ssl: sslConfigFor(databaseUrl) });

  try {
    const { rows } = await pool.query<Row>(
      'select id, email, name, password_hash from users where firebase_uid is null order by created_at',
    );
    console.log(`${rows.length} member(s) not yet linked to Firebase`);

    let imported = 0;
    let failed = 0;

    for (let start = 0; start < rows.length; start += BATCH_SIZE) {
      const batch = rows.slice(start, start + BATCH_SIZE);

      const importable = batch.filter((row) => {
        // Every unlinked row should be from the bcrypt era. One without a
        // hash cannot carry its password over — surface it, don't guess.
        if (!row.password_hash) {
          console.warn(`SKIP ${row.email}: no password hash and no firebase_uid`);
          return false;
        }
        return true;
      });
      if (importable.length === 0) continue;

      const records: UserImportRecord[] = importable.map((row) => ({
        uid: row.id,
        email: row.email,
        displayName: row.name,
        passwordHash: Buffer.from(row.password_hash!),
      }));

      const result = await auth.importUsers(records, { hash: { algorithm: 'BCRYPT' } });

      const failedIndexes = new Set(result.errors.map((e) => e.index));
      for (const err of result.errors) {
        console.error(`FAIL ${importable[err.index].email}: ${err.error.message}`);
      }

      const succeededIds = importable
        .filter((_, index) => !failedIndexes.has(index))
        .map((row) => row.id);

      if (succeededIds.length > 0) {
        await pool.query('update users set firebase_uid = id where id = any($1::uuid[])', [
          succeededIds,
        ]);
      }

      imported += result.successCount;
      failed += result.failureCount;
    }

    console.log(`Imported ${imported}, failed ${failed}`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
