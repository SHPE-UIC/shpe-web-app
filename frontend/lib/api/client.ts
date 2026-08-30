import { auth } from '../firebase';

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

/** An error the API reported deliberately, carrying its status and code. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Skip the Authorization header — used by login and register. */
  anonymous?: boolean;
  signal?: AbortSignal;
};

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!BASE_URL) {
    throw new ApiError(
      0,
      'EXPO_PUBLIC_API_URL is not set. Copy frontend/example.env to frontend/.env, ' +
        'then restart with: npx expo start -c',
      'no_api_url',
    );
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  if (!options.anonymous) {
    // The SDK caches the ID token and refreshes it before expiry; asking for
    // it per request is the supported pattern, not a network round-trip.
    const token = await auth.currentUser?.getIdToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;

    throw new ApiError(
      0,
      'Could not reach the server. Check your connection and try again.',
      'network',
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const error = (payload as { error?: { message?: string; code?: string } } | null)?.error;

    // A 401 clears nothing here: the Firebase SDK owns the session and
    // refreshes tokens itself. AuthContext reacts to sign-out, not this layer.

    // The app and the API deploy separately and the app finishes first, so for
    // about a minute after a release a new screen can call an endpoint the API
    // has not picked up yet. Say that, rather than surfacing a routing error.
    if (response.status === 404 && error?.code === 'no_route') {
      throw new ApiError(
        404,
        'The app was just updated and the server is still catching up. Try again in a moment.',
        'no_route',
      );
    }

    throw new ApiError(
      response.status,
      error?.message ?? `Request failed (${response.status})`,
      error?.code,
    );
  }

  return payload as T;
}
