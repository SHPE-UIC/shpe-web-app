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
  /** Each member's total, in no particular order, as the query returns them. */
  leaders: [] as unknown[],
}));

/**
 * requireAuth ends its query with where().limit(); the leaderboard's ends at
 * groupBy(). One builder answers both by which link the chain ends on.
 */
vi.mock('../db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../db')>();
  const chain = (): unknown => ({
    where: () => ({ limit: async () => dbState.authRow }),
    innerJoin: () => chain(),
    groupBy: async () => dbState.leaders,
  });
  return { ...actual, db: { select: () => ({ from: () => chain() }) } };
});

import { createApp } from '../app';
import { pool } from '../db';

const MEMBER = {
  id: '11111111-1111-4111-8111-111111111111',
  firebaseUid: 'fb-member',
  email: 'ann@uic.edu',
  name: 'Ann',
  role: ROLE.MEMBER,
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
  fb.verifyIdToken.mockReset().mockResolvedValue({ uid: MEMBER.firebaseUid });
  dbState.authRow = [MEMBER];
  dbState.leaders = [];
});

const leaderboard = (headers: Record<string, string> = { Authorization: 'Bearer good-token' }) =>
  fetch(`${base}/api/leaderboard`, { headers });

describe('GET /api/leaderboard', () => {
  it('refuses a signed-out request', async () => {
    const res = await leaderboard({});
    expect(res.status).toBe(401);
  });

  it('orders, ranks, and cuts the totals to five places', async () => {
    const at = (day: number) => new Date(Date.UTC(2026, 8, day));
    dbState.leaders = [
      { name: 'Cy Lopez', avatarPath: null, points: 30, reachedAt: at(9) },
      { name: 'Zero', avatarPath: null, points: 0, reachedAt: at(1) },
      { name: 'Ana Rivera', avatarPath: 'users/a/pic.jpg', points: 40, reachedAt: at(2) },
      { name: 'Ben Ortiz', avatarPath: null, points: 30, reachedAt: at(3) },
      { name: 'Dee', avatarPath: null, points: 20, reachedAt: at(1) },
      { name: 'Eli', avatarPath: null, points: 10, reachedAt: at(1) },
      { name: 'Fay', avatarPath: null, points: 5, reachedAt: at(1) },
    ];

    const res = await leaderboard();
    const body = (await res.json()) as {
      leaders: { rank: number; name: string; avatarUrl: string | null; points: number }[];
    };

    expect(res.status).toBe(200);
    expect(body.leaders.map((l) => [l.rank, l.name, l.points])).toEqual([
      [1, 'Ana Rivera', 40],
      [2, 'Ben Ortiz', 30],
      [2, 'Cy Lopez', 30],
      [4, 'Dee', 20],
      [5, 'Eli', 10],
    ]);
    expect(body.leaders[0]!.avatarUrl).toContain('users/a/pic.jpg');
    expect(body.leaders[1]!.avatarUrl).toBeNull();
  });

  /**
   * The one place a member sees other members. A name, a picture, and a
   * total — nothing that identifies an account or reaches a profile, even if
   * the query is later widened by accident.
   */
  it('hands out exactly rank, name, picture, and points', async () => {
    dbState.leaders = [
      {
        name: 'Ana Rivera',
        avatarPath: null,
        points: 40,
        reachedAt: new Date(),
        // What a careless select could drag in.
        id: 'u-1',
        email: 'ana@uic.edu',
        uin: '650000001',
        role: 2,
      },
    ];

    const res = await leaderboard();
    const body = (await res.json()) as { leaders: Record<string, unknown>[] };

    expect(Object.keys(body.leaders[0]!).sort()).toEqual(['avatarUrl', 'name', 'points', 'rank']);
  });

  it('answers an empty board when nobody has points', async () => {
    const res = await leaderboard();
    expect(await res.json()).toEqual({ leaders: [] });
  });
});
