import { eq, sql } from 'drizzle-orm';
import type { RequestHandler } from 'express';
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
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const token = bearerToken(req.get('authorization'));
    if (!token) throw unauthorized('Sign in to continue', 'no_token');

    let uid: string;
    try {
      ({ uid } = await verifyIdToken(token));
    } catch (err) {
      if (isTokenExpiredError(err)) {
        throw unauthorized('Your session expired. Please sign in again.', 'session_expired');
      }
      throw unauthorized('Invalid session', 'session_invalid');
    }

    const [user] = await db.select().from(users).where(eq(users.firebaseUid, uid)).limit(1);

    if (!user) throw unauthorized('Your account no longer exists', 'user_gone');

    req.currentUser = user;
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
