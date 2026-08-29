import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { ComingSoon } from './ComingSoon';

/**
 * The point of this wrapper is that a control which does nothing must not look
 * like a control that works. Both halves matter: the label, and the fact that
 * the thing underneath genuinely cannot be pressed.
 */
describe('ComingSoon', () => {
  it('labels the control', () => {
    render(
      <ComingSoon>
        <Text>RSVP Now</Text>
      </ComingSoon>,
    );

    expect(screen.getByText('RSVP Now')).toBeTruthy();
    expect(screen.getByText('Coming soon')).toBeTruthy();
  });

  it('accepts a custom label', () => {
    render(
      <ComingSoon label="Not yet">
        <Text>Something</Text>
      </ComingSoon>,
    );
    expect(screen.getByText('Not yet')).toBeTruthy();
  });

  // pointerEvents="none" on the wrapper is what stops the press. A `disabled`
  // prop on the child would not, because callers pass arbitrary trees.
  it('does not let the wrapped control be pressed', () => {
    const onPress = jest.fn();
    render(
      <ComingSoon>
        <TouchableOpacity onPress={onPress}>
          <Text>Tap me</Text>
        </TouchableOpacity>
      </ComingSoon>,
    );

    fireEvent.press(screen.getByText('Tap me'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
