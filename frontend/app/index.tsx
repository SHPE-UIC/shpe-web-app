import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import AuthLayout, {
  AuthDivider,
  AuthField,
  AuthFooter,
  AuthSubmit,
  GoogleButton,
} from '../components/AuthLayout';
import { colors } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { loginErrorMessage } from '../utils/authErrors';
import { isUicEmail } from '../utils/validation';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!isUicEmail(email)) {
      Alert.alert('Error', 'Please use your @uic.edu email to sign in.');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      // AuthGate redirects once the auth state changes — don't navigate here.
    } catch (error) {
      Alert.alert('Login Failed', loginErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title={'Welcome\nBack'}>
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

      <TouchableOpacity style={styles.forgotWrap}>
        <Text style={styles.forgot}>Forgot Password?</Text>
      </TouchableOpacity>

      <AuthSubmit label="Sign in" onPress={handleLogin} loading={isLoading} />

      <AuthDivider />
      <GoogleButton disabled note="Coming soon" />

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
