import { auth } from '../firebase';
import { ApiError, apiFetch } from './client';

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const fetchMock = jest.fn();

const signedInUser = (token = 'a-token') => ({
  getIdToken: jest.fn(async () => token),
});

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  (auth as { currentUser: unknown }).currentUser = null;
});

// The *last* call, not the first: the token tests below make a second request
// to observe what the client sent after an earlier one failed.
const lastCall = () => fetchMock.mock.calls[fetchMock.mock.calls.length - 1]!;
const lastInit = () => lastCall()[1] as RequestInit;
const headers = () => lastInit().headers as Record<string, string>;

describe('request building', () => {
  it('prefixes the configured API base and returns parsed JSON', async () => {
    fetchMock.mockResolvedValue(okJson({ hello: 'world' }));

    await expect(apiFetch('/api/thing')).resolves.toEqual({ hello: 'world' });
    expect(fetchMock.mock.calls[0]![0]).toContain('/api/thing');
  });

  it("attaches the Firebase user's ID token as a bearer header", async () => {
    (auth as { currentUser: unknown }).currentUser = signedInUser('fb-id-token');
    fetchMock.mockResolvedValue(okJson({}));

    await apiFetch('/api/thing');
    expect(headers().Authorization).toBe('Bearer fb-id-token');
  });

  it('sends no bearer header when nobody is signed in', async () => {
    fetchMock.mockResolvedValue(okJson({}));

    await apiFetch('/api/thing');
    expect(headers().Authorization).toBeUndefined();
  });

  it('omits the token when the call is anonymous', async () => {
    const user = signedInUser();
    (auth as { currentUser: unknown }).currentUser = user;
    fetchMock.mockResolvedValue(okJson({}));

    await apiFetch('/api/auth/register', { method: 'POST', anonymous: true, body: { a: 1 } });
    expect(headers().Authorization).toBeUndefined();
    expect(user.getIdToken).not.toHaveBeenCalled();
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

  // The old two-host setup deployed the app before the API, and a no_route
  // 404 got a special "server is catching up" explanation. Deploys are
  // ordered now (web waits on API), so the code passes through untouched.
  it('passes a no_route 404 through like any other error', async () => {
    fetchMock.mockResolvedValue(
      okJson({ error: { message: 'That part of the app is not available on this server yet.', code: 'no_route' } }, 404),
    );

    await expect(apiFetch('/api/admin/overview')).rejects.toMatchObject({
      status: 404,
      code: 'no_route',
      message: 'That part of the app is not available on this server yet.',
    });
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

  // Session lifecycle belongs to the Firebase SDK now: the client stores
  // nothing, so a 401 must not wipe anything either. The next request simply
  // asks the SDK for a (possibly refreshed) token again.
  it('keeps asking the SDK for a token after a 401', async () => {
    (auth as { currentUser: unknown }).currentUser = signedInUser('still-valid');
    fetchMock.mockResolvedValue(
      okJson({ error: { message: 'nope', code: 'session_expired' } }, 401),
    );

    await expect(apiFetch('/api/auth/me')).rejects.toBeInstanceOf(ApiError);

    fetchMock.mockResolvedValue(okJson({}));
    await apiFetch('/api/thing');
    expect(headers().Authorization).toBe('Bearer still-valid');
  });

  it('describes an unreachable server plainly', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(apiFetch('/api/thing')).rejects.toMatchObject({
      code: 'network',
      message: expect.stringMatching(/could not reach/i),
    });
  });

  it('still fails cleanly when the body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>502</html>', { status: 502 }));

    await expect(apiFetch('/api/thing')).rejects.toMatchObject({ status: 502 });
  });
});
