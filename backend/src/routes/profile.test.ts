import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const fb = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
vi.mock('../auth/firebase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/firebase')>()),
  verifyIdToken: fb.verifyIdToken,
}));

const storage = vi.hoisted(() => ({
  createUploadUrl: vi.fn(),
  deleteObject: vi.fn(),
}));
vi.mock('../avatars/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../avatars/storage')>()),
  createUploadUrl: storage.createUploadUrl,
  deleteObject: storage.deleteObject,
}));

const MEMBER_ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  firebaseUid: 'fb-1',
  email: 'ann@uic.edu',
  name: 'Ann',
  gender: 'Female',
  schoolLevel: null,
  memberId: null,
  avatarPath: null as string | null,
  role: 0,
  createdAt: new Date('2026-08-30T00:00:00Z'),
};

// Canned query results. requireAuth reads the row; the PUT handler updates it.
const dbState = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  updateValues: [] as Record<string, unknown>[],
}));

vi.mock('../db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../db')>();
  return {
    ...actual,
    db: {
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => (dbState.row ? [dbState.row] : []) }) }),
      }),
      update: () => ({
        set: (values: Record<string, unknown>) => {
          dbState.updateValues.push(values);
          return {
            where: () => ({
              returning: async () => [{ ...dbState.row, ...values }],
            }),
          };
        },
      }),
    },
  };
});

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

beforeEach(() => {
  fb.verifyIdToken.mockReset().mockResolvedValue({ uid: 'fb-1' });
  storage.createUploadUrl.mockReset();
  storage.deleteObject.mockReset().mockResolvedValue(undefined);
  dbState.row = { ...MEMBER_ROW };
  dbState.updateValues.length = 0;
});

const AUTH = { Authorization: 'Bearer good-token', 'Content-Type': 'application/json' };

const post = (body: unknown) =>
  fetch(`${base}/api/profile/avatar/upload-url`, {
    method: 'POST',
    headers: AUTH,
    body: JSON.stringify(body),
  });

const put = (body: unknown, headers: Record<string, string> = AUTH) =>
  fetch(`${base}/api/profile/avatar`, { method: 'PUT', headers, body: JSON.stringify(body) });

describe('POST /api/profile/avatar/upload-url', () => {
  it('issues a signed upload URL scoped to the caller', async () => {
    const objectPath = `users/${MEMBER_ROW.id}/abc.jpg`;
    storage.createUploadUrl.mockResolvedValue({ url: 'https://signed.example/put', objectPath });

    const res = await post({ contentType: 'image/jpeg' });
    const body = (await res.json()) as { url: string; objectPath: string; maxBytes: number };

    expect(res.status).toBe(201);
    expect(body.url).toBe('https://signed.example/put');
    expect(body.objectPath).toBe(objectPath);
    expect(body.maxBytes).toBeGreaterThan(0);
    expect(storage.createUploadUrl).toHaveBeenCalledWith(MEMBER_ROW.id, 'image/jpeg');
  });

  it('rejects a content type outside the allowlist', async () => {
    const res = await post({ contentType: 'image/gif' });
    const body = (await res.json()) as { error?: { code?: string } };

    expect(res.status).toBe(400);
    expect(body.error?.code).toBe('bad_content_type');
    expect(storage.createUploadUrl).not.toHaveBeenCalled();
  });

  // Local development runs without a bucket. The rest of the app has to keep
  // working; only this endpoint goes dark.
  it('reports the feature as unconfigured when no bucket is set', async () => {
    const configured = env.avatarsBucket;
    env.avatarsBucket = '';
    try {
      const res = await post({ contentType: 'image/jpeg' });
      const body = (await res.json()) as { error?: { code?: string } };
      expect(res.status).toBe(503);
      expect(body.error?.code).toBe('avatars_disabled');
    } finally {
      env.avatarsBucket = configured;
    }
  });

  it('refuses anonymous callers', async () => {
    const res = await fetch(`${base}/api/profile/avatar/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: 'image/jpeg' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/profile/avatar', () => {
  it('adopts the new avatar and deletes the object it replaced', async () => {
    dbState.row = { ...MEMBER_ROW, avatarPath: `users/${MEMBER_ROW.id}/old.jpg` };
    const objectPath = `users/${MEMBER_ROW.id}/new.jpg`;

    const res = await put({ objectPath });
    const body = (await res.json()) as { user: { avatarUrl: string | null } };

    expect(res.status).toBe(200);
    expect(dbState.updateValues[0]).toEqual({ avatarPath: objectPath });
    expect(body.user.avatarUrl).toContain(objectPath);
    expect(storage.deleteObject).toHaveBeenCalledWith(`users/${MEMBER_ROW.id}/old.jpg`);
  });

  it('does not try to delete anything when there was no previous avatar', async () => {
    const res = await put({ objectPath: `users/${MEMBER_ROW.id}/first.jpg` });

    expect(res.status).toBe(200);
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  // The signed URL only covers the caller's own prefix, but the adopt step is
  // a separate request — without this check a member could point their row at
  // somebody else's picture.
  it('refuses an objectPath belonging to another member', async () => {
    const res = await put({ objectPath: 'users/someone-else/x.jpg' });
    const body = (await res.json()) as { error?: { code?: string } };

    expect(res.status).toBe(403);
    expect(body.error?.code).toBe('not_your_object');
    expect(dbState.updateValues).toHaveLength(0);
  });

  it('refuses a path that escapes the prefix with traversal', async () => {
    const res = await put({ objectPath: `users/${MEMBER_ROW.id}/../other/x.jpg` });
    expect(res.status).toBe(403);
  });
});
