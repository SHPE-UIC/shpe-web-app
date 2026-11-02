import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROLE } from '../roles';

const fb = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
vi.mock('../auth/firebase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/firebase')>()),
  verifyIdToken: fb.verifyIdToken,
}));

const dbState = vi.hoisted(() => ({
  authRow: [] as unknown[],
  /** Answers for everything after the session lookup, in the order asked. */
  results: [] as unknown[][],
}));

/**
 * The session lookup starts from `users`; every other query takes the next
 * answer off the queue when the chain is awaited. Thenable rather than a
 * promise per link, for the reason given in admin.overview.test.ts.
 */
vi.mock('../db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../db')>();
  const builder = (): unknown => ({
    then: (resolve: (rows: unknown[]) => void) => resolve(dbState.results.shift() ?? []),
    where: () => builder(),
    innerJoin: () => builder(),
    leftJoin: () => builder(),
    orderBy: () => builder(),
    limit: () => builder(),
  });
  return {
    ...actual,
    db: {
      select: () => ({
        from: (table: unknown) =>
          table === actual.users
            ? { where: () => ({ limit: async () => dbState.authRow }) }
            : builder(),
      }),
    },
  };
});

import { createApp } from '../app';
import { pool } from '../db';

const OFFICER = {
  id: '11111111-1111-4111-8111-111111111111',
  firebaseUid: 'fb-officer',
  email: 'officer@uic.edu',
  name: 'Officer',
  role: ROLE.BOARD,
};

const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const EVENT = {
  id: EVENT_ID,
  name: 'Welcome Social',
  tag: 'Social',
  points: 5,
  startsAt: new Date('2026-09-20T22:00:00Z'),
  endsAt: new Date('2026-09-21T00:00:00Z'),
};

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
  fb.verifyIdToken.mockReset().mockResolvedValue({ uid: OFFICER.firebaseUid });
  dbState.authRow = [OFFICER];
  dbState.results = [];
});

const attendance = () =>
  fetch(`${base}/api/admin/events/${EVENT_ID}/attendance`, {
    headers: { Authorization: 'Bearer good-token' },
  });

describe('GET /api/admin/events/:id/attendance', () => {
  it("lists who RSVP'd, and whether each of them came", async () => {
    dbState.results.push(
      [EVENT],
      [], // check-ins, not under test here
      [
        {
          userId: 'u-1',
          name: 'Ana Miembro',
          email: 'ana@uic.edu',
          avatarPath: null,
          rsvpAt: new Date('2026-09-18T12:00:00Z'),
          checkedIn: true,
        },
        {
          userId: 'u-2',
          name: 'Diego Ausente',
          email: 'diego@uic.edu',
          avatarPath: null,
          rsvpAt: new Date('2026-09-19T12:00:00Z'),
          checkedIn: false,
        },
      ],
    );

    const res = await attendance();
    const body = (await res.json()) as { rsvps: Record<string, unknown>[] };

    expect(res.status).toBe(200);
    expect(body.rsvps).toEqual([
      {
        userId: 'u-1',
        name: 'Ana Miembro',
        email: 'ana@uic.edu',
        avatarUrl: null,
        rsvpAt: '2026-09-18T12:00:00.000Z',
        checkedIn: true,
      },
      {
        userId: 'u-2',
        name: 'Diego Ausente',
        email: 'diego@uic.edu',
        avatarUrl: null,
        rsvpAt: '2026-09-19T12:00:00.000Z',
        checkedIn: false,
      },
    ]);
  });

  it('lists nobody when nobody has RSVPd', async () => {
    dbState.results.push([EVENT], [], []);
    const body = (await (await attendance()).json()) as { rsvps: unknown[] };
    expect(body.rsvps).toEqual([]);
  });

  // Who plans to come is officer information, like who came.
  it('is refused to a member', async () => {
    dbState.authRow = [{ ...OFFICER, role: ROLE.MEMBER }];
    const res = await attendance();
    expect(res.status).toBe(403);
  });
});
