import { useRouter } from 'expo-router';
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
  SCHOOL_LEVEL_OPTIONS,
  SEX_AT_BIRTH_OPTIONS,
  type SchoolLevel,
  type SexAtBirth,
} from '../lib/api/types';
import { MIN_PASSWORD_LENGTH, isUicEmail } from '../utils/validation';

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
  const [age, setAge] = useState('');
  const [sexAtBirth, setSexAtBirth] = useState<SexAtBirth | undefined>();
  const [gender, setGender] = useState('');
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel | undefined>();
  const [memberId, setMemberId] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const { register } = useAuth();

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

  const handleSubmit = async () => {
    setError(null);

    const parsedAge = Number.parseInt(age, 10);
    if (!Number.isInteger(parsedAge) || parsedAge < 15 || parsedAge > 100) {
      return setError('Enter a valid age.');
    }
    if (!sexAtBirth) return setError('Select your sex at birth.');
    if (!schoolLevel) return setError('Select your school level.');
    if (!memberId.trim()) return setError('Enter your UIC member ID.');

    setIsLoading(true);
    try {
      await register({
        email: email.trim(),
        password,
        name: name.trim(),
        age: parsedAge,
        sexAtBirth,
        gender: gender.trim() || null,
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

  const onBack = step === 2 ? () => setStep(1) : () => router.back();

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
            onPress={() => router.back()}
          />
        </>
      ) : (
        <>
          <AuthField
            label="Age"
            placeholder="20"
            value={age}
            onChangeText={setAge}
            keyboardType="number-pad"
            maxLength={3}
            editable={!isLoading}
          />

          <AuthFieldGroup label="Sex at birth">
            <SegmentedControl
              options={SEX_AT_BIRTH_OPTIONS}
              value={sexAtBirth}
              onChange={setSexAtBirth}
            />
          </AuthFieldGroup>

          <AuthField
            label="Gender (optional)"
            placeholder="How you identify"
            value={gender}
            onChangeText={setGender}
            editable={!isLoading}
          />

          <AuthFieldGroup label="School level">
            <SegmentedControl
              options={SCHOOL_LEVEL_OPTIONS}
              value={schoolLevel}
              onChange={setSchoolLevel}
            />
          </AuthFieldGroup>

          <AuthField
            label="UIC member ID"
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
