import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { env } from '../env';
import { signCheckinToken, verifyCheckinToken } from './tokens';

describe('check-in tokens', () => {
  it('round-trips the event id', () => {
    const { token, expiresIn } = signCheckinToken('event-1');
    expect(expiresIn).toBe(env.checkinTokenTtlSeconds);
    expect(verifyCheckinToken(token)).toEqual({ eventId: 'event-1', kind: 'checkin' });
  });

  it('rejects a token missing the checkin kind', () => {
    const token = jwt.sign({ eventId: 'event-1' }, env.checkinTokenSecret);
    expect(() => verifyCheckinToken(token)).toThrow('This QR code is not valid');
  });

  it('rejects a token signed with a different secret', () => {
    const token = jwt.sign({ eventId: 'event-1', kind: 'checkin' }, 'some-other-secret');
    expect(() => verifyCheckinToken(token)).toThrow('This QR code is not valid');
  });

  it('rejects an expired token with the QR-specific message', () => {
    const token = jwt.sign({ eventId: 'event-1', kind: 'checkin' }, env.checkinTokenSecret, {
      expiresIn: -1,
    });
    expect(() => verifyCheckinToken(token)).toThrow('This QR code has expired');
  });

  it('rejects garbage', () => {
    expect(() => verifyCheckinToken('not-a-jwt')).toThrow('This QR code is not valid');
  });
});
