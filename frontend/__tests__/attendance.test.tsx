import { render, screen } from '@testing-library/react-native';
import React from 'react';
import AttendanceScreen from '../app/admin/attendance';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'e1' }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useFocusEffect: (cb: () => void) => jest.requireActual('react').useEffect(cb, [cb]),
}));

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', role: 1 } }),
}));

jest.mock('../lib/api/client', () => ({
  ...jest.requireActual('../lib/api/client'),
  apiFetch: jest.fn(),
}));

const { apiFetch } = jest.requireMock('../lib/api/client') as { apiFetch: jest.Mock };

const HOUR = 60 * 60 * 1000;

function respondWith(startsAt: Date) {
  apiFetch.mockResolvedValue({
    event: {
      id: 'e1',
      name: 'Welcome Social',
      tag: 'Social',
      points: 5,
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + 2 * HOUR).toISOString(),
    },
    attendance: [],
    rsvps: [
      {
        userId: 'u1',
        name: 'Ana Miembro',
        email: 'ana@uic.edu',
        avatarUrl: null,
        rsvpAt: '2026-09-18T12:00:00.000Z',
        checkedIn: true,
      },
      {
        userId: 'u2',
        name: 'Diego Ausente',
        email: 'diego@uic.edu',
        avatarUrl: null,
        rsvpAt: '2026-09-19T12:00:00.000Z',
        checkedIn: false,
      },
    ],
  });
}

beforeEach(() => apiFetch.mockReset());

describe('the attendance screen', () => {
  it("lists who RSVP'd to an upcoming event", async () => {
    respondWith(new Date(Date.now() + 24 * HOUR));
    render(<AttendanceScreen />);

    expect(await screen.findByText('RSVPs (2)')).toBeTruthy();
    expect(screen.getByText('Ana Miembro')).toBeTruthy();
    expect(screen.getByText('Diego Ausente')).toBeTruthy();
    // Nobody could have come yet, so nobody is marked either way.
    expect(screen.queryByText('No-show')).toBeNull();
  });

  // Once it is over, an RSVP means something: they came, or they did not.
  it('marks each RSVP as came or no-show once the event is over', async () => {
    respondWith(new Date(Date.now() - 48 * HOUR));
    render(<AttendanceScreen />);

    expect(await screen.findByText('Checked in')).toBeTruthy();
    expect(screen.getByText('No-show')).toBeTruthy();
  });

  it('says so when nobody has RSVPd', async () => {
    apiFetch.mockResolvedValue({
      event: {
        id: 'e1',
        name: 'Quiet Event',
        tag: 'Social',
        points: 0,
        startsAt: new Date(Date.now() + HOUR).toISOString(),
        endsAt: new Date(Date.now() + 2 * HOUR).toISOString(),
      },
      attendance: [],
      rsvps: [],
    });
    render(<AttendanceScreen />);

    expect(await screen.findByText('RSVPs (0)')).toBeTruthy();
    expect(screen.getByText('Nobody has RSVPd yet.')).toBeTruthy();
  });
});
