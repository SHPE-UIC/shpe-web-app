import { act, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { ApiError } from '../lib/api/client';
import { AuthProvider, useAuth } from './AuthContext';

jest.mock('../lib/api/client', () => ({
  ...jest.requireActual('../lib/api/client'),
  apiFetch: jest.fn(),
}));

const { apiFetch } = jest.requireMock('../lib/api/client') as { apiFetch: jest.Mock };
const firebaseAuth = jest.requireMock('firebase/auth') as {
  __emitTokenChanged: (user: unknown) => void;
  __auth: { currentUser: unknown };
  signOut: jest.Mock;
  signInWithEmailAndPassword: jest.Mock;
  sendEmailVerification: jest.Mock;
};

const ME = { id: 'u1', email: 'ann@uic.edu', name: 'Ann', role: 0, roleLabel: 'Member' };

function Probe() {
  const { user, loading, emailVerified } = useAuth();
  return (
    <>
      <Text>{loading ? 'loading' : (user?.email ?? 'signed-out')}</Text>
      <Text>{emailVerified ? 'verified' : 'unverified'}</Text>
    </>
  );
}

const renderAuth = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

beforeEach(() => {
  apiFetch.mockReset();
  firebaseAuth.signOut.mockClear();
  firebaseAuth.__emitTokenChanged(null);
});

describe('AuthProvider', () => {
  it('settles to signed-out when Firebase reports nobody', async () => {
    renderAuth();
    await waitFor(() => expect(screen.getByText('signed-out')).toBeTruthy());
    expect(apiFetch).not.toHaveBeenCalled();
  });

  // A Firebase session is only a claim; /me is what confirms a member row
  // still backs it.
  it('confirms a Firebase session against /me', async () => {
    apiFetch.mockResolvedValue({ user: ME, emailVerified: true });
    renderAuth();

    firebaseAuth.__emitTokenChanged({ getIdToken: async () => 'token' });

    await waitFor(() => expect(screen.getByText('ann@uic.edu')).toBeTruthy());
    expect(apiFetch).toHaveBeenCalledWith('/api/auth/me');
  });

  // The account behind a live Firebase session is gone — ending the session is
  // the only correct response, otherwise the app retries forever.
  it('signs out when the member row no longer exists', async () => {
    apiFetch.mockRejectedValue(new ApiError(401, 'gone', 'user_gone'));
    renderAuth();

    firebaseAuth.__emitTokenChanged({ getIdToken: async () => 'token' });

    await waitFor(() => expect(firebaseAuth.signOut).toHaveBeenCalled());
  });

  /**
   * Deliberate non-behavior. A member on a bad connection must not be signed
   * out of an otherwise valid session — the next token refresh retries.
   */
  it('keeps the session when /me fails on the network', async () => {
    apiFetch.mockRejectedValue(new ApiError(0, 'offline', 'network'));
    renderAuth();

    firebaseAuth.__emitTokenChanged({ getIdToken: async () => 'token' });

    await waitFor(() => expect(screen.getByText('signed-out')).toBeTruthy());
    expect(firebaseAuth.signOut).not.toHaveBeenCalled();
  });

  it('stops loading even when the confirmation fails', async () => {
    apiFetch.mockRejectedValue(new ApiError(0, 'offline', 'network'));
    renderAuth();

    firebaseAuth.__emitTokenChanged({ getIdToken: async () => 'token' });

    await waitFor(() => expect(screen.queryByText('loading')).toBeNull());
  });
});

describe('email verification state', () => {
  /**
   * The flag decides which half of the app renders, so it has to come from
   * /me — the API's own reading of the token — rather than from whatever the
   * client happens to believe about its Firebase user.
   */
  it('reports an unverified address from /me', async () => {
    apiFetch.mockResolvedValue({ user: ME, emailVerified: false });
    renderAuth();

    firebaseAuth.__emitTokenChanged({ getIdToken: async () => 'token' });

    await waitFor(() => expect(screen.getByText('ann@uic.edu')).toBeTruthy());
    expect(screen.getByText('unverified')).toBeTruthy();
  });

  it('reports a verified address from /me', async () => {
    apiFetch.mockResolvedValue({ user: ME, emailVerified: true });
    renderAuth();

    firebaseAuth.__emitTokenChanged({ getIdToken: async () => 'token' });

    await waitFor(() => expect(screen.getByText('verified')).toBeTruthy());
  });

  it('drops back to unverified when the session ends', async () => {
    apiFetch.mockResolvedValue({ user: ME, emailVerified: true });
    renderAuth();

    firebaseAuth.__emitTokenChanged({ getIdToken: async () => 'token' });
    await waitFor(() => expect(screen.getByText('verified')).toBeTruthy());

    // Signing out clears state without an awaited call in between, so nothing
    // else flushes it — this one emit has to be acted on explicitly.
    await act(async () => {
      firebaseAuth.__emitTokenChanged(null);
    });

    expect(screen.getByText('unverified')).toBeTruthy();
  });
});

/**
 * Whether the link actually went out.
 *
 * Registration must not fail because the email did not send — the account
 * exists by then, and the address cannot be registered a second time. But the
 * failure has to be *recorded*, because the verify screen otherwise states as
 * fact that a link is on its way and nobody can tell that it never left.
 */
describe('the verification email attempt', () => {
  const PAYLOAD = {
    email: 'ann@uic.edu',
    password: 'longenough',
    name: 'Ann',
    gender: 'Female' as const,
    schoolLevel: 'Junior' as const,
    majors: ['Computer Science' as const],
    uin: '123456789',
  };

  let context: ReturnType<typeof useAuth>;
  function Capture() {
    context = useAuth();
    return <Text>{String(context.verificationEmailSent)}</Text>;
  }

  const renderCapture = () =>
    render(
      <AuthProvider>
        <Capture />
      </AuthProvider>,
    );

  beforeEach(() => {
    firebaseAuth.signInWithEmailAndPassword.mockReset();
    firebaseAuth.sendEmailVerification.mockReset().mockResolvedValue(undefined);
    apiFetch.mockResolvedValue({ user: ME, emailVerified: false });
  });

  /** Nothing has been attempted yet — not the same answer as "it failed". */
  it('starts out unknown', async () => {
    renderCapture();
    await waitFor(() => expect(screen.getByText('null')).toBeTruthy());
  });

  it('records the send when registration gets the link out', async () => {
    const created = { getIdToken: async () => 'token' };
    firebaseAuth.signInWithEmailAndPassword.mockImplementation(async () => {
      firebaseAuth.__auth.currentUser = created;
      return { user: created };
    });

    renderCapture();
    await act(async () => {
      await context.register(PAYLOAD);
    });

    expect(firebaseAuth.sendEmailVerification).toHaveBeenCalledWith(created);
    expect(context.verificationEmailSent).toBe(true);
  });

  it('records the failure — and still completes the registration', async () => {
    const created = { getIdToken: async () => 'token' };
    firebaseAuth.signInWithEmailAndPassword.mockImplementation(async () => {
      firebaseAuth.__auth.currentUser = created;
      return { user: created };
    });
    firebaseAuth.sendEmailVerification.mockRejectedValue(
      Object.assign(new Error('nope'), { code: 'auth/too-many-requests' }),
    );

    renderCapture();
    await act(async () => {
      // Resolves: the account exists, so throwing here would strand them.
      await context.register(PAYLOAD);
    });

    expect(context.verificationEmailSent).toBe(false);
  });

  /**
   * The old `if (created)` guard skipped the send silently when the SDK had no
   * user yet. Silence is the bug — nothing distinguished it from a send.
   */
  it('records a failure when there is no Firebase user to send to', async () => {
    firebaseAuth.signInWithEmailAndPassword.mockResolvedValue({ user: null });

    renderCapture();
    await act(async () => {
      await context.register(PAYLOAD);
    });

    expect(firebaseAuth.sendEmailVerification).not.toHaveBeenCalled();
    expect(context.verificationEmailSent).toBe(false);
  });

  it('clears the failure once a resend gets through', async () => {
    const created = { getIdToken: async () => 'token' };
    firebaseAuth.signInWithEmailAndPassword.mockImplementation(async () => {
      firebaseAuth.__auth.currentUser = created;
      return { user: created };
    });
    firebaseAuth.sendEmailVerification.mockRejectedValueOnce(new Error('nope'));

    renderCapture();
    await act(async () => {
      await context.register(PAYLOAD);
    });
    expect(context.verificationEmailSent).toBe(false);

    await act(async () => {
      await context.resendVerification();
    });
    expect(context.verificationEmailSent).toBe(true);
  });

  it('maps a throttled resend to a message a member can act on', async () => {
    firebaseAuth.__auth.currentUser = { getIdToken: async () => 'token' };
    firebaseAuth.sendEmailVerification.mockRejectedValue(
      Object.assign(new Error('Firebase: Error (auth/too-many-requests).'), {
        code: 'auth/too-many-requests',
      }),
    );

    renderCapture();
    await expect(
      act(async () => {
        await context.resendVerification();
      }),
    ).rejects.toMatchObject({ status: 429, code: 'rate_limited' });
  });

  /**
   * The claim is baked into the token the app already holds, so clicking the
   * link changes nothing the app can see until a new one is minted. Both calls
   * are load-bearing: without them the screen looks stuck.
   */
  it('forces a fresh token when re-checking', async () => {
    const current = {
      emailVerified: false,
      reload: jest.fn(async function (this: { emailVerified: boolean }) {
        this.emailVerified = true;
      }),
      getIdToken: jest.fn(async () => 'token'),
    };
    firebaseAuth.__auth.currentUser = current;
    apiFetch.mockResolvedValue({ user: ME, emailVerified: true });

    renderCapture();
    let verified: boolean | undefined;
    await act(async () => {
      verified = await context.recheckVerification();
    });

    expect(current.reload).toHaveBeenCalled();
    expect(current.getIdToken).toHaveBeenCalledWith(true);
    expect(verified).toBe(true);
  });
});
