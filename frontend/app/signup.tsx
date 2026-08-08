import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AuthLayout, {
  AuthDivider,
  AuthField,
  AuthFooter,
  AuthSubmit,
  GoogleButton,
} from '../components/AuthLayout';

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const router = useRouter();

  // TO DO: Implement create account logic against the backend
  const handleSignUp = () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    Alert.alert('Create Account', 'Account creation is not implemented in this demo.');
  };

  return (
    <AuthLayout title={'Create\nAccount'} onBack={() => router.back()}>
      <AuthField
        label="Name"
        placeholder="Full name"
        value={name}
        onChangeText={setName}
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

      <AuthSubmit label="Sign up" onPress={handleSignUp} />

      <AuthDivider />
      <GoogleButton />

      <AuthFooter
        prompt="Already have an account?"
        action="Sign in"
        onPress={() => router.back()}
      />
    </AuthLayout>
  );
}
