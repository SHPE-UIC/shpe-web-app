import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import LoginScreen from '../app/index';
import { AuthProvider } from '../contexts/AuthContext';

jest.mock('../lib/api/client', () => ({
  ...jest.requireActual('../lib/api/client'),
  apiFetch: jest.fn(),
}));

const { apiFetch } = jest.requireMock('../lib/api/client') as { apiFetch: jest.Mock };
const { signInWithEmailAndPassword } = jest.requireMock('firebase/auth') as {
  signInWithEmailAndPassword: jest.Mock;
};

const ME = {
  user: { id: 'u1', email: 'ann@uic.edu', name: 'Ann', role: 0, roleLabel: 'Member' },
};

const renderLogin = () =>
  render(
    <AuthProvider>
      <LoginScreen />
    </AuthProvider>,
  );

beforeEach(() => {
  apiFetch.mockReset();
  signInWithEmailAndPassword.mockReset();
  apiFetch.mockResolvedValue(ME);
});

describe('login screen', () => {
  it('does not touch Firebase when fields are empty', async () => {
    renderLogin();
    await waitFor(() => expect(screen.getByText('Sign in')).toBeTruthy());

    fireEvent.press(screen.getByText('Sign in'));

    expect(screen.getByText('Enter your email and password.')).toBeTruthy();
    expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('signs in through Firebase, then loads the member from /me', async () => {
    signInWithEmailAndPassword.mockResolvedValue({ user: {} });

    renderLogin();
    await waitFor(() => expect(screen.getByText('Sign in')).toBeTruthy());

    fireEvent.changeText(screen.getByPlaceholderText('you@uic.edu'), 'ann@uic.edu');
    fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'longenough');
    fireEvent.press(screen.getByText('Sign in'));

    await waitFor(() =>
      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'ann@uic.edu',
        'longenough',
      ),
    );
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/auth/me'));
  });

  it('shows a friendly message for bad credentials, not Firebase internals', async () => {
    signInWithEmailAndPassword.mockRejectedValue(
      Object.assign(new Error('Firebase: Error (auth/invalid-credential).'), {
        code: 'auth/invalid-credential',
      }),
    );

    renderLogin();
    await waitFor(() => expect(screen.getByText('Sign in')).toBeTruthy());

    fireEvent.changeText(screen.getByPlaceholderText('you@uic.edu'), 'ann@uic.edu');
    fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'wrong-password');
    fireEvent.press(screen.getByText('Sign in'));

    await waitFor(() => expect(screen.getByText('Email or password is incorrect')).toBeTruthy());
    expect(screen.queryByText(/firebase/i)).toBeNull();
  });

  // Google sign-in was designed but never built. It stays visible and labelled
  // rather than silently doing nothing.
  it('shows the Google button as unavailable', async () => {
    renderLogin();
    await waitFor(() => expect(screen.getByText('Continue with Google')).toBeTruthy());
    expect(screen.getByText('Coming soon')).toBeTruthy();
  });
});
