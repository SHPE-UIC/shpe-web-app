import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import VerifyEmailScreen from '../app/verify-email';
import { ApiError } from '../lib/api/client';
import { useAuth } from '../contexts/AuthContext';

jest.mock('../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn(), canGoBack: () => true }),
}));

const mockedUseAuth = useAuth as unknown as jest.Mock;

const BASE = {
  user: { id: 'u1', email: 'ann@uic.edu', name: 'Ann', role: 0, roleLabel: 'Member' },
  loading: false,
  emailVerified: false,
  verificationEmailSent: true as boolean | null,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  refreshUser: jest.fn(),
  resendVerification: jest.fn(async () => {}),
  recheckVerification: jest.fn(async () => false),
};

function renderScreen(overrides: Partial<typeof BASE> = {}) {
  mockedUseAuth.mockReturnValue({ ...BASE, ...overrides });
  return render(<VerifyEmailScreen />);
}

beforeEach(() => {
  mockReplace.mockClear();
  mockedUseAuth.mockReset();
  BASE.resendVerification = jest.fn(async () => {});
  BASE.recheckVerification = jest.fn(async () => false);
});

describe('verify email screen', () => {
  it('names the address the link went to', () => {
    renderScreen();
    expect(screen.getByText('ann@uic.edu')).toBeTruthy();
  });

  /**
   * The whole point of the fix. When the automatic send failed, saying "we
   * sent a link" sends the member to wait on an email that does not exist —
   * the one thing that made this bug impossible to diagnose from the app.
   */
  it('does not claim a link was sent when the send failed', () => {
    renderScreen({ verificationEmailSent: false });

    expect(screen.queryByText(/we sent a link/i)).toBeNull();
    expect(screen.getByText(/could not send/i)).toBeTruthy();
  });

  it('still says a link is on its way when the send worked', () => {
    renderScreen({ verificationEmailSent: true });

    expect(screen.getByText(/we sent a link/i)).toBeTruthy();
    expect(screen.queryByText(/could not send/i)).toBeNull();
  });

  it('confirms a successful resend', async () => {
    renderScreen();
    fireEvent.press(screen.getByText('Resend email'));

    await waitFor(() => expect(screen.getByText(/sent\./i)).toBeTruthy());
    expect(BASE.resendVerification).toHaveBeenCalled();
  });

  it('surfaces why a resend failed rather than a generic retry', async () => {
    const resendVerification = jest.fn(async () => {
      throw new ApiError(429, 'Too many requests. Wait a few minutes.', 'rate_limited');
    });
    renderScreen({ resendVerification });

    fireEvent.press(screen.getByText('Resend email'));

    await waitFor(() =>
      expect(screen.getByText('Too many requests. Wait a few minutes.')).toBeTruthy(),
    );
  });

  it('tells a member who has not clicked the link yet to go and click it', async () => {
    renderScreen({ recheckVerification: jest.fn(async () => false) });

    fireEvent.press(screen.getByText("I've verified"));

    await waitFor(() => expect(screen.getByText(/still unverified/i)).toBeTruthy());
  });

  /** AuthGate moves them to the tabs; navigating from here too would race it. */
  it('says nothing when the re-check succeeds', async () => {
    renderScreen({ recheckVerification: jest.fn(async () => true) });

    fireEvent.press(screen.getByText("I've verified"));

    await waitFor(() => expect(screen.queryByText(/still unverified/i)).toBeNull());
  });
  /**
   * Nothing routes here automatically any more, so this is the way back for
   * anyone who reached it deliberately.
   */
  it('lets the member leave for the app', () => {
    renderScreen();

    fireEvent.press(screen.getByText('Skip for now'));

    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home');
  });
});
