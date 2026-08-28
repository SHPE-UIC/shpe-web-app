import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import {
  DangerButton,
  FormCard,
  FormError,
  FormField,
  FormNotice,
  FormRow,
  PrimaryButton,
} from '../../components/FormField';
import PageHeader from '../../components/PageHeader';
import { colors } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { ApiError } from '../../lib/api/client';
import type { EventInput } from '../../lib/admin';
import {
  createEvent,
  deleteEvent,
  fromDateTimeInput,
  toDateInput,
  toTimeInput,
  updateEvent,
} from '../../lib/admin';
import { useEvent } from '../../lib/events';

export default function EventEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const editing = Boolean(id);
  const { event } = useEvent(editing ? (id as string) : '');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [tag, setTag] = useState('Event');
  const [points, setPoints] = useState('0');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [loaded, setLoaded] = useState(!editing);

  /**
   * The values as loaded, so saving can send only what actually changed.
   *
   * This matters more than it looks: the API records every field present in a
   * PATCH as an admin override, and an overridden field stops tracking Google
   * Calendar for good. Posting the whole form on every save would freeze the
   * entire event after one typo fix — the whole-row lock the per-field design
   * exists to avoid.
   */
  const [initial, setInitial] = useState<EventInput | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing || loaded || !event) return;

    setName(event.name);
    setDescription(event.description);
    setLocation(event.location);
    setTag(event.tag);
    setPoints(String(event.points));
    setStartDate(toDateInput(event.startsAt.toISOString()));
    setStartTime(toTimeInput(event.startsAt.toISOString()));
    setEndDate(toDateInput(event.endsAt.toISOString()));
    setEndTime(toTimeInput(event.endsAt.toISOString()));
    setAllDay(event.allDay);

    setInitial({
      name: event.name,
      description: event.description,
      location: event.location,
      tag: event.tag,
      points: event.points,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      allDay: event.allDay,
    });
    setLoaded(true);
  }, [editing, loaded, event]);

  /** back() does nothing when this screen was opened by a direct link. */
  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/events');
  };

  const save = async () => {
    setError(null);

    if (!name.trim()) return setError('Give the event a name.');

    const startsAt = fromDateTimeInput(startDate, allDay ? '00:00' : startTime);
    const endsAt = fromDateTimeInput(endDate || startDate, allDay ? '00:00' : endTime);

    if (!startsAt) return setError('Start date must look like 2026-09-01, and time like 18:00.');
    if (!endsAt) return setError('End date must look like 2026-09-01, and time like 19:00.');
    if (new Date(endsAt) < new Date(startsAt)) {
      return setError('The event cannot end before it starts.');
    }

    const parsedPoints = Number(points);
    if (!Number.isInteger(parsedPoints) || parsedPoints < 0 || parsedPoints > 100) {
      return setError('Points must be a whole number between 0 and 100.');
    }

    setSaving(true);
    try {
      const input: EventInput = {
        name: name.trim(),
        description: description.trim(),
        location: location.trim(),
        tag: tag.trim() || 'Event',
        points: parsedPoints,
        startsAt,
        endsAt,
        allDay,
      };

      if (editing && id) {
        // Only the changed fields. Note this compares at minute precision,
        // because that is all the form offers — an event carrying seconds would
        // read as changed, which is harmless.
        const patch: Partial<EventInput> = {};
        for (const key of Object.keys(input) as (keyof EventInput)[]) {
          if (!initial || input[key] !== initial[key]) {
            Object.assign(patch, { [key]: input[key] });
          }
        }

        // The API rejects an empty patch, and there is nothing to record.
        if (Object.keys(patch).length > 0) await updateEvent(id, patch);
      } else {
        await createEvent(input);
      }

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
        await deleteEvent(id);
        router.replace('/(tabs)/events');
      } catch (err) {
        setSaving(false);
        setError(err instanceof ApiError ? err.message : 'Could not delete. Please try again.');
      }
    };

    const warning =
      event?.source === 'google_calendar'
        ? 'This event came from Google Calendar, so the next sync will bring it back. Delete it in Calendar to remove it for good.'
        : 'This cannot be undone.';

    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`Delete this event?\n\n${warning}`)) void run();
      return;
    }

    Alert.alert('Delete event', warning, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void run() },
    ]);
  };

  if (user && !user.isAdmin) {
    return (
      <View style={styles.screen}>
        <PageHeader title="Events" backLabel="Back" onBack={() => router.back()} />
        <View style={styles.content}>
          <FormError message="Only officers can create or edit events." />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <PageHeader
        title={editing ? 'Edit event' : 'New event'}
        subtitle={editing ? event?.name : 'Members will see this straight away'}
        backLabel="Back"
        onBack={leave}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <FormError message={error} />

        {/* The consequence of editing a synced event is not obvious, so it is
            stated before the fields rather than discovered afterwards. */}
        {event?.source === 'google_calendar' ? (
          <FormNotice message="This event comes from Google Calendar. Each field you change here stops tracking the calendar; everything you leave alone keeps updating on the next sync." />
        ) : null}

        <FormCard>
          <FormField
            label="Name"
            placeholder="General Meeting"
            value={name}
            onChangeText={setName}
            editable={!saving}
          />
          <FormField
            label="Description"
            placeholder="What happens at this event?"
            value={description}
            onChangeText={setDescription}
            multiline
            editable={!saving}
          />
          <FormField
            label="Location"
            placeholder="EIB 124"
            value={location}
            onChangeText={setLocation}
            editable={!saving}
          />

          <FormRow>
            <View style={styles.flex}>
              <FormField
                label="Tag"
                placeholder="GBM"
                value={tag}
                onChangeText={setTag}
                editable={!saving}
              />
            </View>
            <View style={styles.flex}>
              <FormField
                label="Points"
                placeholder="3"
                value={points}
                onChangeText={setPoints}
                keyboardType="number-pad"
                editable={!saving}
              />
            </View>
          </FormRow>
        </FormCard>

        <FormCard>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.switchLabel}>All day</Text>
              <Text style={styles.switchHint}>Times are ignored for an all-day event.</Text>
            </View>
            <Switch
              value={allDay}
              onValueChange={setAllDay}
              disabled={saving}
              trackColor={{ false: '#ccc', true: colors.orange }}
              thumbColor="#fff"
              ios_backgroundColor="#ccc"
            />
          </View>

          <FormRow>
            <View style={styles.flex}>
              <FormField
                label="Starts"
                placeholder="2026-09-01"
                hint="YYYY-MM-DD"
                value={startDate}
                onChangeText={setStartDate}
                editable={!saving}
              />
            </View>
            {!allDay ? (
              <View style={styles.flexSmall}>
                <FormField
                  label="Time"
                  placeholder="18:00"
                  hint="24h"
                  value={startTime}
                  onChangeText={setStartTime}
                  editable={!saving}
                />
              </View>
            ) : null}
          </FormRow>

          <FormRow>
            <View style={styles.flex}>
              <FormField
                label="Ends"
                placeholder="2026-09-01"
                hint="YYYY-MM-DD"
                value={endDate}
                onChangeText={setEndDate}
                editable={!saving}
              />
            </View>
            {!allDay ? (
              <View style={styles.flexSmall}>
                <FormField
                  label="Time"
                  placeholder="19:00"
                  hint="24h"
                  value={endTime}
                  onChangeText={setEndTime}
                  editable={!saving}
                />
              </View>
            ) : null}
          </FormRow>

          <Text style={styles.tzNote}>Times are in your own timezone.</Text>
        </FormCard>

        <PrimaryButton
          label={editing ? 'Save changes' : 'Create event'}
          onPress={save}
          loading={saving}
        />

        {editing ? <DangerButton label="Delete event" onPress={confirmDelete} loading={saving} /> : null}
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
  flex: {
    flex: 2,
  },
  flexSmall: {
    flex: 1,
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
  tzNote: {
    fontSize: 11.5,
    color: colors.textFaint,
  },
});
