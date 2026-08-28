import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';

/**
 * The login route compares against this hash when the email is unknown, so that
 * a failed login costs the same either way. If it were not a well-formed bcrypt
 * hash, bcrypt.compare would throw and every unknown-email login would 500
 * instead of returning 401.
 */
const DUMMY_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8e2Zo4Wl0k6UQ5S3zXKQ0Zr0zF4Q1S';

describe('login timing-equalisation hash', () => {
  it('is a well-formed bcrypt hash that compares false without throwing', async () => {
    await expect(bcrypt.compare('anything at all', DUMMY_HASH)).resolves.toBe(false);
  });

  it('matches the constant the route actually uses', async () => {
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('./auth.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain(DUMMY_HASH);
  });
});
