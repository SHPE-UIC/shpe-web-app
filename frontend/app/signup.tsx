import React, { useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AuthLayout, {
  AuthError,
  AuthField,
  AuthFieldGroup,
  AuthFooter,
  AuthSubmit,
} from '../components/AuthLayout';
import { MultiSelectControl, SegmentedControl } from '../components/SegmentedControl';
import { colors, radius } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../lib/api/client';
import {
  GENDER_OPTIONS,
  MAJOR_OPTIONS,
  SCHOOL_LEVEL_OPTIONS,
  type Gender,
  type Major,
  type SchoolLevel,
} from '../lib/api/types';
import { useGoBack } from '../lib/useGoBack';
import {
  MAX_SELF_DESCRIPTION_LENGTH,
  MIN_PASSWORD_LENGTH,
  isUicEmail,
  isValidUin,
  normaliseUin,
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
  const [schoolLevelOther, setSchoolLevelOther] = useState('');
  const [majors, setMajors] = useState<Major[]>([]);
  // Tracked apart from `majors` because 'Other' is not one of MAJOR_OPTIONS —
  // the server drops it, so it must never be a member of that array.
  const [otherMajorChosen, setOtherMajorChosen] = useState(false);
  const [majorOther, setMajorOther] = useState('');
  const [memberId, setMemberId] = useState('');
  const [uin, setUin] = useState('');

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

  /** Same rule for the school year, and for the same reason. */
  const onSchoolLevelChange = (next: SchoolLevel) => {
    setSchoolLevel(next);
    if (next !== 'Other') setSchoolLevelOther('');
  };

  const onMajorToggle = (major: Major) => {
    setMajors((current) =>
      current.includes(major) ? current.filter((m) => m !== major) : [...current, major],
    );
  };

  const onOtherMajorToggle = () => {
    setOtherMajorChosen((chosen) => {
      if (chosen) setMajorOther('');
      return !chosen;
    });
  };

  const handleSubmit = async () => {
    setError(null);

    if (!gender) return setError('Select your gender.');
    if (gender === 'Other' && !genderSelfDescribed.trim()) {
      return setError('Tell us how you describe your gender.');
    }
    if (!schoolLevel) return setError('Select your school year.');
    if (schoolLevel === 'Other' && !schoolLevelOther.trim()) {
      return setError('Tell us your school year.');
    }
    if (majors.length === 0 && !(otherMajorChosen && majorOther.trim())) {
      return setError('Select at least one major.');
    }
    if (otherMajorChosen && !majorOther.trim()) return setError('Tell us your major.');
    if (!memberId.trim()) return setError('Enter your SHPE member ID.');
    if (!isValidUin(uin)) return setError('Enter your 9-digit UIN.');

    setIsLoading(true);
    try {
      await register({
        email: email.trim(),
        password,
        name: name.trim(),
        gender,
        genderSelfDescribed: gender === 'Other' ? genderSelfDescribed.trim() : null,
        schoolLevel,
        schoolLevelOther: schoolLevel === 'Other' ? schoolLevelOther.trim() : null,
        majors,
        majorOther: otherMajorChosen ? majorOther.trim() : null,
        memberId: memberId.trim(),
        uin: normaliseUin(uin),
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
              maxLength={MAX_SELF_DESCRIPTION_LENGTH}
              autoCapitalize="words"
              editable={!isLoading}
              onSubmitEditing={handleSubmit}
            />
          ) : null}

          <AuthFieldGroup label="School year">
            <SegmentedControl
              options={SCHOOL_LEVEL_OPTIONS}
              value={schoolLevel}
              onChange={onSchoolLevelChange}
            />
          </AuthFieldGroup>

          {schoolLevel === 'Other' ? (
            <AuthField
              label="Your school year"
              placeholder="e.g. Post-bacc"
              value={schoolLevelOther}
              onChangeText={setSchoolLevelOther}
              maxLength={MAX_SELF_DESCRIPTION_LENGTH}
              autoCapitalize="words"
              editable={!isLoading}
              onSubmitEditing={handleSubmit}
            />
          ) : null}

          <AuthFieldGroup label="Major">
            <MultiSelectControl
              options={MAJOR_OPTIONS}
              value={majors}
              onToggle={onMajorToggle}
            />
            {/* Its own control, because 'Other' is not one of MAJOR_OPTIONS —
                it fills majorOther and never joins the list above. */}
            <TouchableOpacity
              onPress={onOtherMajorToggle}
              style={[styles.otherPill, otherMajorChosen && styles.otherPillSelected]}
              activeOpacity={0.8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: otherMajorChosen }}
            >
              <Text style={[styles.otherLabel, otherMajorChosen && styles.otherLabelSelected]}>
                Other
              </Text>
            </TouchableOpacity>
          </AuthFieldGroup>

          {otherMajorChosen ? (
            <AuthField
              label="Your major"
              placeholder="e.g. Linguistics"
              value={majorOther}
              onChangeText={setMajorOther}
              maxLength={MAX_SELF_DESCRIPTION_LENGTH}
              autoCapitalize="words"
              editable={!isLoading}
              onSubmitEditing={handleSubmit}
            />
          ) : null}

          <AuthField
            label="SHPE member ID"
            placeholder="e.g. 123456789"
            value={memberId}
            onChangeText={setMemberId}
            autoCapitalize="none"
            editable={!isLoading}
            onSubmitEditing={handleSubmit}
          />

          <TouchableOpacity onPress={() => Linking.openURL('https://www.shpeconnect.org/eweb')}>
            <Text style={styles.membershipLink}>
              Don&apos;t have a SHPE member ID? Join SHPE
            </Text>
          </TouchableOpacity>

          {/* Both numbers are nine digits, so the label has to say which is
              which — the i-card is what tells them apart. */}
          <AuthField
            label="UIN"
            placeholder="e.g. 651234567"
            value={uin}
            onChangeText={setUin}
            keyboardType="number-pad"
            autoCapitalize="none"
            editable={!isLoading}
            onSubmitEditing={handleSubmit}
          />
          <Text style={styles.fieldHint}>
            The 9-digit university number on your UIC i-card.
          </Text>

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
  membershipLink: {
    marginTop: 8,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: '600',
    color: colors.orange,
    textAlign: 'center',
  },
  fieldHint: {
    marginTop: -4,
    fontSize: 11.5,
    color: colors.textFaint,
  },
  // Matches the pills in SegmentedControl, sized to sit beside them.
  otherPill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  otherPillSelected: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  otherLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSubtle,
  },
  otherLabelSelected: {
    color: colors.surface,
  },
});
