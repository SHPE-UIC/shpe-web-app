import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const fb = vi.hoisted(() => ({
  createFirebaseUser: vi.fn(),
  deleteFirebaseUser: vi.fn(),
}));

vi.mock('../auth/firebase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/firebase')>()),
  createFirebaseUser: fb.createFirebaseUser,
  deleteFirebaseUser: fb.deleteFirebaseUser,
}));

// Canned query results instead of a live pool. Only the chains the auth
// routes actually run are modelled.
const dbState = vi.hoisted(() => ({
  selectRows: [] as unknown[][],
  insertValues: [] as Record<string, unknown>[],
  insertError: null as unknown,
  insertReturn: [] as unknown[],
}));

vi.mock('../db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../db')>();
  return {
    ...actual,
    db: {
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => dbState.selectRows.shift() ?? [] }),
        }),
      }),
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          dbState.insertValues.push(values);
          return {
            returning: async () => {
              if (dbState.insertError) throw dbState.insertError;
              return dbState.insertReturn;
            },
          };
        },
      }),
    },
  };
});

import { createApp } from '../app';
import { pool } from '../db';

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
  fb.createFirebaseUser.mockReset();
  fb.deleteFirebaseUser.mockReset();
  dbState.selectRows.length = 0;
  dbState.insertValues.length = 0;
  dbState.insertError = null;
  dbState.insertReturn = [];
});

const PAYLOAD = { email: 'ann@uic.edu', password: 'longenough', name: 'Ann' };

function insertedRow(values: Record<string, unknown>) {
  return {
    age: null,
    sexAtBirth: null,
    gender: null,
    schoolLevel: null,
    memberId: null,
    role: 0,
    createdAt: new Date('2026-08-29T00:00:00Z'),
    ...values,
  };
}

async function register(payload: unknown) {
  return fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

describe('POST /api/auth/register', () => {
  it('creates the Firebase user and the row under one shared id, returns no token', async () => {
    fb.createFirebaseUser.mockImplementation(async () => ({}));
    dbState.insertReturn = [];

    // The route inserts whatever id it generated; echo it back like Postgres would.
    fb.createFirebaseUser.mockImplementation(async ({ uid }: { uid: string }) => {
      dbState.insertReturn = [insertedRow({ id: uid, firebaseUid: uid, email: PAYLOAD.email, name: PAYLOAD.name })];
      return {};
    });

    const res = await register(PAYLOAD);
    const body = (await res.json()) as { user?: { id: string; email: string }; token?: string };

    expect(res.status).toBe(201);
    expect(body.token).toBeUndefined();
    expect(body.user?.email).toBe(PAYLOAD.email);

    expect(fb.createFirebaseUser).toHaveBeenCalledWith({
      uid: expect.any(String),
      email: PAYLOAD.email,
      password: PAYLOAD.password,
      displayName: PAYLOAD.name,
    });

    const { uid } = fb.createFirebaseUser.mock.calls[0][0] as { uid: string };
    expect(dbState.insertValues[0].id).toBe(uid);
    expect(dbState.insertValues[0].firebaseUid).toBe(uid);
    expect(dbState.insertValues[0]).not.toHaveProperty('passwordHash');
  });

  it('refuses a non-UIC email before touching Firebase', async () => {
    const res = await register({ ...PAYLOAD, email: 'ann@gmail.com' });
    const body = (await res.json()) as { error?: { code?: string } };

    expect(res.status).toBe(400);
    expect(body.error?.code).toBe('email_not_uic');
    expect(fb.createFirebaseUser).not.toHaveBeenCalled();
  });

  it('maps a Firebase email collision to the same 409 as a row collision', async () => {
    fb.createFirebaseUser.mockRejectedValue(
      Object.assign(new Error('exists'), { code: 'auth/email-already-exists' }),
    );

    const res = await register(PAYLOAD);
    const body = (await res.json()) as { error?: { code?: string } };

    expect(res.status).toBe(409);
    expect(body.error?.code).toBe('email_taken');
  });

  it('deletes the orphaned Firebase user when the row insert loses the race', async () => {
    fb.createFirebaseUser.mockResolvedValue({});
    fb.deleteFirebaseUser.mockResolvedValue(undefined);
    dbState.insertError = Object.assign(new Error('duplicate'), { code: '23505' });

    const res = await register(PAYLOAD);
    const body = (await res.json()) as { error?: { code?: string } };

    expect(res.status).toBe(409);
    expect(body.error?.code).toBe('email_taken');

    const { uid } = fb.createFirebaseUser.mock.calls[0][0] as { uid: string };
    expect(fb.deleteFirebaseUser).toHaveBeenCalledWith(uid);
  });
});

describe('POST /api/auth/login', () => {
  it('no longer exists — Firebase owns sign-in', async () => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: PAYLOAD.email, password: PAYLOAD.password }),
    });
    const body = (await res.json()) as { error?: { code?: string } };

    expect(res.status).toBe(404);
    expect(body.error?.code).toBe('no_route');
  });
});
