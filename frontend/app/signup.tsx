import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import AuthLayout, {
  AuthDivider,
  AuthField,
  AuthFieldGroup,
  AuthFooter,
  AuthSubmit,
  GoogleButton,
} from '../components/AuthLayout';
import { SegmentedControl } from '../components/SegmentedControl';
import { useAuth } from '../contexts/AuthContext';
import {
  SCHOOL_LEVEL_OPTIONS,
  SEX_AT_BIRTH_OPTIONS,
  type SchoolLevel,
  type SexAtBirth,
} from '../types/user';
import { authErrorCode, registerErrorMessage } from '../utils/authErrors';
import { isUicEmail } from '../utils/validation';

export default function SignUpScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);

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

  const handleContinue = () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    if (!isUicEmail(email)) {
      Alert.alert('Error', 'Registration is restricted to @uic.edu emails.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }

    setStep(2);
  };

  const handleRegister = async () => {
    if (!age || !sexAtBirth || !gender || !schoolLevel || !memberId) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    const ageNum = Number.parseInt(age, 10);
    if (!Number.isFinite(ageNum) || ageNum < 13 || ageNum > 120) {
      Alert.alert('Error', 'Please enter a valid age.');
      return;
    }

    setIsLoading(true);
    try {
      await register(email, password, {
        name: name.trim(),
        age: ageNum,
        sexAtBirth,
        gender: gender.trim(),
        schoolLevel,
        memberId: memberId.trim(),
      });
      // AuthGate redirects once the auth state changes — don't navigate here.
    } catch (error) {
      // The account is only created here, at the end, so a duplicate email
      // can't surface on step 1 where it was typed. Send the user back with
      // their input intact rather than making them start over.
      if (authErrorCode(error) === 'auth/email-already-in-use') {
        setStep(1);
      }
      Alert.alert('Registration Failed', registerErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 2) {
    return (
      <AuthLayout title={'Your\nProfile'} onBack={() => setStep(1)}>
        <AuthField
          label="Age"
          placeholder="20"
          value={age}
          onChangeText={(t) => setAge(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          maxLength={3}
        />

        <AuthFieldGroup label="Sex assigned at birth">
          <SegmentedControl
            options={SEX_AT_BIRTH_OPTIONS}
            value={sexAtBirth}
            onChange={setSexAtBirth}
          />
        </AuthFieldGroup>

        <AuthField
          label="Gender"
          placeholder="How you identify"
          value={gender}
          onChangeText={setGender}
        />

        <AuthFieldGroup label="School level">
          <SegmentedControl
            options={SCHOOL_LEVEL_OPTIONS}
            value={schoolLevel}
            onChange={setSchoolLevel}
          />
        </AuthFieldGroup>

        <AuthField
          label="Member ID"
          placeholder="SHPE member number"
          value={memberId}
          onChangeText={setMemberId}
          autoCapitalize="characters"
        />

        <AuthSubmit
          label="Create account"
          onPress={handleRegister}
          loading={isLoading}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={'Create\nAccount'} onBack={() => router.back()}>
      <AuthField
        label="Name"
        placeholder="Full name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />

      <AuthField
        label="Email"
        placeholder="you@uic.edu"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <AuthField
        label="Password"
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <AuthField
        label="Confirm Password"
        placeholder="••••••••"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      <AuthSubmit label="Continue" onPress={handleContinue} />

      <AuthDivider />
      <GoogleButton disabled note="Coming soon" />

      <AuthFooter
        prompt="Already have an account?"
        action="Sign in"
        onPress={() => router.back()}
      />
    </AuthLayout>
  );
}
