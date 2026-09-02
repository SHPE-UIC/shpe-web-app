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
  signOut: jest.Mock;
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
