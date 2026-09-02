import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import SignUpScreen from '../app/signup';
import { AuthProvider } from '../contexts/AuthContext';
import { apiFetch } from '../lib/api/client';

jest.mock('../lib/api/client', () => ({
  ...jest.requireActual('../lib/api/client'),
  apiFetch: jest.fn().mockRejectedValue(new Error('no session')),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

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

/**
 * Three groups offer an 'Other' pill — gender, school year, major — so the
 * label alone is ambiguous. They render in that order.
 */
const OTHER = { gender: 0, schoolYear: 1, major: 2 } as const;
const pressOther = (which: keyof typeof OTHER) =>
  fireEvent.press(screen.getAllByText('Other')[OTHER[which]]);

/** Fills every step-2 answer, leaving the caller to vary the one under test. */
function fillProfile(overrides: { skipUin?: boolean; uin?: string } = {}) {
  fireEvent.press(screen.getByText('Female'));
  fireEvent.press(screen.getByText('3rd'));
  fireEvent.press(screen.getByText('Computer Science'));
  fireEvent.changeText(screen.getByPlaceholderText('e.g. 123456789'), 'M-1');
  if (!overrides.skipUin) {
    fireEvent.changeText(screen.getByPlaceholderText('e.g. 651234567'), overrides.uin ?? '651234567');
  }
}

/** The body of the register POST, or null if it was never sent. */
function registrationBody(): Record<string, unknown> | null {
  const call = mockApiFetch.mock.calls.find(([path]) => path === '/api/auth/register');
  return call ? ((call[1] as { body: Record<string, unknown> }).body ?? null) : null;
}

beforeEach(() => {
  mockApiFetch.mockReset();
  mockApiFetch.mockRejectedValue(new Error('no session'));
});

describe('signup step 2', () => {
  it('asks for the answers the chapter collects', async () => {
    renderSignup();
    await goToStepTwo();

    expect(screen.getByText('Gender')).toBeTruthy();
    expect(screen.getByText('School year')).toBeTruthy();
    expect(screen.getByText('Major')).toBeTruthy();
    expect(screen.getByText('SHPE member ID')).toBeTruthy();
    expect(screen.getByText('UIN')).toBeTruthy();

    expect(screen.queryByText('Age')).toBeNull();
    expect(screen.queryByText('Sex at birth')).toBeNull();
    expect(screen.queryByText(/UIC member/i)).toBeNull();
  });

  it('offers the school years the form uses, not the retired class names', async () => {
    renderSignup();
    await goToStepTwo();

    expect(screen.getByText('1st')).toBeTruthy();
    expect(screen.getByText('6th')).toBeTruthy();
    expect(screen.getByText('PhD')).toBeTruthy();

    expect(screen.queryByText('Freshman')).toBeNull();
    expect(screen.queryByText('Sophomore')).toBeNull();
    expect(screen.queryByText('Senior')).toBeNull();
  });

  /** Both are nine digits, so the screen has to say which is which. */
  it('tells the two nine-digit numbers apart', async () => {
    renderSignup();
    await goToStepTwo();

    expect(screen.getByText(/Don'?t have a SHPE member ID/)).toBeTruthy();
    expect(screen.getByText(/i-card/)).toBeTruthy();
  });

  it('refuses to submit without a gender', async () => {
    renderSignup();
    await goToStepTwo();

    fireEvent.press(screen.getByText('Create account'));
    expect(screen.getByText('Select your gender.')).toBeTruthy();
  });

  it('refuses to submit without a school year', async () => {
    renderSignup();
    await goToStepTwo();

    fireEvent.press(screen.getByText('Female'));
    fireEvent.press(screen.getByText('Create account'));

    expect(screen.getByText('Select your school year.')).toBeTruthy();
  });

  it('refuses to submit without a major', async () => {
    renderSignup();
    await goToStepTwo();

    fireEvent.press(screen.getByText('Female'));
    fireEvent.press(screen.getByText('3rd'));
    fireEvent.press(screen.getByText('Create account'));

    expect(screen.getByText('Select at least one major.')).toBeTruthy();
    expect(registrationBody()).toBeNull();
  });

  describe('majors', () => {
    it('sends every major the member picked', async () => {
      renderSignup();
      await goToStepTwo();

      fillProfile();
      fireEvent.press(screen.getByText('Data Science'));
      fireEvent.press(screen.getByText('Create account'));

      await waitFor(() => expect(registrationBody()).not.toBeNull());
      expect(registrationBody()).toMatchObject({
        majors: ['Computer Science', 'Data Science'],
        schoolLevel: '3rd',
      });
    });

    it('unticks a major that is pressed twice', async () => {
      renderSignup();
      await goToStepTwo();

      fillProfile();
      fireEvent.press(screen.getByText('Data Science'));
      fireEvent.press(screen.getByText('Data Science'));
      fireEvent.press(screen.getByText('Create account'));

      await waitFor(() => expect(registrationBody()).not.toBeNull());
      expect(registrationBody()).toMatchObject({ majors: ['Computer Science'] });
    });

    /**
     * The whole reason Other is a separate control: the server drops it from
     * the array, so a feature selecting on `majors` can never match it.
     */
    it('sends an Other major in majorOther, never inside majors', async () => {
      renderSignup();
      await goToStepTwo();

      fillProfile();
      pressOther('major');
      fireEvent.changeText(screen.getByPlaceholderText('e.g. Linguistics'), 'Linguistics');
      fireEvent.press(screen.getByText('Create account'));

      await waitFor(() => expect(registrationBody()).not.toBeNull());
      const body = registrationBody()!;
      expect(body.majorOther).toBe('Linguistics');
      expect(body.majors).toEqual(['Computer Science']);
      expect(body.majors).not.toContain('Other');
    });

    it('keeps the Other field hidden until it is chosen', async () => {
      renderSignup();
      await goToStepTwo();

      expect(screen.queryByPlaceholderText('e.g. Linguistics')).toBeNull();
      pressOther('major');
      expect(screen.getByPlaceholderText('e.g. Linguistics')).toBeTruthy();
    });

    it('blocks submitting while the Other description is empty', async () => {
      renderSignup();
      await goToStepTwo();

      fillProfile();
      pressOther('major');
      fireEvent.press(screen.getByText('Create account'));

      expect(screen.getByText('Tell us your major.')).toBeTruthy();
    });

    it('clears the description when Other is unticked', async () => {
      renderSignup();
      await goToStepTwo();

      pressOther('major');
      fireEvent.changeText(screen.getByPlaceholderText('e.g. Linguistics'), 'Linguistics');
      pressOther('major');
      pressOther('major');

      expect(screen.getByPlaceholderText('e.g. Linguistics').props.value).toBe('');
    });

    it('accepts an Other major as the only answer', async () => {
      renderSignup();
      await goToStepTwo();

      fireEvent.press(screen.getByText('Female'));
      fireEvent.press(screen.getByText('3rd'));
      fireEvent.changeText(screen.getByPlaceholderText('e.g. 123456789'), 'M-1');
      fireEvent.changeText(screen.getByPlaceholderText('e.g. 651234567'), '651234567');
      pressOther('major');
      fireEvent.changeText(screen.getByPlaceholderText('e.g. Linguistics'), 'Linguistics');
      fireEvent.press(screen.getByText('Create account'));

      await waitFor(() => expect(registrationBody()).not.toBeNull());
      expect(registrationBody()).toMatchObject({ majors: [], majorOther: 'Linguistics' });
    });
  });

  describe('the school year Other field', () => {
    it('appears only when Other is chosen, and blocks an empty submit', async () => {
      renderSignup();
      await goToStepTwo();

      expect(screen.queryByPlaceholderText('e.g. Post-bacc')).toBeNull();

      fireEvent.press(screen.getByText('Female'));
      pressOther('schoolYear');
      expect(screen.getByPlaceholderText('e.g. Post-bacc')).toBeTruthy();

      fireEvent.press(screen.getByText('Create account'));
      expect(screen.getByText('Tell us your school year.')).toBeTruthy();
    });

    it('is sent alongside the level', async () => {
      renderSignup();
      await goToStepTwo();

      fillProfile();
      pressOther('schoolYear');
      fireEvent.changeText(screen.getByPlaceholderText('e.g. Post-bacc'), 'Post-bacc');
      fireEvent.press(screen.getByText('Create account'));

      await waitFor(() => expect(registrationBody()).not.toBeNull());
      expect(registrationBody()).toMatchObject({
        schoolLevel: 'Other',
        schoolLevelOther: 'Post-bacc',
      });
    });
  });

  describe('the UIN', () => {
    it('refuses anything that is not nine digits', async () => {
      renderSignup();
      await goToStepTwo();

      fillProfile({ uin: '12345' });
      fireEvent.press(screen.getByText('Create account'));

      expect(screen.getByText('Enter your 9-digit UIN.')).toBeTruthy();
      expect(registrationBody()).toBeNull();
    });

    it('is required', async () => {
      renderSignup();
      await goToStepTwo();

      fillProfile({ skipUin: true });
      fireEvent.press(screen.getByText('Create account'));

      expect(screen.getByText('Enter your 9-digit UIN.')).toBeTruthy();
    });

    it('accepts the grouped form printed on the i-card, and sends bare digits', async () => {
      renderSignup();
      await goToStepTwo();

      fillProfile({ uin: '651-234-567' });
      fireEvent.press(screen.getByText('Create account'));

      await waitFor(() => expect(registrationBody()).not.toBeNull());
      expect(registrationBody()).toMatchObject({ uin: '651234567' });
    });

    /** A taken UIN must name the UIN, not send them back to the email field. */
    it('surfaces a uin_taken answer without losing what was entered', async () => {
      const { ApiError } = jest.requireActual('../lib/api/client');
      mockApiFetch.mockRejectedValue(
        new ApiError(409, 'An account already uses that UIN', 'uin_taken'),
      );

      renderSignup();
      await goToStepTwo();

      fillProfile();
      fireEvent.press(screen.getByText('Create account'));

      await waitFor(() => expect(screen.getByText(/already uses that UIN/)).toBeTruthy());
      expect(screen.getByText('Step 2 of 2 - Profile')).toBeTruthy();
      expect(screen.getByPlaceholderText('e.g. 651234567').props.value).toBe('651234567');
    });
  });

  // 'Other' is the only gender option that needs anything more from the member.
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

      pressOther('gender');
      expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeTruthy();
    });

    it('blocks submitting while it is empty', async () => {
      renderSignup();
      await goToStepTwo();

      pressOther('gender');
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

      pressOther('gender');
      fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), 'Genderfluid');
      fireEvent.press(screen.getByText('Male'));
      pressOther('gender');

      expect(screen.getByPlaceholderText(PLACEHOLDER).props.value).toBe('');
    });
  });
});
