import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROLE } from '../roles';

const fb = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
vi.mock('../auth/firebase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/firebase')>()),
  verifyIdToken: fb.verifyIdToken,
}));

vi.mock('../audit', () => ({ recordAudit: vi.fn().mockResolvedValue(undefined) }));

/**
 * The role-change handler runs three different query shapes: a row lookup
 * (`.where().limit()`), a bare aggregate (`await db.select({...}).from(...)`),
 * and an update. The builder below answers all three from queues.
 */
const dbState = vi.hoisted(() => ({
  rows: [] as unknown[][],
  top8Remaining: 2,
  updateValues: [] as Record<string, unknown>[],
}));

vi.mock('../db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../db')>();
  return {
    ...actual,
    db: {
      select: () => ({
        from: () => {
          const aggregate = Promise.resolve([{ remaining: dbState.top8Remaining }]);
          return Object.assign(aggregate, {
            where: () => ({ limit: async () => dbState.rows.shift() ?? [] }),
          });
        },
      }),
      update: () => ({
        set: (values: Record<string, unknown>) => {
          dbState.updateValues.push(values);
          return {
            where: () => ({
              returning: async () => [{ ...TARGET, ...values }],
            }),
          };
        },
      }),
    },
  };
});

import { createApp } from '../app';
import { pool } from '../db';

const TOP8 = {
  id: '11111111-1111-4111-8111-111111111111',
  firebaseUid: 'fb-top8',
  email: 'officer@uic.edu',
  name: 'Officer',
  role: ROLE.TOP8,
};

const TARGET = {
  id: '22222222-2222-4222-8222-222222222222',
  firebaseUid: 'fb-target',
  email: 'ann@uic.edu',
  name: 'Ann',
  role: ROLE.TOP8,
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
  fb.verifyIdToken.mockReset().mockResolvedValue({ uid: TOP8.firebaseUid });
  dbState.rows = [[TOP8]]; // requireAuth's lookup
  dbState.top8Remaining = 2;
  dbState.updateValues.length = 0;
});

const setRole = (id: string, role: number) =>
  fetch(`${base}/api/admin/members/${id}/role`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer good-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });

describe('PATCH /api/admin/members/:id/role', () => {
  it('promotes another member', async () => {
    dbState.rows.push([{ ...TARGET, role: ROLE.MEMBER }]);

    const res = await setRole(TARGET.id, ROLE.BOARD);
    const body = (await res.json()) as { member: { role: number } };

    expect(res.status).toBe(200);
    expect(dbState.updateValues[0]).toEqual({ role: ROLE.BOARD });
    expect(body.member.role).toBe(ROLE.BOARD);
  });

  /**
   * The likely mis-tap, and the only route to a chapter with no Top 8 — so it
   * is refused on the server, not merely hidden in the app.
   */
  it('refuses to change your own level', async () => {
    const res = await setRole(TOP8.id, ROLE.MEMBER);
    const body = (await res.json()) as { error?: { code?: string } };

    expect(res.status).toBe(403);
    expect(body.error?.code).toBe('cannot_change_own_role');
    expect(dbState.updateValues).toHaveLength(0);
  });

  /** Nothing short of SQL could undo a chapter with zero Top 8s. */
  it('refuses to demote the last Top 8', async () => {
    dbState.rows.push([TARGET]);
    dbState.top8Remaining = 1;

    const res = await setRole(TARGET.id, ROLE.BOARD);
    const body = (await res.json()) as { error?: { code?: string } };

    expect(res.status).toBe(409);
    expect(body.error?.code).toBe('last_top8');
    expect(dbState.updateValues).toHaveLength(0);
  });

  it('allows demoting a Top 8 while others remain', async () => {
    dbState.rows.push([TARGET]);
    dbState.top8Remaining = 2;

    const res = await setRole(TARGET.id, ROLE.BOARD);

    expect(res.status).toBe(200);
    expect(dbState.updateValues[0]).toEqual({ role: ROLE.BOARD });
  });

  it('rejects a role outside the known set', async () => {
    const res = await setRole(TARGET.id, 99);
    const body = (await res.json()) as { error?: { code?: string } };

    expect(res.status).toBe(400);
    expect(body.error?.code).toBe('role_invalid');
  });

  it('reports an unknown member', async () => {
    dbState.rows.push([]);

    const res = await setRole(TARGET.id, ROLE.BOARD);
    const body = (await res.json()) as { error?: { code?: string } };

    expect(res.status).toBe(404);
    expect(body.error?.code).toBe('member_not_found');
  });

  it('refuses a board member — level changes are Top 8 only', async () => {
    dbState.rows = [[{ ...TOP8, role: ROLE.BOARD }]];

    const res = await setRole(TARGET.id, ROLE.BOARD);
    const body = (await res.json()) as { error?: { code?: string } };

    expect(res.status).toBe(403);
    expect(body.error?.code).toBe('not_top8');
  });
});
