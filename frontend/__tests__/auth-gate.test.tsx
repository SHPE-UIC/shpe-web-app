import { act, render } from '@testing-library/react-native';
import React from 'react';

/**
 * What AuthGate is allowed to do with an unverified member.
 *
 * This had no coverage, and it is where the email-verification feature went
 * wrong twice: the gate sent unverified members to the verification screen and
 * kept them there, which is a lockout whenever the mail does not arrive — and
 * mail to uic.edu does not currently arrive. See docs/EMAIL-DELIVERY.md.
 *
 * The property under test is that being unverified never costs a member access.
 */

const mockReplace = jest.fn();
const mockState: { segments: string[] } = { segments: [] };

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useSegments: () => mockState.segments,
  useLocalSearchParams: () => ({}),
  useFocusEffect: jest.fn(),
  Link: 'Link',
  Stack: Object.assign(({ children }: { children: React.ReactNode }) => children, {
    Screen: () => null,
  }),
  Tabs: { Screen: 'Tabs.Screen' },
}));

jest.mock('../lib/api/client', () => ({
  ...jest.requireActual('../lib/api/client'),
  apiFetch: jest.fn(),
}));

const { apiFetch } = jest.requireMock('../lib/api/client') as { apiFetch: jest.Mock };
const firebaseAuth = jest.requireMock('firebase/auth') as {
  __emitTokenChanged: (user: unknown) => void;
};

import RootLayout from '../app/_layout';

const ME = { id: 'u1', email: 'ann@uic.edu', name: 'Ann', role: 0, roleLabel: 'Member' };

/** Boots the app at `where` for a member whose address may or may not be verified. */
async function boot(where: string[], emailVerified: boolean) {
  mockReplace.mockClear();
  mockState.segments = where;
  apiFetch.mockResolvedValue({ user: ME, emailVerified });
  render(<RootLayout />);
  await act(async () => {
    firebaseAuth.__emitTokenChanged({ getIdToken: async () => 'token' });
  });
  return mockReplace.mock.calls.map((c) => c[0]);
}

beforeEach(() => {
  mockReplace.mockClear();
  apiFetch.mockReset();
});

describe('AuthGate and an unverified address', () => {
  /**
   * The regression that mattered. Signing in unverified used to land on the
   * verification screen with no way past it.
   */
  it('sends an unverified member straight into the app on sign-in', async () => {
    expect(await boot([''], false)).toEqual(['/(tabs)/home']);
  });

  it('sends a verified member into the app just the same', async () => {
    expect(await boot([''], true)).toEqual(['/(tabs)/home']);
  });

  /**
   * The anti-trap property: once inside, nothing drags an unverified member
   * back out. Every screen works, because the API no longer refuses them.
   */
  it('leaves an unverified member alone once they are in the tabs', async () => {
    expect(await boot(['(tabs)', 'home'], false)).toEqual([]);
  });

  it('does not strand a verified member on the verification screen', async () => {
    expect(await boot(['verify-email'], true)).toEqual(['/(tabs)/home']);
  });

  /**
   * Skipping leaves promptVerification false, so an unverified member sitting
   * on the screen is there by choice and is not bounced off it.
   */
  it('lets an unverified member stay on the verification screen if they want', async () => {
    expect(await boot(['verify-email'], false)).toEqual([]);
  });

  it('still sends a signed-out visitor to the login screen', async () => {
    // Signed in somewhere in the tabs, then signed out from under it.
    await boot(['(tabs)', 'home'], true);
    mockReplace.mockClear();

    await act(async () => {
      firebaseAuth.__emitTokenChanged(null);
    });
    await act(async () => {});

    expect(mockReplace.mock.calls.map((c) => c[0])).toContain('/');
  });
});
