import { describe, expect, it } from 'vitest';
import { isUniqueViolation, UNIQUE_VIOLATION } from './errors';

/** Stands in for the pg driver error. */
const pgError = () => Object.assign(new Error('duplicate key value'), { code: UNIQUE_VIOLATION });

describe('isUniqueViolation', () => {
  it('recognises the raw driver error', () => {
    expect(isUniqueViolation(pgError())).toBe(true);
  });

  // The case that actually bit: Drizzle wraps the driver error, so reading
  // err.code found nothing and a duplicate came back as a 500.
  it('recognises it through a Drizzle wrapper', () => {
    const wrapped = Object.assign(new Error('Failed query: insert into ...'), {
      cause: pgError(),
    });
    expect(isUniqueViolation(wrapped)).toBe(true);
  });

  it('recognises it through more than one layer of wrapping', () => {
    const wrapped = new Error('outer', {
      cause: new Error('middle', { cause: pgError() }),
    });
    expect(isUniqueViolation(wrapped)).toBe(true);
  });

  it('does not mistake other failures for a duplicate', () => {
    expect(isUniqueViolation(new Error('connection refused'))).toBe(false);
    expect(isUniqueViolation(Object.assign(new Error('bad input'), { code: '22P02' }))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });

  it('terminates on a self-referential cause chain', () => {
    const loop: { cause?: unknown; code?: string } = {};
    loop.cause = loop;
    expect(isUniqueViolation(loop)).toBe(false);
  });
});
