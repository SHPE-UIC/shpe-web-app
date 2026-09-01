import {
  onIdTokenChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, apiFetch } from '../lib/api/client';
import type { MeResponse, PublicUser, RegistrationPayload } from '../lib/api/types';
import { auth } from '../lib/firebase';

type AuthContextValue = {
  user: PublicUser | null;
  /** True until Firebase has reported the persisted session. Route guards must wait. */
  loading: boolean;
  /**
   * Whether the signed-in member's address is verified. False while signed
   * out, and false until /me says otherwise — the API refuses every other
   * endpoint until it is true.
   */
  emailVerified: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegistrationPayload) => Promise<void>;
  logout: () => Promise<void>;
  /** Sends another verification link to the signed-in member's address. */
  resendVerification: () => Promise<void>;
  /** Re-reads verification after the member clicks the link. */
  recheckVerification: () => Promise<boolean>;
  /** Re-reads the member row — after editing the profile, for instance. */
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Firebase's own error strings name the SDK and its internal codes; members
 * get the same messages the old password endpoint used.
 */
function toLoginError(err: unknown): ApiError {
  const code = (err as { code?: string } | null)?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-email':
      // One message for both unknown email and wrong password — telling them
      // apart hands an attacker a membership oracle.
      return new ApiError(401, 'Email or password is incorrect', 'bad_credentials');
    case 'auth/user-disabled':
      return new ApiError(403, 'This account has been disabled.', 'account_disabled');
    case 'auth/too-many-requests':
      return new ApiError(429, 'Too many attempts. Wait a few minutes and try again.', 'rate_limited');
    case 'auth/network-request-failed':
      return new ApiError(0, 'Could not reach the server. Check your connection and try again.', 'network');
    default:
      return new ApiError(0, 'Could not sign in. Please try again.', code || undefined);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  // A Firebase session is only a claim; /me is what confirms it still
  // corresponds to a member row, so a deleted account is caught on next
  // launch rather than at token expiry.
  const refreshUser = useCallback(async () => {
    const me = await apiFetch<MeResponse>('/api/auth/me');
    setUser(me.user);
    setEmailVerified(me.emailVerified === true);
  }, []);

  // The SDK restores the persisted session on boot and fires this with the
  // result; it fires again on every token refresh and on sign-out.
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, (firebaseUser) => {
      void (async () => {
        try {
          if (firebaseUser) await refreshUser();
          else {
            setUser(null);
            setEmailVerified(false);
          }
        } catch (err) {
          // The account behind a live Firebase session is gone — end it.
          if (err instanceof ApiError && err.status === 401) await signOut(auth);
          // A network failure must not wipe a session that may still be good;
          // the next token refresh retries.
        } finally {
          setLoading(false);
        }
      })();
    });
    return unsubscribe;
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } catch (err) {
        throw toLoginError(err);
      }
      // Awaited here so a login that cannot load its member row surfaces on
      // the login screen instead of leaving it spinning.
      await refreshUser();
    },
    [refreshUser],
  );

  const register = useCallback(
    async (payload: RegistrationPayload) => {
      // The API creates the account (it owns the @uic.edu rule and the member
      // row); the client then signs in with the credentials it just proved.
      await apiFetch<{ user: PublicUser }>('/api/auth/register', {
        method: 'POST',
        anonymous: true,
        body: payload,
      });
      try {
        await signInWithEmailAndPassword(auth, payload.email.trim(), payload.password);
      } catch (err) {
        throw toLoginError(err);
      }

      // Swallowed on purpose. The account exists either way, and the screen
      // they land on has a resend button — failing registration over an email
      // that did not send would leave them holding an account they cannot
      // register again.
      const created = auth.currentUser;
      if (created) await sendEmailVerification(created).catch(() => {});

      await refreshUser();
    },
    [refreshUser],
  );

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
    setEmailVerified(false);
  }, []);

  const resendVerification = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) throw new ApiError(0, 'Sign in again to resend the link.', 'no_session');

    try {
      await sendEmailVerification(current);
    } catch (err) {
      const code = (err as { code?: string } | null)?.code ?? '';
      if (code === 'auth/too-many-requests') {
        throw new ApiError(
          429,
          'Too many requests. Wait a few minutes before asking for another email.',
          'rate_limited',
        );
      }
      throw new ApiError(0, 'Could not send the email. Try again.', code || undefined);
    }
  }, []);

  /**
   * Clicking the link changes the account, not the token already in memory.
   * reload() refreshes the SDK's record and getIdToken(true) re-mints the
   * token carrying the new claim; without both, a member who has just
   * verified still looks unverified to the API and the screen appears stuck.
   */
  const recheckVerification = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) return false;

    await current.reload();
    await current.getIdToken(true);
    await refreshUser();
    return current.emailVerified;
  }, [refreshUser]);

  const value = useMemo(
    () => ({
      user,
      loading,
      emailVerified,
      login,
      register,
      logout,
      refreshUser,
      resendVerification,
      recheckVerification,
    }),
    [
      user,
      loading,
      emailVerified,
      login,
      register,
      logout,
      refreshUser,
      resendVerification,
      recheckVerification,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
