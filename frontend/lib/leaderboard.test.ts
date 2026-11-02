import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useLeaderboard } from './leaderboard';

// Holds the focus callback, so a test can return to Home when it chooses.
const mockFocus: { current?: () => void } = {};
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    mockFocus.current = cb;
  },
}));

jest.mock('./api/client', () => ({
  ...jest.requireActual('./api/client'),
  apiFetch: jest.fn(),
}));

const { apiFetch } = jest.requireMock('./api/client') as { apiFetch: jest.Mock };

const BOARD = [{ rank: 1, name: 'Ana Rivera', avatarUrl: null, points: 40 }];

const focus = () =>
  act(async () => {
    mockFocus.current!();
  });

describe('useLeaderboard', () => {
  // Home refetches on every focus; one failed refetch must not blank a board
  // that already loaded.
  it('keeps the last board when a refresh fails', async () => {
    apiFetch.mockResolvedValueOnce({ leaders: BOARD });
    const { result } = renderHook(() => useLeaderboard());

    await focus();
    await waitFor(() => expect(result.current.leaders).toEqual(BOARD));

    apiFetch.mockRejectedValueOnce(new Error('offline'));
    await focus();
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.leaders).toEqual(BOARD);
    expect(result.current.loading).toBe(false);
  });

  it('has no board and stops loading when the first load fails', async () => {
    apiFetch.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useLeaderboard());

    await focus();
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.leaders).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
