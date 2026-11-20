import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import {
  createFirebaseUser,
  deleteFirebaseUser,
  isEmailTakenError,
} from '../auth/firebase';
import { toPublicUser } from '../auth/user';
import { db } from '../db';
import { uniqueViolationConstraint } from '../db/errors';
import { users } from '../db/schema';
import { findUserByEmail, requireAuth } from '../middleware/auth';
import { conflict } from '../middleware/errors';
import { createRateLimiter, rateLimitByIp } from '../middleware/rateLimit';
import { parseRegistration } from '../validation';

export const authRoutes = Router();

/**
 * Registration is the only unauthenticated endpoint that creates state, and it
 * is expensive: a Firebase user plus a row, per call. Unthrottled it was free
 * mass account creation and a membership oracle anyone could run at any rate.
 *
 * Exported so tests can clear it between cases — the app is built once per
 * suite, so without that the windows carry across.
 */
export const registerLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 10 });

const TOO_MANY_REGISTRATIONS = 'Too many registration attempts. Wait a few minutes and try again.';

/**
 * One answer for "this account already exists", whichever column said so.
 *
 * The two used to be distinct (`email_taken` / `uin_taken`), which was kinder
 * — it sent the member to the field that was actually wrong. It was also an
 * oracle for a student number: submit any unused address with a UIN and the
 * code told you whether that UIN belongs to a member, and the orphaned
 * Firebase account is cleaned up, so it could be repeated indefinitely. A UIN
 * is not guessable from outside, so confirming one is a real disclosure.
 *
 * Naming both fields in the message keeps the member able to act on it
 * without the response distinguishing which one matched.
 *
 * Note the limit: that an address has *some* account is still inferable here,
 * because registration has to refuse a duplicate somehow. Only the per-field
 * distinction is gone; the rate limit above is what caps the rest.
 */
const ACCOUNT_EXISTS = 'An account already exists with that email address or UIN.';

/**
 * Registration is the only place accounts are created. Client-side Firebase
 * signup is disabled at the platform level, so the UIC-address rule in
 * parseRegistration cannot be bypassed by talking to Firebase directly.
 * Sign-in itself has no route here — the app exchanges credentials with
 * Firebase and sends the resulting ID token on every request.
 */
authRoutes.post(
  '/register',
  rateLimitByIp(registerLimiter, TOO_MANY_REGISTRATIONS),
  async (req, res) => {
    const input = parseRegistration(req.body);

    const [existing] = await findUserByEmail(input.email);
    if (existing) throw conflict(ACCOUNT_EXISTS, 'account_exists');

    // One id on both sides: the row's primary key is the Firebase uid.
    const id = randomUUID();

    try {
      await createFirebaseUser({
        uid: id,
        email: input.email,
        password: input.password,
        displayName: input.name,
      });
    } catch (err) {
      // Firebase enforces email uniqueness, so it also decides the race two
      // simultaneous registrations run. Same answer as the row check above.
      if (isEmailTakenError(err)) {
        throw conflict(ACCOUNT_EXISTS, 'account_exists');
      }
      throw err;
    }

    let created;
    try {
      [created] = await db
        .insert(users)
        .values({
          id,
          firebaseUid: id,
          email: input.email,
          name: input.name,
          gender: input.gender,
          genderSelfDescribed: input.genderSelfDescribed,
          schoolLevel: input.schoolLevel,
          schoolLevelOther: input.schoolLevelOther,
          majors: input.majors,
          majorOther: input.majorOther,
          memberId: input.memberId,
          uin: input.uin,
        })
        .returning();
    } catch (err) {
      // The row is the source of truth. A failed insert must not leave an
      // orphaned Firebase account squatting on the email address.
      await deleteFirebaseUser(id).catch(() => {});

      // Either unique column lands on the same answer — see ACCOUNT_EXISTS.
      if (uniqueViolationConstraint(err)) throw conflict(ACCOUNT_EXISTS, 'account_exists');
      throw err;
    }

    if (!created) throw new Error('Insert returned no row');

    // No token: the client signs in with Firebase right after registering.
    res.status(201).json({ user: toPublicUser(created) });
  },
);

/**
 * Rehydrates the session when the app boots holding a Firebase user.
 *
 * emailVerified rides along so the app can show that state without asking a
 * second endpoint. Nothing refuses on it today — see middleware/auth.ts for
 * why — but the app still uses it to prompt.
 */
authRoutes.get('/me', requireAuth, (req, res) => {
  res.json({ user: toPublicUser(req.currentUser!), emailVerified: req.emailVerified === true });
});
