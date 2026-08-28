import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { pool } from './db';

let server: Server;
let base: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = createApp().listen(0, resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  // The pool never connects in these tests, but it would still hold the
  // process open.
  await pool.end();
});

describe('CORS allowlist', () => {
  it('allows an origin that is on the list', async () => {
    const res = await fetch(`${base}/healthz`, {
      headers: { Origin: 'https://allowed.example.com' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://allowed.example.com');
  });

  // The failure this guards: an empty or unapplied CORS_ORIGINS makes the API
  // echo back whatever Origin it is given, which looks like it is working.
  it('refuses an origin that is not on the list, and sends no allow-origin header', async () => {
    const res = await fetch(`${base}/healthz`, {
      headers: { Origin: 'https://evil.example.com' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { code: 'cors_origin' } });
  });

  it('refuses a disallowed origin on a preflight too', async () => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil.example.com',
        'Access-Control-Request-Method': 'POST',
      },
    });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(res.status).toBe(403);
  });

  // curl, health pingers, and native app builds send no Origin at all. They are
  // not browsers, so the policy this enforces does not apply to them.
  it('allows a request with no Origin header', async () => {
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });
});

describe('error envelope', () => {
  it('returns a structured 404 for an unknown route', async () => {
    const res = await fetch(`${base}/api/nope`);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { message: expect.stringContaining('/api/nope') } });
  });
});
