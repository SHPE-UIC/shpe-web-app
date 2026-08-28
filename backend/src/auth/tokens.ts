import jwt from 'jsonwebtoken';
import { env } from '../env';
import { unauthorized } from '../middleware/errors';

/** What a signed-in member's token carries. Kept small — it is not storage. */
export type SessionClaims = {
  sub: string;
  isAdmin: boolean;
};

/** What a check-in QR code carries. Scoped to one event and short-lived. */
export type CheckinClaims = {
  eventId: string;
  kind: 'checkin';
};

export function signSession(claims: SessionClaims): string {
  return jwt.sign(claims, env.jwtSecret, {
    expiresIn: env.sessionTtl as jwt.SignOptions['expiresIn'],
  });
}

export function verifySession(token: string): SessionClaims {
  let payload: unknown;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw unauthorized('Your session expired. Please sign in again.', 'session_expired');
    }
    throw unauthorized('Invalid session', 'session_invalid');
  }

  const claims = payload as Partial<SessionClaims> & { kind?: string };

  // A check-in token is signed with the same secret. Without this, scanning a
  // QR code would hand back a valid-looking session.
  if (typeof claims.sub !== 'string' || claims.kind !== undefined) {
    throw unauthorized('Invalid session', 'session_invalid');
  }

  return { sub: claims.sub, isAdmin: claims.isAdmin === true };
}

export function signCheckinToken(eventId: string): { token: string; expiresIn: number } {
  const expiresIn = env.checkinTokenTtlSeconds;
  const token = jwt.sign({ eventId, kind: 'checkin' } satisfies CheckinClaims, env.jwtSecret, {
    expiresIn,
  });
  return { token, expiresIn };
}

export function verifyCheckinToken(token: string): CheckinClaims {
  let payload: unknown;
  try {
    payload = jwt.verify(token, env.jwtSecret);
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
