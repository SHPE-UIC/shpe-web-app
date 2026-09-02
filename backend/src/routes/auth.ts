import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import {
  createFirebaseUser,
  deleteFirebaseUser,
  isEmailTakenError,
} from '../auth/firebase';
import { toPublicUser } from '../auth/user';
import { db } from '../db';
import { isUniqueViolation } from '../db/errors';
import { users } from '../db/schema';
import { findUserByEmail, requireSession } from '../middleware/auth';
import { conflict } from '../middleware/errors';
import { parseRegistration } from '../validation';

export const authRoutes = Router();

/**
 * Registration is the only place accounts are created. Client-side Firebase
 * signup is disabled at the platform level, so the UIC-address rule in
 * parseRegistration cannot be bypassed by talking to Firebase directly.
 * Sign-in itself has no route here — the app exchanges credentials with
 * Firebase and sends the resulting ID token on every request.
 */
authRoutes.post('/register', async (req, res) => {
  const input = parseRegistration(req.body);

  const [existing] = await findUserByEmail(input.email);
  if (existing) throw conflict('An account with that email already exists', 'email_taken');

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
      throw conflict('An account with that email already exists', 'email_taken');
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
        memberId: input.memberId,
      })
      .returning();
  } catch (err) {
    // The row is the source of truth. A failed insert must not leave an
    // orphaned Firebase account squatting on the email address.
    await deleteFirebaseUser(id).catch(() => {});
    if (isUniqueViolation(err)) {
      throw conflict('An account with that email already exists', 'email_taken');
    }
    throw err;
  }

  if (!created) throw new Error('Insert returned no row');

  // No token: the client signs in with Firebase right after registering.
  res.status(201).json({ user: toPublicUser(created) });
});

/**
 * Rehydrates the session when the app boots holding a Firebase user.
 *
 * requireSession, not requireAuth: this is the one route an unverified member
 * must still reach. It is what the app asks before rendering anything, so
 * refusing it would strand someone who has not clicked the link on the login
 * screen, with nowhere to resend the email from. Nothing here is worth
 * withholding either — it is the caller's own row, and they are already
 * holding a valid token for it.
 */
authRoutes.get('/me', requireSession, (req, res) => {
  res.json({ user: toPublicUser(req.currentUser!), emailVerified: req.emailVerified === true });
});
