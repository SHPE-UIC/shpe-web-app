import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROLE } from '../roles';

const fb = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
vi.mock('../auth/firebase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/firebase')>()),
  verifyIdToken: fb.verifyIdToken,
}));

/**
 * A db mock of its own rather than a share of admin.test.ts's.
 *
 * /overview runs five selects of three different shapes, one of them a
 * `groupBy().orderBy()` that the role-change mock has no reason to model.
 * Teaching that one builder every shape in the file would make both sets of
 * tests depend on the other's queries.
 */
const dbState = vi.hoisted(() => ({
  /** Answers, in the order the handler asks for them. */
  results: [] as unknown[][],
  authRow: [] as unknown[],
}));

vi.mock('../db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../db')>();

  /**
   * Thenable rather than a promise, so a result is taken from the queue when
   * the handler awaits the chain and not when it builds one. Returning a real
   * promise from each step consumes an answer per link, which silently
   * misaligns every query after the first multi-link one.
   */
  const builder = (): unknown => ({
    then: (resolve: (rows: unknown[]) => void) => resolve(dbState.results.shift() ?? []),
    where: () => ({ ...(builder() as object), limit: async () => dbState.authRow }),
    leftJoin: () => builder(),
    groupBy: () => builder(),
    orderBy: () => builder(),
  });

  return {
    ...actual,
    db: { select: () => ({ from: () => builder() }) },
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

/**
 * The selects /overview runs before the majors one, in that order — the queue
 * is positional, so this has to match the handler.
 */
const OTHER_STATS = () => [
  [{ total: 3, upcoming: 1, past: 2, fromCalendar: 0 }], // events
  [{ total: 4, board: 1, topEight: 1, joinedLast30Days: 2 }], // members
  [{ total: 5, uniqueAttendees: 3, pointsAwarded: 15 }], // check-ins
  [{ events: 2, checkIns: 4 }], // finished events
];

beforeEach(() => {
  fb.verifyIdToken.mockReset().mockResolvedValue({ uid: OFFICER.firebaseUid });
  dbState.authRow = [OFFICER];
  dbState.results.length = 0;
});

const overview = () =>
  fetch(`${base}/api/admin/overview`, { headers: { Authorization: 'Bearer good-token' } });

describe('GET /api/admin/overview', () => {
  it('reports majors as chapter-wide counts', async () => {
    dbState.results.push(
      ...OTHER_STATS(),
      [
        { major: 'Computer Science', members: 3 },
        { major: 'Mechanical Engineering', members: 1 },
      ],
    );

    const res = await overview();
    const body = (await res.json()) as {
      majors: { major: string; members: number }[];
    };

    expect(res.status).toBe(200);
    expect(body.majors).toEqual([
      { major: 'Computer Science', members: 3 },
      { major: 'Mechanical Engineering', members: 1 },
    ]);
  });

  it('reports nothing when no member has picked a major', async () => {
    dbState.results.push(...OTHER_STATS(), []);

    const res = await overview();
    const body = (await res.json()) as { majors: unknown[] };

    expect(res.status).toBe(200);
    expect(body.majors).toEqual([]);
  });

  /**
   * Everything on this screen is a count. A name, a UIN or a self-described
   * major reaching it would be a different screen than the one reviewed.
   */
  it('carries no per-member detail', async () => {
    dbState.results.push(
      ...OTHER_STATS(),
      [{ major: 'Computer Science', members: 3 }],
    );

    const res = await overview();
    const text = await res.text();

    expect(text).not.toContain('uin');
    expect(text).not.toContain('majorOther');
    expect(text).not.toContain('email');
  });

  it('refuses an ordinary member', async () => {
    dbState.authRow = [{ ...OFFICER, role: ROLE.MEMBER }];

    const res = await overview();
    const body = (await res.json()) as { error?: { code?: string } };

    expect(res.status).toBe(403);
    expect(body.error?.code).toBe('not_board');
  });
});
