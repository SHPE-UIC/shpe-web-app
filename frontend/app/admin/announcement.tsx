import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import {
  DangerButton,
  FormCard,
  FormError,
  FormField,
  FormGroup,
  PrimaryButton,
} from '../../components/FormField';
import PageHeader from '../../components/PageHeader';
import { SegmentedControl } from '../../components/SegmentedControl';
import { colors } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { ApiError } from '../../lib/api/client';
import {
  createAnnouncement,
  deleteAnnouncement,
  updateAnnouncement,
} from '../../lib/admin';
import { useAnnouncements } from '../../lib/announcements';

const ACCENTS = ['Auto', 'Navy', 'Blue', 'Orange', 'Teal'] as const;
type AccentChoice = (typeof ACCENTS)[number];

const toAccentValue = (choice: AccentChoice) =>
  choice === 'Auto' ? null : choice.toLowerCase();
const toAccentChoice = (value: string | null): AccentChoice =>
  value ? ((value[0]!.toUpperCase() + value.slice(1)) as AccentChoice) : 'Auto';

/**
 * Create or edit an announcement.
 *
 * One screen for both: with no `id` it creates, with one it edits. Two nearly
 * identical routes would have to be kept in step by hand.
 */
export default function AnnouncementEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { announcements, refresh } = useAnnouncements();

  const editing = Boolean(id);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [accent, setAccent] = useState<AccentChoice>('Auto');
  const [draft, setDraft] = useState(false);
  const [loaded, setLoaded] = useState(!editing);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The list is already fetched for the feed, and announcements are few, so the
  // one being edited is taken from it rather than adding a fetch-by-id endpoint.
  useEffect(() => {
    if (!editing || loaded || !announcements) return;

    const existing = announcements.find((a) => a.id === id);
    if (!existing) {
      setError('That announcement no longer exists.');
      setLoaded(true);
      return;
    }

    setTitle(existing.title);
    setBody(existing.body);
    setAccent(toAccentChoice(existing.accent));
    setDraft(existing.publishedAt === null);
    setLoaded(true);
  }, [editing, loaded, announcements, id]);

  /** back() does nothing when this screen was opened by a direct link. */
  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/announcements');
  };

  const save = async () => {
    setError(null);

    if (!title.trim()) return setError('Give the announcement a title.');
    if (!body.trim()) return setError('Write something in the body.');

    setSaving(true);
    try {
      const input = {
        title: title.trim(),
        body: body.trim(),
        accent: toAccentValue(accent),
        draft,
      };

      if (editing && id) await updateAnnouncement(id, input);
      else await createAnnouncement(input);

      await refresh();
      leave();
    } catch (err) {
      setSaving(false);
      setError(err instanceof ApiError ? err.message : 'Could not save. Please try again.');
    }
  };

  const confirmDelete = () => {
    if (!id) return;

    const run = async () => {
      setSaving(true);
      try {
        await deleteAnnouncement(id);
        await refresh();
        leave();
      } catch (err) {
        setSaving(false);
        setError(err instanceof ApiError ? err.message : 'Could not delete. Please try again.');
      }
    };

    // Alert has no web implementation that blocks, so confirm() stands in there.
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.('Delete this announcement? This cannot be undone.')) void run();
      return;
    }

    Alert.alert('Delete announcement', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void run() },
    ]);
  };

  if (user && !user.isAdmin) {
    return (
      <View style={styles.screen}>
        <PageHeader title="Announcements" backLabel="Back" onBack={() => router.back()} />
        <View style={styles.content}>
          <FormError message="Only officers can write announcements." />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <PageHeader
        title={editing ? 'Edit announcement' : 'New announcement'}
        subtitle={draft ? 'Saved as a draft — members will not see it' : 'Visible to all members'}
        backLabel="Back"
        onBack={leave}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <FormError message={error} />

        <FormCard>
          <FormField
            label="Title"
            placeholder="General meeting this Wednesday"
            value={title}
            onChangeText={setTitle}
            editable={!saving}
          />

          <FormField
            label="Body"
            placeholder="What do members need to know?"
            value={body}
            onChangeText={setBody}
            multiline
            editable={!saving}
          />

          <FormGroup label="Accent" hint="Auto picks a colour so a run of posts is not all one shade.">
            <SegmentedControl options={ACCENTS} value={accent} onChange={setAccent} />
          </FormGroup>

          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.switchLabel}>Save as draft</Text>
              <Text style={styles.switchHint}>
                Only officers can see a draft. Turn this off to publish.
              </Text>
            </View>
            <Switch
              value={draft}
              onValueChange={setDraft}
              disabled={saving}
              trackColor={{ false: '#ccc', true: colors.orange }}
              thumbColor="#fff"
              ios_backgroundColor="#ccc"
            />
          </View>
        </FormCard>

        <PrimaryButton
          label={editing ? 'Save changes' : draft ? 'Save draft' : 'Publish'}
          onPress={save}
          loading={saving}
        />

        {editing ? <DangerButton label="Delete announcement" onPress={confirmDelete} loading={saving} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 14,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  switchText: {
    flex: 1,
    gap: 3,
  },
  switchLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.text,
  },
  switchHint: {
    fontSize: 11.5,
    color: colors.textFaint,
    lineHeight: 16,
  },
});
