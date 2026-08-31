import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AuthLayout, {
  AuthError,
  AuthField,
  AuthFieldGroup,
  AuthFooter,
  AuthSubmit,
} from '../components/AuthLayout';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../lib/api/client';
import {
  GENDER_OPTIONS,
  SCHOOL_LEVEL_OPTIONS,
  type Gender,
  type SchoolLevel,
} from '../lib/api/types';
import { useGoBack } from '../lib/useGoBack';
import {
  MAX_GENDER_SELF_DESCRIPTION_LENGTH,
  MIN_PASSWORD_LENGTH,
  isUicEmail,
} from '../lib/validation';

/**
 * Two steps, one route, one account.
 *
 * Both steps collect into local state and register() fires exactly once, when
 * step 2 submits. Creating the account at step 1 instead would leave an orphaned
 * login behind whenever someone abandoned step 2 — an account with no profile
 * and no way to finish one from inside the app.
 */
export default function SignUpScreen() {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 — account
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2 — profile
  const [gender, setGender] = useState<Gender | undefined>();
  const [genderSelfDescribed, setGenderSelfDescribed] = useState('');
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel | undefined>();
  const [memberId, setMemberId] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { register } = useAuth();
  const goToLogin = useGoBack('/');

  const goToProfileStep = () => {
    setError(null);
    setEmailError(null);

    if (!name.trim()) return setError('Enter your name.');
    if (!isUicEmail(email)) {
      setEmailError('Use your @uic.edu address');
      return setError('Membership is restricted to UIC email addresses.');
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (password !== confirmPassword) return setError('The two passwords do not match.');

    setStep(2);
  };

  /**
   * A description belongs to 'Other' alone. Dropping it on the way out means a
   * member who types one and then changes their mind cannot submit a gender
   * that contradicts it — the server discards it too, but the field should not
   * sit there holding a stale answer either.
   */
  const onGenderChange = (next: Gender) => {
    setGender(next);
    if (next !== 'Other') setGenderSelfDescribed('');
  };

  const handleSubmit = async () => {
    setError(null);

    if (!gender) return setError('Select your gender.');
    if (gender === 'Other' && !genderSelfDescribed.trim()) {
      return setError('Tell us how you describe your gender.');
    }
    if (!schoolLevel) return setError('Select your school level.');
    if (!memberId.trim()) return setError('Enter your SHPE member ID.');

    setIsLoading(true);
    try {
      await register({
        email: email.trim(),
        password,
        name: name.trim(),
        gender,
        genderSelfDescribed: gender === 'Other' ? genderSelfDescribed.trim() : null,
        schoolLevel,
        memberId: memberId.trim(),
      });
      // AuthGate takes it from here.
    } catch (err) {
      setIsLoading(false);

      // The account cannot exist until this submit, so a duplicate email can
      // only surface now — five fields after it was entered. Send them back to
      // the field itself with everything else intact: one correction, not a
      // re-entry.
      if (err instanceof ApiError && err.code === 'email_taken') {
        setStep(1);
        setEmailError('An account already uses this email');
        setError('That email is already registered. Sign in instead, or use another address.');
        return;
      }

      setError(
        err instanceof ApiError ? err.message : 'Could not create your account. Try again.',
      );
    }
  };

  const onBack = step === 2 ? () => setStep(1) : goToLogin;

  return (
    <AuthLayout title={'Create\nAccount'} onBack={onBack}>
      <View style={styles.stepRow}>
        <View style={[styles.stepDot, styles.stepDotActive]} />
        <View style={[styles.stepDot, step === 2 && styles.stepDotActive]} />
        <Text style={styles.stepLabel}>
          {step === 1 ? 'Step 1 of 2 - Account' : 'Step 2 of 2 - Profile'}
        </Text>
      </View>

      <AuthError message={error} />

      {step === 1 ? (
        <>
          <AuthField
            label="Name"
            placeholder="Full name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
            editable={!isLoading}
          />
          <AuthField
            label="Email"
            placeholder="you@uic.edu"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setEmailError(null);
            }}
            error={emailError}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!isLoading}
          />
          <AuthField
            label="Password"
            placeholder="At least 8 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            editable={!isLoading}
          />
          <AuthField
            label="Confirm password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
            editable={!isLoading}
            onSubmitEditing={goToProfileStep}
          />

          <AuthSubmit label="Continue" onPress={goToProfileStep} />

          <AuthFooter
            prompt="Already have an account?"
            action="Sign in"
            onPress={goToLogin}
          />
        </>
      ) : (
        <>
          <AuthFieldGroup label="Gender">
            <SegmentedControl
              options={GENDER_OPTIONS}
              value={gender}
              onChange={onGenderChange}
            />
          </AuthFieldGroup>

          {/* Only 'Other' needs anything further, so the field is absent until
              it is chosen rather than disabled or always present. */}
          {gender === 'Other' ? (
            <AuthField
              label="How you describe your gender"
              placeholder="e.g. Non-binary"
              value={genderSelfDescribed}
              onChangeText={setGenderSelfDescribed}
              maxLength={MAX_GENDER_SELF_DESCRIPTION_LENGTH}
              autoCapitalize="words"
              editable={!isLoading}
              onSubmitEditing={handleSubmit}
            />
          ) : null}

          <AuthFieldGroup label="School level">
            <SegmentedControl
              options={SCHOOL_LEVEL_OPTIONS}
              value={schoolLevel}
              onChange={setSchoolLevel}
            />
          </AuthFieldGroup>

          <AuthField
            label="SHPE member ID"
            placeholder="e.g. 123456789"
            value={memberId}
            onChangeText={setMemberId}
            autoCapitalize="none"
            editable={!isLoading}
            onSubmitEditing={handleSubmit}
          />

          <AuthSubmit label="Create account" onPress={handleSubmit} loading={isLoading} />
        </>
      )}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 18,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  stepDotActive: {
    backgroundColor: colors.orange,
  },
  stepLabel: {
    marginLeft: 6,
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.textFaint,
  },
});
