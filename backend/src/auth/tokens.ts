import jwt from 'jsonwebtoken';
import { env } from '../env';
import { unauthorized } from '../middleware/errors';

// Member sessions are Firebase ID tokens (see ./firebase.ts). What remains
// here is the check-in QR token: a short-lived, event-scoped capability that
// has nothing to do with who is signed in, so it stays a local JWT.

/** What a check-in QR code carries. Scoped to one event and short-lived. */
export type CheckinClaims = {
  eventId: string;
  kind: 'checkin';
};

export function signCheckinToken(eventId: string): { token: string; expiresIn: number } {
  const expiresIn = env.checkinTokenTtlSeconds;
  const token = jwt.sign(
    { eventId, kind: 'checkin' } satisfies CheckinClaims,
    env.checkinTokenSecret,
    { expiresIn },
  );
  return { token, expiresIn };
}

export function verifyCheckinToken(token: string): CheckinClaims {
  let payload: unknown;
  try {
    payload = jwt.verify(token, env.checkinTokenSecret);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw unauthorized('This QR code has expired. Ask the organizer to refresh it.', 'qr_expired');
    }
    throw unauthorized('This QR code is not valid', 'qr_invalid');
  }

  const claims = payload as Partial<CheckinClaims>;
  if (claims.kind !== 'checkin' || typeof claims.eventId !== 'string') {
    throw unauthorized('This QR code is not valid', 'qr_invalid');
  }

  return { eventId: claims.eventId, kind: 'checkin' };
}
