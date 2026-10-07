import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import EventInfo from '../app/(tabs)/events-info/[id]';

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Ann Rivera', role: 0 } }),
}));

// jest only lets a mock factory reach variables whose names start with "mock".
const mockRoute = { id: 'e1' };
const mockFocus: { refocus?: () => void } = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useLocalSearchParams: () => mockRoute,
  // Once, on arrival, the way focusing the screen does — not on every render.
  // Kept so a test can refocus the screen, as returning to the tab does.
  useFocusEffect: (cb: () => void) => {
    mockFocus.refocus = cb;
    jest.requireActual('react').useEffect(cb, [cb]);
  },
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

  /**
   * A refetch on refocus that started before the tap must not land after it
   * and put the old answer back.
   */
  it('keeps an RSVP made while an older refetch was still in flight', async () => {
    let finishRefetch: (value: unknown) => void = () => {};
    let gets = 0;
    apiFetch.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === '/api/events/e1' && (gets += 1) === 2) {
        return new Promise((resolve) => (finishRefetch = resolve));
      }
      if (path === '/api/events/e1') return Promise.resolve({ event: EVENT, rsvp: { going: false } });
      if (options?.method === 'PUT') return Promise.resolve({ rsvp: { going: true } });
      return Promise.resolve({});
    });

    render(<EventInfo />);
    const rsvp = await screen.findByRole('button', { name: 'RSVP' });

    act(() => mockFocus.refocus?.());
    fireEvent.press(rsvp);
    await screen.findByText("You're going");

    await act(async () => finishRefetch({ event: EVENT, rsvp: { going: false } }));
    expect(screen.getByText("You're going")).toBeTruthy();
  });

  // The screen stays mounted between events, so the button must not carry one
  // event's failure over to the next.
  it("does not show one event's RSVP error on another", async () => {
    const OTHER = { ...EVENT, id: 'e2', name: 'Career Fair' };
    apiFetch.mockImplementation((path: string, options?: { method?: string }) => {
      if (options?.method === 'PUT') return Promise.reject(new Error('Could not reach the server.'));
      if (path === '/api/events/e2') return Promise.resolve({ event: OTHER, rsvp: { going: false } });
      return Promise.resolve({ event: EVENT, rsvp: { going: false } });
    });

    const { rerender } = render(<EventInfo />);
    fireEvent.press(await screen.findByRole('button', { name: 'RSVP' }));
    await screen.findByText('Could not reach the server.');

    mockRoute.id = 'e2';
    rerender(<EventInfo />);
    await screen.findByText('Career Fair');
    expect(screen.queryByText('Could not reach the server.')).toBeNull();
    mockRoute.id = 'e1';
  });

  // Until the next event arrives the screen is loading, never the last event
  // with its live RSVP button under the new one's address.
  it('shows loading, not the previous event, while the next one loads', async () => {
    let finishSecond: (value: unknown) => void = () => {};
    const OTHER = { ...EVENT, id: 'e2', name: 'Career Fair' };
    apiFetch.mockImplementation((path: string) => {
      if (path === '/api/events/e2') return new Promise((resolve) => (finishSecond = resolve));
      return Promise.resolve({ event: EVENT, rsvp: { going: true } });
    });

    const { rerender } = render(<EventInfo />);
    await screen.findByText("You're going");

    mockRoute.id = 'e2';
    rerender(<EventInfo />);
    expect(screen.queryByText('Resume Workshop')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel RSVP' })).toBeNull();

    await act(async () => finishSecond({ event: OTHER, rsvp: { going: false } }));
    expect(screen.getByText('Career Fair')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'RSVP' })).toBeTruthy();
    mockRoute.id = 'e1';
  });

  // A slow answer for an event already left must not replace the current one.
  it('drops a late response for an event the screen has left', async () => {
    let finishFirst: (value: unknown) => void = () => {};
    const OTHER = { ...EVENT, id: 'e2', name: 'Career Fair' };
    apiFetch.mockImplementation((path: string) => {
      if (path === '/api/events/e1') return new Promise((resolve) => (finishFirst = resolve));
      return Promise.resolve({ event: OTHER, rsvp: { going: false } });
    });

    const { rerender } = render(<EventInfo />);
    mockRoute.id = 'e2';
    rerender(<EventInfo />);
    await screen.findByText('Career Fair');

    await act(async () => finishFirst({ event: EVENT, rsvp: { going: true } }));
    expect(screen.getByText('Career Fair')).toBeTruthy();
    expect(screen.queryByText('Resume Workshop')).toBeNull();
    expect(screen.queryByText("You're going")).toBeNull();
    mockRoute.id = 'e1';
  });
});
