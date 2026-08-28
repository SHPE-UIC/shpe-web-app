import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { signSession } from '../auth/tokens';
import { toPublicUser } from '../auth/user';
import { db } from '../db';
import { users } from '../db/schema';
import { findUserByEmail, requireAuth } from '../middleware/auth';
import { conflict, unauthorized } from '../middleware/errors';
import { parseCredentials, parseRegistration } from '../validation';

const BCRYPT_ROUNDS = 10;

/**
 * A valid bcrypt hash of a value nobody can supply. Compared against when the
 * email is unknown, so a failed login costs the same time either way and cannot
 * be used to discover which addresses have accounts.
 */
const DUMMY_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8e2Zo4Wl0k6UQ5S3zXKQ0Zr0zF4Q1S';

/** Postgres unique_violation. */
const UNIQUE_VIOLATION = '23505';

export const authRoutes = Router();

authRoutes.post('/register', async (req, res) => {
  const input = parseRegistration(req.body);

  const [existing] = await findUserByEmail(input.email);
  if (existing) throw conflict('An account with that email already exists', 'email_taken');

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  let created;
  try {
    [created] = await db
      .insert(users)
      .values({
        email: input.email,
        passwordHash,
        name: input.name,
        age: input.age,
        sexAtBirth: input.sexAtBirth,
        gender: input.gender,
        schoolLevel: input.schoolLevel,
        memberId: input.memberId,
      })
      .returning();
  } catch (err) {
    // Two simultaneous registrations can both pass the check above. The unique
    // index is what actually decides; translate its error into the same answer.
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
      throw conflict('An account with that email already exists', 'email_taken');
    }
    throw err;
  }

  if (!created) throw new Error('Insert returned no row');

  const user = toPublicUser(created);
  res.status(201).json({ token: signSession({ sub: user.id, isAdmin: user.isAdmin }), user });
});

authRoutes.post('/login', async (req, res) => {
  const { email, password } = parseCredentials(req.body);

  const [found] = await findUserByEmail(email);
  const matches = await bcrypt.compare(password, found?.passwordHash ?? DUMMY_HASH);

  // One message for both "no such account" and "wrong password" — telling them
  // apart hands an attacker a membership oracle.
  if (!found || !matches) {
    throw unauthorized('Email or password is incorrect', 'bad_credentials');
  }

  const user = toPublicUser(found);
  res.json({ token: signSession({ sub: user.id, isAdmin: user.isAdmin }), user });
});

/** Rehydrates the session when the app boots holding a stored token. */
authRoutes.get('/me', requireAuth, (req, res) => {
  res.json({ user: toPublicUser(req.currentUser!) });
});
