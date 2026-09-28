import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { ApiError } from '../lib/api/client';
import { RsvpButton } from './RsvpButton';

jest.mock('../lib/api/client', () => ({
  ...jest.requireActual('../lib/api/client'),
  apiFetch: jest.fn(),
}));

const { apiFetch } = jest.requireMock('../lib/api/client') as { apiFetch: jest.Mock };

const DAY = 24 * 60 * 60 * 1000;
const tomorrow = () => new Date(Date.now() + DAY);
const anHourAgo = () => new Date(Date.now() - DAY / 24);

beforeEach(() => {
  apiFetch.mockReset();
});

describe('RsvpButton', () => {
  it('lets a member RSVP to an event that has not started', async () => {
    apiFetch.mockResolvedValue({ rsvp: { going: true } });
    const onChange = jest.fn();
    render(<RsvpButton eventId="e1" startsAt={tomorrow()} going={false} onChange={onChange} />);

    fireEvent.press(screen.getByRole('button', { name: 'RSVP' }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(true));
    expect(apiFetch).toHaveBeenCalledWith('/api/events/e1/rsvp', { method: 'PUT' });
  });

  it('shows a member they are going, and lets them take it back', async () => {
    apiFetch.mockResolvedValue({ rsvp: { going: false } });
    const onChange = jest.fn();
    render(<RsvpButton eventId="e1" startsAt={tomorrow()} going onChange={onChange} />);

    expect(screen.getByText("You're going")).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Cancel RSVP' }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(false));
    expect(apiFetch).toHaveBeenCalledWith('/api/events/e1/rsvp', { method: 'DELETE' });
  });

  // RSVPs are for planning; once the doors open the answer is fixed.
  it('offers nothing to press once the event has started', () => {
    render(<RsvpButton eventId="e1" startsAt={anHourAgo()} going={false} onChange={jest.fn()} />);

    expect(screen.getByText('RSVPs closed')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('still tells a member they said yes after it has started', () => {
    render(<RsvpButton eventId="e1" startsAt={anHourAgo()} going onChange={jest.fn()} />);

    expect(screen.getByText("You RSVP'd · RSVPs closed")).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('says what went wrong, and changes nothing, when the request fails', async () => {
    apiFetch.mockRejectedValue(new ApiError(0, 'Could not reach the server.', 'network'));
    const onChange = jest.fn();
    render(<RsvpButton eventId="e1" startsAt={tomorrow()} going={false} onChange={onChange} />);

    fireEvent.press(screen.getByRole('button', { name: 'RSVP' }));

    expect(await screen.findByText('Could not reach the server.')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });
});
