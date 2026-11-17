import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  FormCard,
  FormError,
  FormField,
  FormGroup,
  PrimaryButton,
} from '../components/FormField';
import PageHeader from '../components/PageHeader';
import { MultiSelectControl, SegmentedControl } from '../components/SegmentedControl';
import { colors } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { ApiError, apiFetch } from '../lib/api/client';
import {
  GENDER_OPTIONS,
  MAJOR_OPTIONS,
  SCHOOL_LEVEL_OPTIONS,
  type Gender,
  type Major,
  type SchoolLevel,
} from '../lib/api/types';
import { useGoBack } from '../lib/useGoBack';
import { MAX_SELF_DESCRIPTION_LENGTH, profileAnswersError } from '../lib/validation';

// 'Other' is not one of MAJOR_OPTIONS — it fills majorOther and is never sent
// in `majors`. It only joins the list here so it renders as one more pill.
const MAJOR_PILLS = [...MAJOR_OPTIONS, 'Other'] as const;

/**
 * Lets a member correct what they entered at signup. Email, UIN, member ID and
 * role are not editable — the API ignores them — so they are only shown.
 */
export default function EditProfileScreen() {
  const { user, refreshUser } = useAuth();
  const leave = useGoBack('/profile');

  const [name, setName] = useState(user?.name ?? '');
  const [gender, setGender] = useState<Gender | undefined>(
    GENDER_OPTIONS.find((option) => option === user?.gender),
  );
  const [genderSelfDescribed, setGenderSelfDescribed] = useState(user?.genderSelfDescribed ?? '');
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel | undefined>(
    SCHOOL_LEVEL_OPTIONS.find((option) => option === user?.schoolLevel),
  );
  const [schoolLevelOther, setSchoolLevelOther] = useState(user?.schoolLevelOther ?? '');
  const [majors, setMajors] = useState<Major[]>(
    MAJOR_OPTIONS.filter((option) => user?.majors.includes(option)),
  );
  const [otherMajorChosen, setOtherMajorChosen] = useState(Boolean(user?.majorOther));
  const [majorOther, setMajorOther] = useState(user?.majorOther ?? '');

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onMajorToggle = (pill: (typeof MAJOR_PILLS)[number]) => {
    if (pill === 'Other') return setOtherMajorChosen((chosen) => !chosen);
    setMajors((current) =>
      current.includes(pill) ? current.filter((m) => m !== pill) : [...current, pill],
    );
  };

  const save = async () => {
    setError(null);

    if (!name.trim()) return setError('Enter your name.');
    const answersError = profileAnswersError({
      gender,
      genderSelfDescribed,
      schoolLevel,
      schoolLevelOther,
      majors,
      otherMajorChosen,
      majorOther,
    });
    if (answersError) return setError(answersError);

    setSaving(true);
    try {
      // The server clears each free-text value whose 'Other' is not chosen;
      // sending null as well keeps the request honest about what is on screen.
      await apiFetch('/api/profile', {
        method: 'PATCH',
        body: {
          name: name.trim(),
          gender,
          genderSelfDescribed: gender === 'Other' ? genderSelfDescribed.trim() : null,
          schoolLevel,
          schoolLevelOther: schoolLevel === 'Other' ? schoolLevelOther.trim() : null,
          majors,
          majorOther: otherMajorChosen ? majorOther.trim() : null,
        },
      });
      await refreshUser();
      leave();
    } catch (err) {
      setSaving(false);
      setError(err instanceof ApiError ? err.message : 'Could not save. Please try again.');
    }
  };

  return (
    <View style={styles.screen}>
      <PageHeader title="Edit profile" backLabel="Back" onBack={leave} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <FormError message={error} />

        <FormCard>
          <FormField
            label="Name"
            placeholder="Full name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
            editable={!saving}
          />

          <FormGroup label="Gender">
            <SegmentedControl options={GENDER_OPTIONS} value={gender} onChange={setGender} />
          </FormGroup>
          {gender === 'Other' ? (
            <FormField
              label="How you describe your gender"
              placeholder="e.g. Non-binary"
              value={genderSelfDescribed}
              onChangeText={setGenderSelfDescribed}
              maxLength={MAX_SELF_DESCRIPTION_LENGTH}
              autoCapitalize="words"
              editable={!saving}
            />
          ) : null}

          <FormGroup label="School year">
            <SegmentedControl
              options={SCHOOL_LEVEL_OPTIONS}
              value={schoolLevel}
              onChange={setSchoolLevel}
            />
          </FormGroup>
          {schoolLevel === 'Other' ? (
            <FormField
              label="Your school year"
              placeholder="e.g. Post-bacc"
              value={schoolLevelOther}
              onChangeText={setSchoolLevelOther}
              maxLength={MAX_SELF_DESCRIPTION_LENGTH}
              autoCapitalize="words"
              editable={!saving}
            />
          ) : null}

          <FormGroup label="Major">
            <MultiSelectControl
              options={MAJOR_PILLS}
              value={otherMajorChosen ? [...majors, 'Other'] : majors}
              onToggle={onMajorToggle}
            />
          </FormGroup>
          {otherMajorChosen ? (
            <FormField
              label="Your major"
              placeholder="e.g. Linguistics"
              value={majorOther}
              onChangeText={setMajorOther}
              maxLength={MAX_SELF_DESCRIPTION_LENGTH}
              autoCapitalize="words"
              editable={!saving}
            />
          ) : null}
        </FormCard>

        <FormCard>
          <FormGroup label="Email">
            <Text style={styles.readOnly}>{user?.email}</Text>
          </FormGroup>
          <FormGroup label="SHPE member ID">
            <Text style={styles.readOnly}>{user?.memberId ?? 'Not set'}</Text>
          </FormGroup>
          <FormGroup
            label="Role"
            hint="Email, UIN, member ID and role can't be changed here. Ask a board member."
          >
            <Text style={styles.readOnly}>{user?.roleLabel}</Text>
          </FormGroup>
        </FormCard>

        <PrimaryButton label="Save changes" onPress={save} loading={saving} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  readOnly: { fontSize: 14, color: colors.text },
});
