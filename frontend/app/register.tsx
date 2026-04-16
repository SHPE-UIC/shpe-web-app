import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { isUicEmail } from '../utils/validation';
import { SegmentedControl } from '../components/SegmentedControl';
import {
  SCHOOL_LEVEL_OPTIONS,
  SEX_AT_BIRTH_OPTIONS,
  type SchoolLevel,
  type SexAtBirth,
} from '../types/user';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [age, setAge] = useState('');
  const [sexAtBirth, setSexAtBirth] = useState<SexAtBirth | undefined>();
  const [gender, setGender] = useState('');
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel | undefined>();
  const [memberId, setMemberId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const { register } = useAuth();

  const handleRegister = async () => {
    if (
      !name ||
      !email ||
      !password ||
      !confirmPassword ||
      !age ||
      !sexAtBirth ||
      !gender ||
      !schoolLevel ||
      !memberId
    ) {
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
    } catch (error: any) {
      const code = error?.code;
      let message = 'An unexpected error occurred. Please try again.';

      if (code === 'auth/email-already-in-use') {
        message = 'An account with this email already exists.';
      } else if (code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else if (code === 'auth/weak-password') {
        message = 'Password is too weak. Use at least 6 characters.';
      }

      Alert.alert('Registration Failed', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join SHPE UIC</Text>

        <Text style={styles.sectionLabel}>Account</Text>
        <TextInput
          style={styles.input}
          placeholder="Full Name"
          placeholderTextColor="#888"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
        <TextInput
          style={styles.input}
          placeholder="Email (@uic.edu)"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          placeholderTextColor="#888"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <Text style={styles.sectionLabel}>Profile</Text>
        <TextInput
          style={styles.input}
          placeholder="Age"
          placeholderTextColor="#888"
          value={age}
          onChangeText={(t) => setAge(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          maxLength={3}
        />

        <Text style={styles.fieldLabel}>Sex assigned at birth</Text>
        <SegmentedControl
          options={SEX_AT_BIRTH_OPTIONS}
          value={sexAtBirth}
          onChange={setSexAtBirth}
        />

        <TextInput
          style={styles.input}
          placeholder="Gender"
          placeholderTextColor="#888"
          value={gender}
          onChangeText={setGender}
        />

        <Text style={styles.fieldLabel}>School level</Text>
        <SegmentedControl
          options={SCHOOL_LEVEL_OPTIONS}
          value={schoolLevel}
          onChange={setSchoolLevel}
        />

        <TextInput
          style={styles.input}
          placeholder="Member ID"
          placeholderTextColor="#888"
          value={memberId}
          onChangeText={setMemberId}
          autoCapitalize="characters"
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleRegister}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign Up</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.loginText}>
            Already have an account? <Text style={styles.loginBold}>Log In</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 28,
    marginTop: 8,
  },
  sectionLabel: {
    color: '#D50032',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 10,
  },
  fieldLabel: {
    color: '#ccc',
    fontSize: 13,
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    backgroundColor: '#3a3f47',
    color: '#fff',
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 20,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#D50032',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginLink: {
    marginTop: 24,
    alignItems: 'center',
    paddingBottom: 20,
  },
  loginText: {
    color: '#aaa',
    fontSize: 15,
  },
  loginBold: {
    color: '#D50032',
    fontWeight: '700',
  },
});
