import { afterEach, describe, expect, it } from 'vitest';
import { env } from '../env';
import { AVATAR_CONTENT_TYPES, AVATAR_MAX_BYTES, avatarPrefix, avatarUrlFor, publicUrl } from './storage';

const USER = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  env.avatarsBucket = 'test-avatars';
});

describe('avatarPrefix', () => {
  // The upload URL is signed for one object, but adopting it is a separate
  // request that re-checks this prefix — so the two have to agree exactly.
  it('scopes a member to their own folder', () => {
    expect(avatarPrefix(USER)).toBe(`users/${USER}/`);
  });

  it('ends with a separator, so one id cannot prefix-match another', () => {
    expect(avatarPrefix('abc')).toBe('users/abc/');
    expect(`users/abcdef/x.jpg`.startsWith(avatarPrefix('abc'))).toBe(false);
  });
});

describe('accepted content types', () => {
  it('maps every allowed type to a file extension', () => {
    expect(AVATAR_CONTENT_TYPES).toEqual({
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    });
  });

  it('does not accept animated or vector formats', () => {
    expect(AVATAR_CONTENT_TYPES['image/gif']).toBeUndefined();
    expect(AVATAR_CONTENT_TYPES['image/svg+xml']).toBeUndefined();
  });

  it('caps uploads at 5 MB', () => {
    expect(AVATAR_MAX_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe('avatarUrlFor', () => {
  it('resolves a stored path to an absolute URL', () => {
    expect(avatarUrlFor(`users/${USER}/a.jpg`)).toBe(
      `https://storage.googleapis.com/test-avatars/users/${USER}/a.jpg`,
    );
  });

  it('is null when the member has no picture', () => {
    expect(avatarUrlFor(null)).toBeNull();
  });

  /**
   * Local development runs without a bucket. publicUrl alone would emit a URL
   * with an empty host segment, which looks like a broken image rather than
   * like an absent one.
   */
  it('is null when no bucket is configured, rather than a malformed URL', () => {
    env.avatarsBucket = '';
    expect(avatarUrlFor(`users/${USER}/a.jpg`)).toBeNull();
    expect(publicUrl(`users/${USER}/a.jpg`)).toContain('//users/');
  });
});
