/** Postgres unique_violation. */
export const UNIQUE_VIOLATION = '23505';

/**
 * Whether an error is a Postgres unique-constraint violation.
 *
 * Drizzle wraps driver errors in its own DrizzleQueryError and puts the pg
 * error on `cause`, so reading `err.code` directly finds nothing and a
 * duplicate row surfaces as a 500 rather than a 409. Walk the chain instead of
 * assuming a depth, since the wrapping is an implementation detail that has
 * changed between releases.
 */
export function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;

  for (let depth = 0; depth < 5 && current; depth += 1) {
    if ((current as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
    current = (current as { cause?: unknown }).cause;
  }

  return false;
}
