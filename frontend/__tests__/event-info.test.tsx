import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import EventInfo from '../app/(tabs)/events-info/[id]';

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Ann Rivera', role: 0 } }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'e1' }),
  // Once, on arrival, the way focusing the screen does — not on every render.
  useFocusEffect: (cb: () => void) => jest.requireActual('react').useEffect(cb, [cb]),
}));

jest.mock('../lib/api/client', () => ({
  ...jest.requireActual('../lib/api/client'),
  apiFetch: jest.fn(),
}));

const { apiFetch } = jest.requireMock('../lib/api/client') as { apiFetch: jest.Mock };

const inADay = new Date(Date.now() + 24 * 60 * 60 * 1000);
const EVENT = {
  id: 'e1',
  name: 'Resume Workshop',
  description: 'Bring a printed copy.',
  location: 'ERF 1043',
  tag: 'Professional',
  points: 15,
  startsAt: inADay.toISOString(),
  endsAt: new Date(inADay.getTime() + 2 * 60 * 60 * 1000).toISOString(),
  allDay: false,
  source: 'manual',
};

describe('the event screen', () => {
  it('shows the member their own RSVP, and lets them change it', async () => {
    apiFetch.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === '/api/events/e1') return { event: EVENT, rsvp: { going: false } };
      if (path === '/api/events/e1/rsvp' && options?.method === 'PUT') return { rsvp: { going: true } };
      return {};
    });

    render(<EventInfo />);

    fireEvent.press(await screen.findByRole('button', { name: 'RSVP' }));

    await waitFor(() => expect(screen.getByText("You're going")).toBeTruthy());
    expect(screen.queryByText('Coming soon')).toBeNull();
  });

  it('starts from what the server says', async () => {
    apiFetch.mockResolvedValue({ event: EVENT, rsvp: { going: true } });

    render(<EventInfo />);

    expect(await screen.findByText("You're going")).toBeTruthy();
  });
});
