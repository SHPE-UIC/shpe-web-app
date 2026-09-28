import { render, screen } from '@testing-library/react-native';
import React from 'react';
import HomeScreen from '../app/(tabs)/home';

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Ann Rivera', role: 0 } }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  // Run the focus callback once, the way arriving on the tab does.
  useFocusEffect: (cb: () => void) => cb(),
}));

jest.mock('../lib/api/client', () => ({
  ...jest.requireActual('../lib/api/client'),
  apiFetch: jest.fn(),
}));

const { apiFetch } = jest.requireMock('../lib/api/client') as { apiFetch: jest.Mock };

beforeEach(() => {
  apiFetch.mockImplementation(async (path: string) => {
    if (path === '/api/leaderboard') {
      return { leaders: [{ rank: 1, name: 'Oscar Oficial', avatarUrl: null, points: 25 }] };
    }
    if (path.startsWith('/api/announcements')) return { announcements: [] };
    return {};
  });
});

describe('Home', () => {
  it('shows the leaderboard to every member', async () => {
    render(<HomeScreen />);

    expect(await screen.findByText('Leaderboard')).toBeTruthy();
    expect(await screen.findByText('Oscar Oficial')).toBeTruthy();
    expect(screen.getByText('25 pts')).toBeTruthy();
  });
});
