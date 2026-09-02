import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyIdToken = vi.fn();
// Only the network call is faked; the pure helpers (error classification)
// stay real so this suite exercises the actual mapping logic.
vi.mock('../auth/firebase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/firebase')>()),
  verifyIdToken: (token: string) => verifyIdToken(token),
}));

// The real db module would build queries against a live pool. The middleware
// only ever runs select().from().where().limit(); feed it canned rows.
const rowQueue: unknown[][] = [];
vi.mock('../db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => rowQueue.shift() ?? [],
        }),
      }),
    }),
  },
}));

import { requireAuth } from './auth';
import { HttpError } from './errors';

const MEMBER_ROW = { id: 'user-1', firebaseUid: 'fb-1', email: 'ann@uic.edu', role: 0 };

async function runMiddleware(header?: string) {
  const req = {
    get: (name: string) => (name.toLowerCase() === 'authorization' ? header : undefined),
  } as unknown as Request;

  let error: unknown;
  const next: NextFunction = (err?: unknown) => {
    error = err;
  };

  await requireAuth(req, {} as Response, next);
  return { req: req as Request & { currentUser?: unknown }, error };
}

beforeEach(() => {
  verifyIdToken.mockReset();
  rowQueue.length = 0;
});

describe('requireAuth with Firebase ID tokens', () => {
  it('attaches the member row for a valid token', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'fb-1' });
    rowQueue.push([MEMBER_ROW]);

    const { req, error } = await runMiddleware('Bearer good-token');

    expect(error).toBeUndefined();
    expect(verifyIdToken).toHaveBeenCalledWith('good-token');
    expect(req.currentUser).toEqual(MEMBER_ROW);
  });

  it('rejects a missing Authorization header', async () => {
    const { error } = await runMiddleware(undefined);
    expect((error as HttpError).code).toBe('no_token');
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('rejects a verified token whose account no longer exists', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'fb-gone' });

    const { error } = await runMiddleware('Bearer good-token');
    expect((error as HttpError).code).toBe('user_gone');
  });

  it('maps an expired Firebase token to session_expired', async () => {
    verifyIdToken.mockRejectedValue(
      Object.assign(new Error('expired'), { code: 'auth/id-token-expired' }),
    );

    const { error } = await runMiddleware('Bearer stale-token');
    expect((error as HttpError).code).toBe('session_expired');
    expect((error as HttpError).status).toBe(401);
  });

  it('maps any other verification failure to session_invalid', async () => {
    verifyIdToken.mockRejectedValue(new Error('nope'));

    const { error } = await runMiddleware('Bearer forged-token');
    expect((error as HttpError).code).toBe('session_invalid');
    expect((error as HttpError).status).toBe(401);
  });
});
