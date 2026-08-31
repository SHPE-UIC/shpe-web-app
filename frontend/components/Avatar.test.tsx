import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('falls back to initials when there is no picture', () => {
    render(<Avatar name="Ana María Rivera" url={null} size={40} />);

    // First and last word, so a middle name does not push out the surname.
    expect(screen.getByText('AR')).toBeTruthy();
    expect(screen.queryByTestId('avatar-image')).toBeNull();
  });

  it('uses a single initial for a one-word name', () => {
    render(<Avatar name="Prince" url={null} size={40} />);
    expect(screen.getByText('P')).toBeTruthy();
  });

  it('renders the picture when there is one', () => {
    render(<Avatar name="Ana Rivera" url="https://cdn.example/a.jpg" size={40} />);

    expect(screen.getByTestId('avatar-image')).toBeTruthy();
    expect(screen.queryByText('AR')).toBeNull();
  });

  // An empty name would otherwise render an empty circle with no clue whose
  // it is; a placeholder glyph at least reads as "a person".
  it('survives an empty name', () => {
    render(<Avatar name="   " url={null} size={40} />);
    expect(screen.getByText('?')).toBeTruthy();
  });
});
