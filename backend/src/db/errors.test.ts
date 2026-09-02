import { describe, expect, it } from 'vitest';
import { isUniqueViolation, uniqueViolationConstraint } from './errors';

/** What the pg driver throws, wrapped the way Drizzle wraps it. */
function wrapped(depth: number, error: unknown): unknown {
  let current = error;
  for (let i = 0; i < depth; i += 1) {
    current = Object.assign(new Error('DrizzleQueryError'), { cause: current });
  }
  return current;
}

const duplicate = (constraint: string) =>
  Object.assign(new Error('duplicate key value'), { code: '23505', constraint });

describe('isUniqueViolation', () => {
  it('finds the code however deeply it is wrapped', () => {
    expect(isUniqueViolation(duplicate('users_uin_idx'))).toBe(true);
    expect(isUniqueViolation(wrapped(3, duplicate('users_uin_idx')))).toBe(true);
  });

  it('is false for anything else', () => {
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
    expect(isUniqueViolation(Object.assign(new Error('x'), { code: '23503' }))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});

/**
 * `users` now has two unique columns, so "which one" decides which field the
 * member is told to fix. Reporting a duplicate UIN as a taken email would send
 * them to correct something that was never wrong.
 */
describe('uniqueViolationConstraint', () => {
  it('returns the constraint name from any depth', () => {
    expect(uniqueViolationConstraint(duplicate('users_uin_idx'))).toBe('users_uin_idx');
    expect(uniqueViolationConstraint(wrapped(4, duplicate('users_email_lower_idx')))).toBe(
      'users_email_lower_idx',
    );
  });

  it('returns null when the error is not a unique violation', () => {
    expect(uniqueViolationConstraint(new Error('boom'))).toBeNull();
    expect(uniqueViolationConstraint(Object.assign(new Error('x'), { code: '23503' }))).toBeNull();
    expect(uniqueViolationConstraint(null)).toBeNull();
  });

  /** A unique violation with no constraint name is still a unique violation. */
  it('returns null, not undefined, when the violation names no constraint', () => {
    expect(uniqueViolationConstraint(Object.assign(new Error('x'), { code: '23505' }))).toBeNull();
  });
});
