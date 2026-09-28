import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Leaderboard, ordinal } from './Leaderboard';

const LEADERS = [
  { rank: 1, name: 'Ana Rivera', avatarUrl: 'https://example.test/ana.jpg', points: 40 },
  { rank: 2, name: 'Ben Ortiz', avatarUrl: null, points: 30 },
  { rank: 2, name: 'Cy Lopez', avatarUrl: null, points: 30 },
];

describe('ordinal', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [21, '21st'],
  ])('%i → %s', (n, expected) => {
    expect(ordinal(n)).toBe(expected);
  });
});

describe('Leaderboard', () => {
  it('lists each leader with their rank and points', () => {
    render(<Leaderboard leaders={LEADERS} loading={false} error={null} />);

    expect(screen.getByText('Ana Rivera')).toBeTruthy();
    expect(screen.getByText('40 pts')).toBeTruthy();
    expect(screen.getAllByText('30 pts')).toHaveLength(2);
    // A tie shows the shared place twice rather than inventing a 3rd.
    expect(screen.getAllByText('2')).toHaveLength(2);
  });

  // Read as one sentence per row, not as five unrelated fragments.
  it('announces each row as a single place', () => {
    render(<Leaderboard leaders={LEADERS} loading={false} error={null} />);
    expect(screen.getByLabelText('1st place, Ana Rivera, 40 points')).toBeTruthy();
    expect(screen.getByLabelText('2nd place, Cy Lopez, 30 points')).toBeTruthy();
  });

  it("falls back to initials for someone with no picture", () => {
    render(<Leaderboard leaders={LEADERS} loading={false} error={null} />);
    expect(screen.getByText('BO')).toBeTruthy();
  });

  /**
   * Name and picture are all a member gets to see of anyone else. Nothing on
   * the board opens a profile — not a row, not a picture.
   */
  it('has nothing to press', () => {
    render(<Leaderboard leaders={LEADERS} loading={false} error={null} />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('invites a first check-in when nobody has points', () => {
    render(<Leaderboard leaders={[]} loading={false} error={null} />);
    expect(screen.getByText('No points yet — check in at an event to get on the board.')).toBeTruthy();
  });

  it('shows a spinner while loading', () => {
    render(<Leaderboard leaders={null} loading error={null} />);
    expect(screen.getByTestId('leaderboard-loading')).toBeTruthy();
  });

  it('says so when the board cannot load', () => {
    render(<Leaderboard leaders={null} loading={false} error={new Error('offline')} />);
    expect(screen.getByText("Couldn't load the leaderboard.")).toBeTruthy();
  });
});
