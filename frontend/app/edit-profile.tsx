import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { SegmentedControl } from '../components/SegmentedControl';
import {
  SCHOOL_LEVEL_OPTIONS,
  SEX_AT_BIRTH_OPTIONS,
  type SchoolLevel,
  type SexAtBirth,
} from '../types/user';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sexAtBirth, setSexAtBirth] = useState<SexAtBirth | undefined>();
  const [gender, setGender] = useState('');
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel | undefined>();
  const [memberId, setMemberId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? '');
    setAge(profile.age != null ? String(profile.age) : '');
    setSexAtBirth(profile.sexAtBirth);
    setGender(profile.gender ?? '');
    setSchoolLevel(profile.schoolLevel);
    setMemberId(profile.memberId ?? '');
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;

    if (!name || !age || !sexAtBirth || !gender || !schoolLevel || !memberId) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    const ageNum = Number.parseInt(age, 10);
    if (!Number.isFinite(ageNum) || ageNum < 13 || ageNum > 120) {
      Alert.alert('Error', 'Please enter a valid age.');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: name.trim(),
        age: ageNum,
        sexAtBirth,
        gender: gender.trim(),
        schoolLevel,
        memberId: memberId.trim(),
      });
      router.back();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Could not update your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.fieldLabel}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor="#888"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <Text style={styles.fieldLabel}>Age</Text>
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

          <Text style={styles.fieldLabel}>Gender</Text>
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

          <Text style={styles.fieldLabel}>Member ID</Text>
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
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
  },
  header: {
    backgroundColor: '#1B2A6B',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    color: '#D50032',
    fontSize: 28,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  fieldLabel: {
    color: '#ccc',
    fontSize: 13,
    marginBottom: 6,
    marginLeft: 2,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#3a3f47',
    color: '#fff',
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 20,
    marginBottom: 10,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#D50032',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
