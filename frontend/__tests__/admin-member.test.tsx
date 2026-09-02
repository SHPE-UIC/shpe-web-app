import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import MemberRoleScreen from '../app/admin/member';
import { ROLE } from '../lib/roles';

// jest only lets a mock factory reach variables whose names start with "mock".
const mockTarget = {
  id: 'm1',
  name: 'Ann Rivera',
  email: 'ann@uic.edu',
  schoolLevel: '3rd',
  memberId: 'M-1',
  avatarUrl: null,
  role: ROLE.MEMBER,
  roleLabel: 'Member',
  createdAt: '2026-08-30T00:00:00Z',
  eventsAttended: 0,
  pointsEarned: 0,
};

// jest only lets a mock factory reach variables whose names start with "mock".
const mockViewer = { id: 'me', role: ROLE.TOP8 as number };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'm1' }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useFocusEffect: (cb: () => void) => cb(),
}));

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockViewer, loading: false, refreshUser: jest.fn() }),
}));

jest.mock('../lib/adminStats', () => ({
  ...jest.requireActual('../lib/adminStats'),
  useMembers: () => ({ data: { members: [mockTarget] }, refresh: jest.fn() }),
}));

jest.mock('../lib/api/client', () => ({
  ...jest.requireActual('../lib/api/client'),
  apiFetch: jest.fn(),
}));

const { apiFetch } = jest.requireMock('../lib/api/client') as { apiFetch: jest.Mock };

beforeEach(() => {
  apiFetch.mockReset();
  mockViewer.role = ROLE.TOP8;
});

/**
 * The UIN is the one member field a board member may not see, so it comes from
 * its own Top 8 route rather than from the roster this screen already holds.
 */
describe('the member screen, as a Top 8', () => {
  it('fetches the UIN from its own endpoint and shows it', async () => {
    apiFetch.mockResolvedValue({ uin: '651234567' });

    render(<MemberRoleScreen />);

    await waitFor(() => expect(screen.getByText('UIN 651234567')).toBeTruthy());
    expect(apiFetch).toHaveBeenCalledWith('/api/admin/members/m1/uin');
  });

  it('shows nothing when the member has no UIN recorded', async () => {
    apiFetch.mockResolvedValue({ uin: null });

    render(<MemberRoleScreen />);

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(screen.queryByText(/UIN/)).toBeNull();
  });

  /** The screen is here to change a level; a failed lookup must not block that. */
  it('stays usable when the lookup fails', async () => {
    apiFetch.mockRejectedValue(new Error('nope'));

    render(<MemberRoleScreen />);

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(screen.queryByText(/UIN/)).toBeNull();
    expect(screen.getByText('Level')).toBeTruthy();
  });
});

describe('the member screen, as a board member', () => {
  it('asks for nothing and shows the Top 8 wall', async () => {
    mockViewer.role = ROLE.BOARD;

    render(<MemberRoleScreen />);

    expect(screen.getByText('Top 8 only')).toBeTruthy();
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
