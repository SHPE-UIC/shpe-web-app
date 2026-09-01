import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import SignUpScreen from '../app/signup';
import { AuthProvider } from '../contexts/AuthContext';

jest.mock('../lib/api/client', () => ({
  ...jest.requireActual('../lib/api/client'),
  apiFetch: jest.fn().mockRejectedValue(new Error('no session')),
}));

const renderSignup = () =>
  render(
    <AuthProvider>
      <SignUpScreen />
    </AuthProvider>,
  );

async function goToStepTwo() {
  fireEvent.changeText(screen.getByPlaceholderText('Full name'), 'Ann');
  fireEvent.changeText(screen.getByPlaceholderText('you@uic.edu'), 'ann@uic.edu');
  fireEvent.changeText(screen.getByPlaceholderText('At least 8 characters'), 'longenough');
  fireEvent.changeText(screen.getByPlaceholderText('Re-enter your password'), 'longenough');
  fireEvent.press(screen.getByText('Continue'));
  await waitFor(() => expect(screen.getByText('Step 2 of 2 - Profile')).toBeTruthy());
}

describe('signup step 2', () => {
  it('collects gender and SHPE member ID, and never mentions age, sex at birth, or UIN', async () => {
    renderSignup();
    await goToStepTwo();

    expect(screen.getByText('Gender')).toBeTruthy();
    expect(screen.getByText('Other')).toBeTruthy();
    expect(screen.getByText('SHPE member ID')).toBeTruthy();

    expect(screen.queryByText('Age')).toBeNull();
    expect(screen.queryByText('Sex at birth')).toBeNull();
    expect(screen.queryByText(/UIC member/i)).toBeNull();
    expect(screen.queryByText(/UIN/)).toBeNull();
  });

  it('refuses to submit without a gender', async () => {
    renderSignup();
    await goToStepTwo();

    fireEvent.press(screen.getByText('Create account'));
    expect(screen.getByText('Select your gender.')).toBeTruthy();
  });

  // 'Other' is the only option that needs anything more from the member.
  describe('the self-describe field', () => {
    const PLACEHOLDER = 'e.g. Non-binary';

    it('stays hidden until Other is selected', async () => {
      renderSignup();
      await goToStepTwo();

      expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();

      fireEvent.press(screen.getByText('Female'));
      expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
    });

    it('appears when Other is selected', async () => {
      renderSignup();
      await goToStepTwo();

      fireEvent.press(screen.getByText('Other'));
      expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeTruthy();
    });

    it('blocks submitting while it is empty', async () => {
      renderSignup();
      await goToStepTwo();

      fireEvent.press(screen.getByText('Other'));
      fireEvent.changeText(screen.getByPlaceholderText('e.g. 123456789'), 'M-1');
      fireEvent.press(screen.getByText('Create account'));

      expect(screen.getByText('Tell us how you describe your gender.')).toBeTruthy();
    });

    /**
     * Otherwise a description typed under 'Other' would ride along with a
     * gender that contradicts it once the member changed their mind.
     */
    it('clears what was typed when the member picks a different gender', async () => {
      renderSignup();
      await goToStepTwo();

      fireEvent.press(screen.getByText('Other'));
      fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), 'Genderfluid');
      fireEvent.press(screen.getByText('Male'));
      fireEvent.press(screen.getByText('Other'));

      expect(screen.getByPlaceholderText(PLACEHOLDER).props.value).toBe('');
    });
  });
});
