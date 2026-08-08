import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import AuthLayout, {
  AuthDivider,
  AuthField,
  AuthFooter,
  AuthSubmit,
  GoogleButton,
} from '../components/AuthLayout';
import { colors } from '../constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  //$ Fake Backend Login Function
  const handleLogin = () => {
    //$ Making Sure Both Fields Are Filled
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    //$ Loading
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false); //$ Loading is done

      //$ Check the fake password and email
      if (email === 'test' && password === 'password') {
        //$ Success Login
        Alert.alert('Success', 'Logged in successfully!');

        router.replace('/(tabs)/home'); //$ Navigate to Home Screen
      } else {
        //$ Otherwise, show error
        Alert.alert('Login Failed', 'For testing, use: test / password');
      }
    }, 1500);
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
      <GoogleButton />

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
