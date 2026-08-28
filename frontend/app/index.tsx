import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import AuthLayout, {
  AuthDivider,
  AuthError,
  AuthField,
  AuthFooter,
  AuthSubmit,
  GoogleButton,
} from '../components/AuthLayout';
import { colors } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../lib/api/client';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = async () => {
    setError(null);

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      // No navigation here: AuthGate reacts to the user appearing and moves to
      // the tabs. Redirecting from both places races them against each other.
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not sign in. Please try again.',
      );
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title={'Welcome\nBack'}>
      <AuthError message={error} />

      <AuthField
        label="Email"
        placeholder="you@uic.edu"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        editable={!isLoading}
        onSubmitEditing={handleLogin}
      />

      <AuthField
        label="Password"
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        editable={!isLoading}
        onSubmitEditing={handleLogin}
      />

      <TouchableOpacity style={styles.forgotWrap}>
        <Text style={styles.forgot}>Forgot Password?</Text>
      </TouchableOpacity>

      <AuthSubmit label="Sign in" onPress={handleLogin} loading={isLoading} />

      <AuthDivider />
      <GoogleButton disabled hint="Coming soon" />

      <AuthFooter
        prompt="Don't have an account?"
        action="Sign up"
        onPress={() => router.push('/signup')}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  forgotWrap: {
    alignSelf: 'flex-end',
  },
  forgot: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.navy,
  },
});
