import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const runSyncSafely = vi.hoisted(() => vi.fn());
vi.mock('../calendar/sync', () => ({
  runSyncSafely,
  startCalendarSyncLoop: vi.fn(),
}));

import { createApp } from '../app';
import { pool } from '../db';
import { env } from '../env';

let server: Server;
let base: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = createApp().listen(0, () => resolve());
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});

const RESULT = { created: 1, updated: 0, unchanged: 0, deleted: 0, seen: 1, fullSync: false };

beforeEach(() => {
  runSyncSafely.mockReset().mockResolvedValue(RESULT);
});

const trigger = (headers: Record<string, string> = {}, query = '') =>
  fetch(`${base}/api/sync/calendar${query}`, { method: 'POST', headers });

describe('POST /api/sync/calendar', () => {
  it('runs when the caller presents the configured secret', async () => {
    const previous = env.syncSecret;
    env.syncSecret = 'the-real-secret';
    try {
      const res = await trigger({ 'x-sync-secret': 'the-real-secret' });

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject(RESULT);
    } finally {
      env.syncSecret = previous;
    }
  });

  it('refuses a wrong secret', async () => {
    const previous = env.syncSecret;
    env.syncSecret = 'the-real-secret';
    try {
      const res = await trigger({ 'x-sync-secret': 'not-it' });
      const body = (await res.json()) as { error?: { code?: string } };

      expect(res.status).toBe(401);
      expect(body.error?.code).toBe('bad_sync_secret');
      expect(runSyncSafely).not.toHaveBeenCalled();
    } finally {
      env.syncSecret = previous;
    }
  });

  it('refuses a missing secret', async () => {
    const previous = env.syncSecret;
    env.syncSecret = 'the-real-secret';
    try {
      const res = await trigger();

      expect(res.status).toBe(401);
      expect(runSyncSafely).not.toHaveBeenCalled();
    } finally {
      env.syncSecret = previous;
    }
  });

  /**
   * Deliberate: an unset secret leaves the endpoint open so local development
   * needs no configuration. Production always sets one — this test exists so
   * the openness stays a decision rather than becoming a surprise.
   */
  it('is open when no secret is configured', async () => {
    const previous = env.syncSecret;
    env.syncSecret = '';
    try {
      const res = await trigger();

      expect(res.status).toBe(200);
      expect(runSyncSafely).toHaveBeenCalled();
    } finally {
      env.syncSecret = previous;
    }
  });

  it('passes ?full=1 through as a forced full sync', async () => {
    const previous = env.syncSecret;
    env.syncSecret = '';
    try {
      await trigger({}, '?full=1');
      expect(runSyncSafely).toHaveBeenCalledWith({ forceFullSync: true });

      runSyncSafely.mockClear();
      await trigger();
      expect(runSyncSafely).toHaveBeenCalledWith({ forceFullSync: false });
    } finally {
      env.syncSecret = previous;
    }
  });

  // The loop guard returns undefined when a run is already in flight; the
  // endpoint has to say something rather than answer with an empty body.
  it('explains itself when a sync is already running', async () => {
    const previous = env.syncSecret;
    env.syncSecret = '';
    runSyncSafely.mockResolvedValue(undefined);
    try {
      const res = await trigger();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ skipped: 'a sync is already running' });
    } finally {
      env.syncSecret = previous;
    }
  });
});
