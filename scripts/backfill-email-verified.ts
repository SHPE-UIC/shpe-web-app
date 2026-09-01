/**
 * One-off: marks every existing Firebase account as email-verified.
 *
 * The verification gate reads the `email_verified` claim on the ID token, and
 * accounts created before the gate existed all carry false — the Admin SDK's
 * createUser() does not set it. Deploying the gate without running this first
 * locks out every member who already had an account, including the Top 8 that
 * is the only role able to fix anyone else's.
 *
 * Run it against the tenant the gate is about to protect, before the deploy:
 *
 *   npm run backfill:verified                              # dry run
 *   npx tsx scripts/backfill-email-verified.ts --apply     # actually writes
 *
 * The apply step calls tsx directly because PowerShell swallows the `--`
 * separator, so `npm run backfill:verified -- --apply` silently runs another
 * dry run instead of failing.
 *
 * Credentials come from Application Default Credentials, the same as the API:
 * `gcloud auth application-default login` plus GOOGLE_CLOUD_PROJECT, or
 * FIREBASE_AUTH_EMULATOR_HOST and GCLOUD_PROJECT to rehearse it locally.
 */
import { listFirebaseUsers, markEmailVerified } from '../backend/src/auth/firebase';

const apply = process.argv.includes('--apply');

async function main() {
  const users = await listFirebaseUsers();
  const unverified = users.filter((user) => !user.emailVerified);

  console.log(`${users.length} account(s) in the tenant, ${unverified.length} unverified.`);

  if (unverified.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  for (const user of unverified) {
    console.log(`  ${apply ? 'marking' : 'would mark'} ${user.email ?? '(no email)'} (${user.uid})`);
  }

  if (!apply) {
    console.log('\nDry run. Re-run with --apply to write these changes.');
    return;
  }

  // Sequential on purpose. This runs against a handful of accounts once, and a
  // partial failure should say exactly which address it stopped at.
  let done = 0;
  for (const user of unverified) {
    await markEmailVerified(user.uid);
    done += 1;
  }

  console.log(`\nMarked ${done} account(s) verified.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
