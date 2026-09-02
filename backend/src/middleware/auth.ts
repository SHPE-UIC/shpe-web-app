import { eq, sql } from 'drizzle-orm';
import type { Request, RequestHandler } from 'express';
import { isTokenExpiredError, verifyIdToken } from '../auth/firebase';
import { db } from '../db';
import { users } from '../db/schema';
import { forbidden, unauthorized } from './errors';
import { isBoardOrAbove, isTop8 } from '../roles';

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!token || scheme?.toLowerCase() !== 'bearer') return null;
  return token;
}

/**
 * Verifies the Firebase ID token and loads the member row.
 *
 * The row is fetched on every request rather than trusted from the token
 * claims, so revoking an admin or deleting an account takes effect immediately
 * instead of whenever the token happens to expire. Roles never leave Postgres.
 *
 * Throws instead of calling next(), so both middlewares below can share it.
 */
async function loadSession(req: Request): Promise<void> {
  const token = bearerToken(req.get('authorization'));
  if (!token) throw unauthorized('Sign in to continue', 'no_token');

  let uid: string;
  let emailVerified: boolean;
  try {
    const decoded = await verifyIdToken(token);
    uid = decoded.uid;
    // Only an explicit true counts. The claim is absent rather than false on
    // some tokens, and "absent" must not read as "verified".
    emailVerified = decoded.email_verified === true;
  } catch (err) {
    if (isTokenExpiredError(err)) {
      throw unauthorized('Your session expired. Please sign in again.', 'session_expired');
    }
    throw unauthorized('Invalid session', 'session_invalid');
  }

  const [user] = await db.select().from(users).where(eq(users.firebaseUid, uid)).limit(1);

  if (!user) throw unauthorized('Your account no longer exists', 'user_gone');

  req.currentUser = user;
  req.emailVerified = emailVerified;
}

/**
 * The guard for every authenticated route: a signed-in member with a live row.
 *
 * It reports whether the address is verified but does not act on it. Refusing
 * unverified members was tried and reverted twice, both times because mail to
 * uic.edu was being discarded and the gate locked out people who had done
 * nothing wrong — see docs/EMAIL-DELIVERY.md. A gate is only as good as the
 * channel it depends on, and that channel is not yet reliable.
 *
 * req.emailVerified is still populated, and GET /api/auth/me still hands it to
 * the app, so the state stays visible. Enforcing again means restoring the
 * check here; the claim it would read has not changed.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    await loadSession(req);
    next();
  } catch (err) {
    next(err);
  }
};

/** Board members and above. Mount after requireAuth. */
export const requireBoard: RequestHandler = (req, _res, next) => {
  if (!req.currentUser) return next(unauthorized('Sign in to continue', 'no_token'));
  if (!isBoardOrAbove(req.currentUser.role)) {
    return next(forbidden('Board members only', 'not_board'));
  }
  next();
};

/**
 * Top 8 only — currently just changing other members' levels.
 *
 * Separate from requireBoard rather than a parameter, so a route's guard names
 * the level it needs at the point of use.
 */
export const requireTop8: RequestHandler = (req, _res, next) => {
  if (!req.currentUser) return next(unauthorized('Sign in to continue', 'no_token'));
  if (!isTop8(req.currentUser.role)) {
    return next(forbidden('Top 8 only', 'not_top8'));
  }
  next();
};

/** Case-insensitive lookup, matching the lower(email) unique index. */
export function findUserByEmail(email: string) {
  return db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`)
    .limit(1);
}
