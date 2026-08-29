import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import LoginScreen from '../app/index';
import { AuthProvider } from '../contexts/AuthContext';

jest.mock('../lib/api/client', () => ({
  ...jest.requireActual('../lib/api/client'),
  apiFetch: jest.fn(),
}));

const { apiFetch } = jest.requireMock('../lib/api/client') as { apiFetch: jest.Mock };

const renderLogin = () =>
  render(
    <AuthProvider>
      <LoginScreen />
    </AuthProvider>,
  );

beforeEach(() => {
  apiFetch.mockReset();
  // AuthProvider calls /me on mount; no stored token means no session.
  apiFetch.mockRejectedValue(new Error('no session'));
});

describe('login screen', () => {
  it('does not call the API when fields are empty', async () => {
    renderLogin();
    await waitFor(() => expect(screen.getByText('Sign in')).toBeTruthy());

    apiFetch.mockClear();
    fireEvent.press(screen.getByText('Sign in'));

    expect(screen.getByText('Enter your email and password.')).toBeTruthy();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  // Google sign-in was designed but never built. It stays visible and labelled
  // rather than silently doing nothing.
  it('shows the Google button as unavailable', async () => {
    renderLogin();
    await waitFor(() => expect(screen.getByText('Continue with Google')).toBeTruthy());
    expect(screen.getByText('Coming soon')).toBeTruthy();
  });
});
