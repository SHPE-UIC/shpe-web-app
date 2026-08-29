import { ApiError, apiFetch } from './client';
import { clearToken, setToken } from '../tokenStore';

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const fetchMock = jest.fn();

beforeEach(async () => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  await clearToken();
});

// The *last* call, not the first: the token tests below make a second request
// to observe what the client did with the token after the first one failed.
const lastCall = () => fetchMock.mock.calls[fetchMock.mock.calls.length - 1]!;
const lastInit = () => lastCall()[1] as RequestInit;
const headers = () => lastInit().headers as Record<string, string>;

describe('request building', () => {
  it('prefixes the configured API base and returns parsed JSON', async () => {
    fetchMock.mockResolvedValue(okJson({ hello: 'world' }));

    await expect(apiFetch('/api/thing')).resolves.toEqual({ hello: 'world' });
    expect(fetchMock.mock.calls[0]![0]).toContain('/api/thing');
  });

  it('attaches the stored token as a bearer header', async () => {
    await setToken('a-token');
    fetchMock.mockResolvedValue(okJson({}));

    await apiFetch('/api/thing');
    expect(headers().Authorization).toBe('Bearer a-token');
  });

  it('omits the token when the call is anonymous', async () => {
    await setToken('a-token');
    fetchMock.mockResolvedValue(okJson({}));

    await apiFetch('/api/auth/login', { method: 'POST', anonymous: true, body: { a: 1 } });
    expect(headers().Authorization).toBeUndefined();
    expect(lastInit().body).toBe('{"a":1}');
  });

  it('sends no content-type when there is no body', async () => {
    fetchMock.mockResolvedValue(okJson({}));

    await apiFetch('/api/thing');
    expect(headers()['Content-Type']).toBeUndefined();
  });

  it('handles a 204 with no body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(apiFetch('/api/thing', { method: 'DELETE' })).resolves.toBeUndefined();
  });
});

describe('error mapping', () => {
  it('turns the error envelope into a typed ApiError', async () => {
    fetchMock.mockResolvedValue(
      okJson({ error: { message: 'Officers only', code: 'not_admin' } }, 403),
    );

    await expect(apiFetch('/api/admin/overview')).rejects.toMatchObject({
      status: 403,
      message: 'Officers only',
      code: 'not_admin',
    });
  });

  /**
   * The app and the API deploy separately and the app lands first, so just
   * after a release a new screen can call an endpoint the API does not have
   * yet. Showing the router's own message ("No route for GET ...") is what this
   * replaces.
   */
  it('explains a no_route 404 as deploy skew rather than passing it through', async () => {
    fetchMock.mockResolvedValue(
      okJson({ error: { message: 'internal router text', code: 'no_route' } }, 404),
    );

    const err: unknown = await apiFetch('/api/admin/overview').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.code).toBe('no_route');
    expect(apiErr.message).toMatch(/just updated/i);
    expect(apiErr.message).not.toContain('internal router text');
  });

  it('leaves an ordinary 404 alone', async () => {
    fetchMock.mockResolvedValue(
      okJson({ error: { message: 'That event does not exist', code: 'event_not_found' } }, 404),
    );

    await expect(apiFetch('/api/events/x')).rejects.toMatchObject({
      code: 'event_not_found',
      message: 'That event does not exist',
    });
  });

  // A token the API has rejected cannot start working again, so keeping it just
  // means every later request fails the same way.
  it('drops the stored token on a 401', async () => {
    await setToken('stale-token');
    fetchMock.mockResolvedValue(okJson({ error: { message: 'nope', code: 'session_expired' } }, 401));

    await expect(apiFetch('/api/auth/me')).rejects.toBeInstanceOf(ApiError);

    fetchMock.mockResolvedValue(okJson({}));
    await apiFetch('/api/thing');
    expect(headers().Authorization).toBeUndefined();
  });

  it('keeps the token when an anonymous call 401s', async () => {
    await setToken('good-token');
    fetchMock.mockResolvedValue(okJson({ error: { message: 'bad password' } }, 401));

    await expect(
      apiFetch('/api/auth/login', { method: 'POST', anonymous: true, body: {} }),
    ).rejects.toBeInstanceOf(ApiError);

    fetchMock.mockResolvedValue(okJson({}));
    await apiFetch('/api/thing');
    expect(headers().Authorization).toBe('Bearer good-token');
  });

  // Render's free tier sleeps, and the first request after that can time out
  // while it wakes. "Network error" would send people looking for a bug.
  it('describes an unreachable server as waking up', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(apiFetch('/api/thing')).rejects.toMatchObject({
      code: 'network',
      message: expect.stringMatching(/waking up/i),
    });
  });

  it('still fails cleanly when the body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>502</html>', { status: 502 }));

    await expect(apiFetch('/api/thing')).rejects.toMatchObject({ status: 502 });
  });
});
