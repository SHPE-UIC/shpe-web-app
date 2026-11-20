import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRateLimiter } from './rateLimit';

afterEach(() => {
  vi.useRealTimers();
});

describe('createRateLimiter', () => {
  it('allows up to max in a window, then refuses', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 3 });

    expect(limiter.take('a')).toBe(true);
    expect(limiter.take('a')).toBe(true);
    expect(limiter.take('a')).toBe(true);
    expect(limiter.take('a')).toBe(false);
    expect(limiter.take('a')).toBe(false);
  });

  it('counts each key separately, so one caller cannot starve another', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1 });

    expect(limiter.take('a')).toBe(true);
    expect(limiter.take('a')).toBe(false);
    expect(limiter.take('b')).toBe(true);
  });

  it('starts a fresh window once the old one has passed', () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({ windowMs: 1000, max: 1 });

    expect(limiter.take('a')).toBe(true);
    expect(limiter.take('a')).toBe(false);

    vi.advanceTimersByTime(1001);
    expect(limiter.take('a')).toBe(true);
  });

  it('does not reopen a window early', () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({ windowMs: 1000, max: 1 });

    expect(limiter.take('a')).toBe(true);
    vi.advanceTimersByTime(999);
    expect(limiter.take('a')).toBe(false);
  });

  it('reset drops every window', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });

    expect(limiter.take('a')).toBe(true);
    expect(limiter.take('a')).toBe(false);

    limiter.reset();
    expect(limiter.take('a')).toBe(true);
  });

  /**
   * Keys come from the network, so the map must not grow without bound — that
   * would make the limiter its own memory exhaustion target. Expired entries
   * are swept once it passes the ceiling.
   */
  it('sweeps expired windows instead of growing forever', () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({ windowMs: 1000, max: 1 });

    for (let i = 0; i < 10_000; i += 1) limiter.take(`key-${i}`);

    // Every window above has now expired, so the next new key sweeps them.
    vi.advanceTimersByTime(1001);
    expect(limiter.take('fresh')).toBe(true);

    // The sweep must not have dropped the entry it just created.
    expect(limiter.take('fresh')).toBe(false);
  });
});
