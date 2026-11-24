import type { RequestHandler } from 'express';
import { tooManyRequests } from './errors';

/**
 * A fixed-window counter, in memory.
 *
 * In memory rather than in Postgres or Redis because Cloud Run runs at most
 * two instances (infra/run.tf): the effective limit is `max × instances` and
 * it resets on a cold start. That is a real weakness, and still far better
 * than the nothing that was here before. A shared store is the upgrade path
 * if the cap ever needs to be exact.
 */
export type RateLimiter = {
  /** True if this key may proceed, false once it is over the limit. */
  take(key: string): boolean;
  /** Drops every window. For tests. */
  reset(): void;
};

/**
 * Keys are attacker-chosen (an IP), so the map needs a ceiling — an unbounded
 * one turns the limiter itself into a memory exhaustion target. Expired
 * entries are swept when it grows past this, which is far more keys than a
 * chapter's worth of members will ever produce.
 */
const MAX_KEYS = 10_000;

export function createRateLimiter({
  windowMs,
  max,
}: {
  windowMs: number;
  max: number;
}): RateLimiter {
  const windows = new Map<string, { count: number; expiresAt: number }>();

  return {
    take(key) {
      const now = Date.now();
      const window = windows.get(key);

      if (!window || window.expiresAt <= now) {
        // Swept here rather than on a timer: Cloud Run throttles the CPU
        // outside a request, so a setInterval would fire unpredictably if at
        // all. This branch is the cold path, so the cost lands away from the
        // keys being actively counted.
        if (windows.size >= MAX_KEYS) {
          for (const [k, v] of windows) if (v.expiresAt <= now) windows.delete(k);
        }
        windows.set(key, { count: 1, expiresAt: now + windowMs });
        return true;
      }

      if (window.count >= max) return false;

      window.count += 1;
      return true;
    },

    reset() {
      windows.clear();
    },
  };
}

/**
 * Limits a route by client IP.
 *
 * `req.ip` honours the `trust proxy` setting in app.ts, so on Cloud Run this
 * is the client from X-Forwarded-For rather than Google's load balancer. That
 * is also why proxy-addr had to be patched before this shipped (#66): a
 * spoofable client IP makes an IP-keyed limiter bypassable.
 */
export function rateLimitByIp(limiter: RateLimiter, message: string): RequestHandler {
  return (req, _res, next) => {
    // Express only leaves req.ip undefined when there is no socket, which
    // should not happen for a served request — counted under one key rather
    // than waved through.
    if (!limiter.take(req.ip ?? 'unknown')) return next(tooManyRequests(message));
    next();
  };
}
