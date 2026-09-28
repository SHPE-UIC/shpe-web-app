import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { SegmentedControl } from './SegmentedControl';

/**
 * A radio has to say whether it is checked. `selected` is the state for tabs
 * and list items; on a radio it is ignored, so every option was announced as
 * unchecked and the web build failed axe's aria-required-attr rule.
 */
describe('SegmentedControl', () => {
  it('marks the chosen option checked and the others not', () => {
    render(
      <SegmentedControl options={['Male', 'Female', 'Other'] as const} value="Female" onChange={() => {}} />,
    );

    const [male, female, other] = screen.getAllByRole('radio');
    expect(female).toBeChecked();
    expect(male).not.toBeChecked();
    expect(other).not.toBeChecked();
  });
});
