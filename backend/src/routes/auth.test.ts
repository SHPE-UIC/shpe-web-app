import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const fb = vi.hoisted(() => ({
  createFirebaseUser: vi.fn(),
  deleteFirebaseUser: vi.fn(),
  verifyIdToken: vi.fn(),
}));

vi.mock('../auth/firebase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/firebase')>()),
  createFirebaseUser: fb.createFirebaseUser,
  deleteFirebaseUser: fb.deleteFirebaseUser,
  verifyIdToken: fb.verifyIdToken,
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
  fb.verifyIdToken.mockReset();
  dbState.selectRows.length = 0;
  dbState.insertValues.length = 0;
  dbState.insertError = null;
  dbState.insertReturn = [];
});

const PAYLOAD = {
  email: 'ann@uic.edu',
  password: 'longenough',
  name: 'Ann',
  gender: 'Female',
  schoolLevel: '3rd',
  majors: ['Computer Science'],
  uin: '651234567',
};

function insertedRow(values: Record<string, unknown>) {
  return {
    gender: 'Female',
    schoolLevel: '3rd',
    schoolLevelOther: null,
    majors: ['Computer Science'],
    majorOther: null,
    memberId: null,
    uin: '651234567',
    role: 0,
    createdAt: new Date('2026-08-29T00:00:00Z'),
    ...values,
  };
}

/** What pg throws for a duplicate, wrapped the way Drizzle wraps it. */
const duplicate = (constraint: string) =>
  Object.assign(new Error('DrizzleQueryError'), {
    cause: Object.assign(new Error('duplicate key value'), { code: '23505', constraint }),
  });

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
    dbState.insertError = duplicate('users_email_lower_idx');

    const res = await register(PAYLOAD);
    const body = (await res.json()) as { error?: { code?: string } };

    expect(res.status).toBe(409);
    expect(body.error?.code).toBe('email_taken');

    const { uid } = fb.createFirebaseUser.mock.calls[0][0] as { uid: string };
    expect(fb.deleteFirebaseUser).toHaveBeenCalledWith(uid);
  });

  it('stores the profile answers the form collects', async () => {
    fb.createFirebaseUser.mockImplementation(async ({ uid }: { uid: string }) => {
      dbState.insertReturn = [insertedRow({ id: uid, firebaseUid: uid, email: PAYLOAD.email })];
      return {};
    });

    const res = await register({
      ...PAYLOAD,
      schoolLevel: 'Other',
      schoolLevelOther: 'Post-bacc',
      majors: ['Computer Science', 'Data Science'],
      majorOther: 'Linguistics',
    });
    expect(res.status).toBe(201);

    expect(dbState.insertValues[0]).toMatchObject({
      schoolLevel: 'Other',
      schoolLevelOther: 'Post-bacc',
      majors: ['Computer Science', 'Data Science'],
      majorOther: 'Linguistics',
      uin: '651234567',
    });
  });

  /**
   * The UIN is Top 8 material, served by its own route. If it ever appears
   * here it has reached every screen that renders the signed-in member.
   */
  it('never returns the UIN in the registration response', async () => {
    fb.createFirebaseUser.mockImplementation(async ({ uid }: { uid: string }) => {
      dbState.insertReturn = [insertedRow({ id: uid, firebaseUid: uid, email: PAYLOAD.email })];
      return {};
    });

    const res = await register(PAYLOAD);
    const body = (await res.json()) as { user: Record<string, unknown> };

    expect(res.status).toBe(201);
    expect(body.user).not.toHaveProperty('uin');
    expect(body.user.majors).toEqual(['Computer Science']);
    expect(JSON.stringify(body)).not.toContain('651234567');
  });

  // Two unique columns: telling someone their email is taken when it was the
  // UIN sends them to correct a field that was never wrong.
  it('names the UIN, not the email, when the UIN collides', async () => {
    fb.createFirebaseUser.mockResolvedValue({});
    fb.deleteFirebaseUser.mockResolvedValue(undefined);
    dbState.insertError = duplicate('users_uin_idx');

    const res = await register(PAYLOAD);
    const body = (await res.json()) as { error?: { code?: string } };

    expect(res.status).toBe(409);
    expect(body.error?.code).toBe('uin_taken');

    const { uid } = fb.createFirebaseUser.mock.calls[0][0] as { uid: string };
    expect(fb.deleteFirebaseUser).toHaveBeenCalledWith(uid);
  });

  it('refuses a malformed UIN before touching Firebase', async () => {
    const res = await register({ ...PAYLOAD, uin: '12345' });
    const body = (await res.json()) as { error?: { code?: string } };

    expect(res.status).toBe(400);
    expect(body.error?.code).toBe('uin_invalid');
    expect(fb.createFirebaseUser).not.toHaveBeenCalled();
  });

  it('refuses a registration with no major', async () => {
    const res = await register({ ...PAYLOAD, majors: [] });
    const body = (await res.json()) as { error?: { code?: string } };

    expect(res.status).toBe(400);
    expect(body.error?.code).toBe('major_required');
    expect(fb.createFirebaseUser).not.toHaveBeenCalled();
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

describe('GET /api/auth/me', () => {
  const ROW = insertedRow({
    id: '11111111-1111-4111-8111-111111111111',
    firebaseUid: 'fb-1',
    email: 'ann@uic.edu',
    name: 'Ann',
    avatarPath: null,
  });

  async function me() {
    return fetch(`${base}/api/auth/me`, {
      headers: { Authorization: 'Bearer good-token' },
    });
  }

  /**
   * The route the verification gate deliberately does not guard. If this ever
   * starts refusing unverified members, someone who has not clicked the link
   * has no session the app can see — and so no screen to resend it from.
   */
  it('answers for a member whose address is still unverified', async () => {
    fb.verifyIdToken.mockResolvedValue({ uid: 'fb-1', email_verified: false });
    dbState.selectRows.push([ROW]);

    const res = await me();
    const body = (await res.json()) as { user?: { email: string }; emailVerified?: boolean };

    expect(res.status).toBe(200);
    expect(body.user?.email).toBe('ann@uic.edu');
    expect(body.emailVerified).toBe(false);
  });

  it('reports a verified address', async () => {
    fb.verifyIdToken.mockResolvedValue({ uid: 'fb-1', email_verified: true });
    dbState.selectRows.push([ROW]);

    const body = (await (await me()).json()) as { emailVerified?: boolean };
    expect(body.emailVerified).toBe(true);
  });
});
