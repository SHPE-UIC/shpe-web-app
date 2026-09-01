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
 * A signed-in member, verified address or not.
 *
 * Deliberately narrow: it exists for the routes an unverified member still has
 * to reach, and right now that is GET /api/auth/me alone. The app calls /me to
 * decide what to render, so gating it would leave someone who has not clicked
 * the link with no session the app can see — and therefore no screen to resend
 * the email from. Every other route uses requireAuth.
 */
export const requireSession: RequestHandler = async (req, _res, next) => {
  try {
    await loadSession(req);
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * The default guard: a signed-in member whose email address is verified.
 *
 * Verification is checked from the token claim rather than a column, so
 * clicking the link is enough — nothing has to write to Postgres for access to
 * open up. The client has to force a token refresh afterwards for the new
 * claim to appear; until it does, this correctly still says no.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    await loadSession(req);
    if (!req.emailVerified) {
      throw forbidden(
        'Verify your email address to continue. Check your inbox for the link.',
        'email_unverified',
      );
    }
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
