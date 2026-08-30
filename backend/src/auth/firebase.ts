import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken, type UserRecord } from 'firebase-admin/auth';

/**
 * The Admin SDK, initialized lazily on Application Default Credentials: the
 * runtime service account on Cloud Run, or FIREBASE_AUTH_EMULATOR_HOST plus
 * GCLOUD_PROJECT during local development. Lazy so that importing a route
 * module never requires credentials — the API boots fine and only an actual
 * auth call fails loudly when unconfigured.
 */
function adminAuth() {
  if (getApps().length === 0) initializeApp();
  return getAuth();
}

export function verifyIdToken(token: string): Promise<DecodedIdToken> {
  return adminAuth().verifyIdToken(token);
}

/**
 * Creating users is the backend's job alone — client-side signup is disabled
 * at the platform level (infra/firebase.tf), which is what makes the
 * @uic.edu validation in routes/auth.ts enforceable.
 */
export function createFirebaseUser(input: {
  uid: string;
  email: string;
  password: string;
  displayName?: string;
}): Promise<UserRecord> {
  return adminAuth().createUser(input);
}

export function deleteFirebaseUser(uid: string): Promise<void> {
  return adminAuth().deleteUser(uid);
}

/** True when createUser failed because the email already has an account. */
export function isEmailTakenError(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === 'auth/email-already-exists';
}

/** True when a token failed verification because it expired. */
export function isTokenExpiredError(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === 'auth/id-token-expired';
}
