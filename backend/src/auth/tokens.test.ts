import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { env } from '../env';
import {
  signCheckinToken,
  signSession,
  verifyCheckinToken,
  verifySession,
} from './tokens';

describe('session tokens', () => {
  it('round-trips claims', () => {
    const token = signSession({ sub: 'user-1', isAdmin: true });
    expect(verifySession(token)).toEqual({ sub: 'user-1', isAdmin: true });
  });

  it('defaults isAdmin to false rather than trusting a missing claim', () => {
    const token = jwt.sign({ sub: 'user-1' }, env.jwtSecret);
    expect(verifySession(token).isAdmin).toBe(false);
  });

  it('rejects a token signed with a different secret', () => {
    const token = jwt.sign({ sub: 'user-1' }, 'some-other-secret');
    expect(() => verifySession(token)).toThrow(/Invalid session/);
  });

  it('reports an expired session distinctly, so the app can prompt a re-login', () => {
    const token = jwt.sign({ sub: 'user-1' }, env.jwtSecret, { expiresIn: -10 });
    expect(() => verifySession(token)).toThrow(/expired/);
  });
});

describe('check-in tokens', () => {
  it('round-trips the event id', () => {
    const { token } = signCheckinToken('event-1');
    expect(verifyCheckinToken(token)).toEqual({ eventId: 'event-1', kind: 'checkin' });
  });

  it('expires within the configured window', () => {
    const { expiresIn } = signCheckinToken('event-1');
    expect(expiresIn).toBe(env.checkinTokenTtlSeconds);

    const stale = jwt.sign({ eventId: 'event-1', kind: 'checkin' }, env.jwtSecret, {
      expiresIn: -1,
    });
    expect(() => verifyCheckinToken(stale)).toThrow(/expired/);
  });

  it('rejects a tampered signature', () => {
    const { token } = signCheckinToken('event-1');
    const tampered = `${token.slice(0, -3)}aaa`;
    expect(() => verifyCheckinToken(tampered)).toThrow(/not valid/);
  });
});

// Both token kinds are signed with the same secret, so each verifier has to
// reject the other's tokens explicitly. Without this, scanning a QR code would
// hand the scanner a usable session.
describe('the two token kinds are not interchangeable', () => {
  it('will not accept a check-in token as a session', () => {
    const { token } = signCheckinToken('event-1');
    expect(() => verifySession(token)).toThrow(/Invalid session/);
  });

  it('will not accept a session token as a check-in code', () => {
    const token = signSession({ sub: 'user-1', isAdmin: true });
    expect(() => verifyCheckinToken(token)).toThrow(/not valid/);
  });
});
