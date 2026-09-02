/** Postgres unique_violation. */
export const UNIQUE_VIOLATION = '23505';

/**
 * Whether an error is a Postgres unique-constraint violation. Without this a
 * duplicate row surfaces as a 500 rather than a 409.
 */
export function isUniqueViolation(err: unknown): boolean {
  return findUniqueViolation(err) !== null;
}

/**
 * Which unique constraint a duplicate row broke, or null if it broke none.
 *
 * `users` has more than one unique column, so "a duplicate" is no longer a
 * complete answer: telling a member their email is taken when it was their UIN
 * that collided sends them to correct a field that was never wrong.
 *
 * Null when the violation names no constraint — pg always does, but the field
 * is not in the driver's public typings, so the caller still needs a branch.
 */
export function uniqueViolationConstraint(err: unknown): string | null {
  const violation = findUniqueViolation(err);
  const constraint = violation?.constraint;
  return typeof constraint === 'string' ? constraint : null;
}

/**
 * Walks the `cause` chain for a unique violation.
 *
 * Drizzle wraps driver errors in its own DrizzleQueryError and puts the pg
 * error on `cause`, so reading `err.code` directly finds nothing. Walk the
 * chain rather than assuming a depth, since the wrapping is an implementation
 * detail that has changed between releases.
 */
function findUniqueViolation(err: unknown): { constraint?: unknown } | null {
  let current: unknown = err;

  for (let depth = 0; depth < 5 && current; depth += 1) {
    if ((current as { code?: unknown }).code === UNIQUE_VIOLATION) {
      return current as { constraint?: unknown };
    }
    current = (current as { cause?: unknown }).cause;
  }

  return null;
}
