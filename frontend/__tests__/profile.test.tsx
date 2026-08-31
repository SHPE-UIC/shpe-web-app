import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import ProfileScreen from '../app/(tabs)/profile';

// jest only lets a mock factory reach variables whose names start with "mock".
const mockRefreshUser = jest.fn();
const mockUser = {
  id: 'u1',
  email: 'ann@uic.edu',
  name: 'Ann Rivera',
  gender: 'Female',
  schoolLevel: null,
  memberId: null,
  avatarUrl: null as string | null,
  role: 0,
  roleLabel: 'Member',
  createdAt: '2026-08-30T00:00:00Z',
};

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    refreshUser: mockRefreshUser,
  }),
}));

jest.mock('../lib/api/client', () => ({
  ...jest.requireActual('../lib/api/client'),
  apiFetch: jest.fn(),
}));

const { apiFetch } = jest.requireMock('../lib/api/client') as { apiFetch: jest.Mock };
const { launchImageLibraryAsync } = jest.requireMock('expo-image-picker') as {
  launchImageLibraryAsync: jest.Mock;
};

const TICKET = {
  url: 'https://signed.example/put',
  objectPath: 'users/u1/new.jpg',
  maxBytes: 5 * 1024 * 1024,
};

/** apiFetch is shared with useMyCheckIns, so route by path. */
function routeApi(overrides: Record<string, unknown> = {}) {
  apiFetch.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/check-ins')) return { checkIns: [], totals: { events: 0, points: 0 } };
    if (path === '/api/profile/avatar/upload-url') return overrides.ticket ?? TICKET;
    if (path === '/api/profile/avatar') return { user: mockUser };
    return {};
  });
}

function mockPickedImage(size: number) {
  launchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///tmp/pic.jpg', mimeType: 'image/jpeg' }],
  });
  // The screen fetches the local uri to get a blob, then PUTs it to storage.
  global.fetch = jest.fn(async (target: unknown) =>
    String(target).startsWith('file://')
      ? ({ blob: async () => ({ size, type: 'image/jpeg' }) } as unknown as Response)
      : ({ ok: true } as Response),
  ) as unknown as typeof fetch;
}

const pressAvatar = () => fireEvent.press(screen.getByLabelText('Change your profile picture'));

beforeEach(() => {
  apiFetch.mockReset();
  mockRefreshUser.mockReset();
  launchImageLibraryAsync.mockReset();
  routeApi();
});

describe('profile picture upload', () => {
  it('does nothing when the picker is cancelled', async () => {
    launchImageLibraryAsync.mockResolvedValue({ canceled: true });
    render(<ProfileScreen />);

    pressAvatar();

    await waitFor(() => expect(launchImageLibraryAsync).toHaveBeenCalled());
    expect(apiFetch).not.toHaveBeenCalledWith('/api/profile/avatar/upload-url', expect.anything());
  });

  it('requests a ticket, uploads to storage, then adopts the object', async () => {
    mockPickedImage(1024);
    render(<ProfileScreen />);

    pressAvatar();

    await waitFor(() => expect(mockRefreshUser).toHaveBeenCalled());

    expect(apiFetch).toHaveBeenCalledWith('/api/profile/avatar/upload-url', {
      method: 'POST',
      body: { contentType: 'image/jpeg' },
    });
    // The bytes go straight to storage, never through the API.
    expect(global.fetch).toHaveBeenCalledWith(
      TICKET.url,
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(apiFetch).toHaveBeenCalledWith('/api/profile/avatar', {
      method: 'PUT',
      body: { objectPath: TICKET.objectPath },
    });
  });

  // The cap is signed into the URL so storage enforces it too; checking here
  // just turns a rejected upload into a sentence the member can act on.
  it('refuses an image over the size cap without adopting anything', async () => {
    mockPickedImage(TICKET.maxBytes + 1);
    render(<ProfileScreen />);

    pressAvatar();

    await waitFor(() => expect(screen.getByText(/too large/i)).toBeTruthy());
    expect(apiFetch).not.toHaveBeenCalledWith('/api/profile/avatar', expect.anything());
    expect(mockRefreshUser).not.toHaveBeenCalled();
  });

  it('reports a failed upload and does not adopt the object', async () => {
    mockPickedImage(1024);
    global.fetch = jest.fn(async (target: unknown) =>
      String(target).startsWith('file://')
        ? ({ blob: async () => ({ size: 1024 }) } as unknown as Response)
        : ({ ok: false } as Response),
    ) as unknown as typeof fetch;
    render(<ProfileScreen />);

    pressAvatar();

    await waitFor(() => expect(screen.getByText(/could not upload/i)).toBeTruthy());
    expect(apiFetch).not.toHaveBeenCalledWith('/api/profile/avatar', expect.anything());
    expect(mockRefreshUser).not.toHaveBeenCalled();
  });

  it('shows the member initials until a picture exists', () => {
    render(<ProfileScreen />);
    expect(screen.getByText('AR')).toBeTruthy();
  });
});
