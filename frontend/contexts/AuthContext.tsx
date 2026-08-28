import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, apiFetch } from '../lib/api/client';
import type { AuthResponse, PublicUser, RegistrationPayload } from '../lib/api/types';
import { clearToken, getToken, setToken } from '../lib/tokenStore';

type AuthContextValue = {
  user: PublicUser | null;
  /** True until the stored token has been checked. Route guards must wait. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegistrationPayload) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate on boot. A stored token is only a claim; /me is what confirms it
  // still corresponds to a real account, so a deleted or demoted member is
  // caught on next launch rather than at token expiry.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await getToken();
        if (!token) return;

        const { user: me } = await apiFetch<{ user: PublicUser }>('/api/auth/me');
        if (!cancelled) setUser(me);
      } catch (err) {
        // apiFetch already cleared the token on a 401. A network failure here
        // (Render waking up) should not wipe a session that may still be good.
        if (!(err instanceof ApiError) || err.code === 'network') return;
        await clearToken();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const adopt = useCallback(async (result: AuthResponse) => {
    await setToken(result.token);
    setUser(result.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await apiFetch<AuthResponse>('/api/auth/login', {
        method: 'POST',
        anonymous: true,
        body: { email, password },
      });
      await adopt(result);
    },
    [adopt],
  );

  const register = useCallback(
    async (payload: RegistrationPayload) => {
      const result = await apiFetch<AuthResponse>('/api/auth/register', {
        method: 'POST',
        anonymous: true,
        body: payload,
      });
      await adopt(result);
    },
    [adopt],
  );

  const logout = useCallback(async () => {
    // Tokens are stateless, so signing out is purely local: drop the token and
    // forget the user. Nothing to revoke server-side.
    await clearToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
