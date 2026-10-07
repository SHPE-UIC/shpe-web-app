import type { Server } from 'node:http';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROLE } from '../roles';

const fb = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
vi.mock('../auth/firebase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/firebase')>()),
  verifyIdToken: fb.verifyIdToken,
}));

const dbState = vi.hoisted(() => ({
  authRow: [] as unknown[],
  eventRow: [] as unknown[],
  /** The caller's RSVP for the event, if any. */
  rsvpRow: [] as unknown[],
  inserted: [] as { values: Record<string, unknown>; onConflictDoNothing: boolean }[],
  deletes: 0,
}));

/**
 * Every lookup here ends in where().limit(); which rows come back depends on
 * the table the query started from.
 */
vi.mock('../db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../db')>();
  const rowsFor = (table: unknown) =>
    table === actual.users ? dbState.authRow : table === actual.events ? dbState.eventRow : dbState.rsvpRow;

  return {
    ...actual,
    db: {
      select: () => ({
        from: (table: unknown) => ({ where: () => ({ limit: async () => rowsFor(table) }) }),
      }),
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          const entry = { values, onConflictDoNothing: false };
          dbState.inserted.push(entry);
          return {
            onConflictDoNothing: async () => {
              entry.onConflictDoNothing = true;
            },
          };
        },
      }),
      delete: () => ({
        where: async () => {
          dbState.deletes += 1;
        },
      }),
    },
  };
});

import { createApp } from '../app';
import { pool } from '../db';
import { rsvps } from '../db/schema';

const MEMBER = {
  id: '11111111-1111-4111-8111-111111111111',
  firebaseUid: 'fb-member',
  email: 'ann@uic.edu',
  name: 'Ann',
  role: ROLE.MEMBER,
};

const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const HOUR = 60 * 60 * 1000;

const eventStarting = (offsetMs: number) => ({
  id: EVENT_ID,
  name: 'Resume Workshop',
  description: '',
  location: '',
  tag: 'Professional',
  points: 15,
  startsAt: new Date(Date.now() + offsetMs),
  endsAt: new Date(Date.now() + offsetMs + 2 * HOUR),
  allDay: false,
  source: 'manual',
});

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

beforeEach(() => {
  fb.verifyIdToken.mockReset().mockResolvedValue({ uid: MEMBER.firebaseUid });
  dbState.authRow = [MEMBER];
  dbState.eventRow = [eventStarting(24 * HOUR)];
  dbState.rsvpRow = [];
  dbState.inserted = [];
  dbState.deletes = 0;
});

const AUTH = { Authorization: 'Bearer good-token', 'Content-Type': 'application/json' };

const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = AUTH) =>
  fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });

describe('PUT /api/events/:id/rsvp', () => {
  it('refuses a signed-out request', async () => {
    const res = await call('PUT', `/api/events/${EVENT_ID}/rsvp`, undefined, {});
    expect(res.status).toBe(401);
    expect(dbState.inserted).toHaveLength(0);
  });

  it('records the caller as going', async () => {
    const res = await call('PUT', `/api/events/${EVENT_ID}/rsvp`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ rsvp: { going: true } });
    expect(dbState.inserted).toEqual([
      { values: { userId: MEMBER.id, eventId: EVENT_ID }, onConflictDoNothing: true },
    ]);
  });

  /**
   * onConflictDoNothing only makes a second tap a no-op if there is something
   * to conflict with. The mock above cannot show that, so the index the whole
   * guarantee rests on is pinned here: drop it from the schema and this fails.
   */
  it('rests on a unique index over (event, user)', () => {
    const index = getTableConfig(rsvps).indexes.find((i) => i.config.name === 'rsvps_event_user_idx');
    expect(index?.config.unique).toBe(true);
    // Event first, so the officers' per-event list can use it too.
    expect(index?.config.columns.map((column) => (column as { name: string }).name)).toEqual([
      'event_id',
      'user_id',
    ]);
  });

  // First-person only, like check-in: the member comes from the session and
  // nothing in the body can name someone else.
  it('ignores a user id in the body', async () => {
    await call('PUT', `/api/events/${EVENT_ID}/rsvp`, { userId: 'someone-else' });
    expect(dbState.inserted[0]!.values.userId).toBe(MEMBER.id);
  });

  it('refuses once the event has started', async () => {
    dbState.eventRow = [eventStarting(-HOUR)];

    const res = await call('PUT', `/api/events/${EVENT_ID}/rsvp`);

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('rsvp_closed');
    expect(dbState.inserted).toHaveLength(0);
  });

  it('answers 404 for an event that does not exist', async () => {
    dbState.eventRow = [];
    const res = await call('PUT', `/api/events/${EVENT_ID}/rsvp`);
    expect(res.status).toBe(404);
  });

  it('answers 404 rather than 500 for an id that is not a uuid', async () => {
    const res = await call('PUT', '/api/events/not-an-id/rsvp');
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/events/:id/rsvp', () => {
  it('takes the RSVP back', async () => {
    const res = await call('DELETE', `/api/events/${EVENT_ID}/rsvp`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ rsvp: { going: false } });
    expect(dbState.deletes).toBe(1);
  });

  it('refuses once the event has started', async () => {
    dbState.eventRow = [eventStarting(-HOUR)];

    const res = await call('DELETE', `/api/events/${EVENT_ID}/rsvp`);

    expect(res.status).toBe(400);
    expect(dbState.deletes).toBe(0);
  });

  it('refuses a signed-out request', async () => {
    const res = await call('DELETE', `/api/events/${EVENT_ID}/rsvp`, undefined, {});
    expect(res.status).toBe(401);
  });
});

describe('GET /api/events/:id', () => {
  it("tells the member they are going when they have RSVP'd", async () => {
    dbState.rsvpRow = [{ id: 'r-1' }];

    const res = await call('GET', `/api/events/${EVENT_ID}`);
    const body = (await res.json()) as { rsvp: { going: boolean } };

    expect(res.status).toBe(200);
    expect(body.rsvp).toEqual({ going: true });
  });

  it('tells them they are not, otherwise', async () => {
    const res = await call('GET', `/api/events/${EVENT_ID}`);
    expect(((await res.json()) as { rsvp: { going: boolean } }).rsvp).toEqual({ going: false });
  });
});
