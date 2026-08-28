import { clearToken, getToken } from '../tokenStore';

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
    const token = await getToken();
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

    // Render's free tier suspends an idle instance, and the first request after
    // that can time out while it wakes. Say so, rather than "Network error".
    throw new ApiError(
      0,
      'Could not reach the server. It may be waking up — try again in a moment.',
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

    // The stored token is expired or bogus; drop it so the app stops retrying
    // with a credential that cannot work.
    if (response.status === 401 && !options.anonymous) {
      await clearToken();
    }

    throw new ApiError(
      response.status,
      error?.message ?? `Request failed (${response.status})`,
      error?.code,
    );
  }

  return payload as T;
}
