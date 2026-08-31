import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import PageHeader from '../../components/PageHeader';
import { colors, radius, shadow } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { isBoardOrAbove } from '../../lib/roles';
import { useAttendees } from '../../lib/adminStats';
import { formatDateLong, formatTimeRange } from '../../lib/events';
import { useGoBack } from '../../lib/useGoBack';

/** Who checked in to one event. Fills the reporting gap officers had before. */
export default function AttendanceScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const goBack = useGoBack('/(tabs)/dashboard');
  const isOfficer = isBoardOrAbove(user?.role);

  const { data, error, loading } = useAttendees(id ?? '', isOfficer);

  if (user && !isOfficer) {
    return (
      <View style={styles.screen}>
        <PageHeader title="Attendance" backLabel="Back" onBack={goBack} />
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={34} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Board members only</Text>
        </View>
      </View>
    );
  }

  const attendance = data?.attendance ?? [];

  return (
    <View style={styles.screen}>
      <PageHeader
        title={data?.event.name ?? 'Attendance'}
        subtitle={
          data
            ? `${attendance.length} ${attendance.length === 1 ? 'attendee' : 'attendees'}`
            : undefined
        }
        backLabel="Back"
        onBack={goBack}
      />

      {loading ? (
        <ActivityIndicator style={styles.centered} color={colors.navy} />
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={34} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Couldn&apos;t load attendance</Text>
          <Text style={styles.emptyBody}>{error.message}</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {data ? (
            <View style={styles.eventCard}>
              <Text style={styles.eventDate}>
                {formatDateLong(new Date(data.event.startsAt))}
              </Text>
              <Text style={styles.eventTime}>
                {formatTimeRange(new Date(data.event.startsAt), new Date(data.event.endsAt))}
              </Text>
              <View style={styles.chipRow}>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{data.event.tag}</Text>
                </View>
                {data.event.points > 0 ? (
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{data.event.points} pts each</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {attendance.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={30} color={colors.textFaint} />
              <Text style={styles.emptyTitle}>Nobody checked in</Text>
              <Text style={styles.emptyBody}>
                Members appear here as they scan the check-in code.
              </Text>
            </View>
          ) : (
            attendance.map((person, index) => (
              <View key={person.userId} style={styles.row}>
                <View style={styles.rank}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>
                <Avatar name={person.name} url={person.avatarUrl} size={36} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowName}>{person.name}</Text>
                  <Text style={styles.rowMeta}>
                    {[person.email, person.schoolLevel].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text style={styles.rowTime}>
                  {new Date(person.checkedInAt).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 32, gap: 10 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 30 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 28,
    alignItems: 'center',
    gap: 6,
    ...shadow.card,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 6 },
  emptyBody: { fontSize: 12.5, color: colors.textSubtle, textAlign: 'center', lineHeight: 19 },

  eventCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 16,
    gap: 4,
    marginBottom: 4,
    ...shadow.card,
  },
  eventDate: { fontSize: 14, fontWeight: '700', color: colors.navy },
  eventTime: { fontSize: 12, color: colors.textSubtle },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,112,192,0.12)',
  },
  chipText: { fontSize: 10.5, fontWeight: '700', color: colors.blue },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 13,
    ...shadow.card,
  },
  rank: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontSize: 11, fontWeight: '700', color: colors.textSubtle },
  rowBody: { flex: 1, gap: 2, marginLeft: 10 },
  rowName: { fontSize: 13.5, fontWeight: '700', color: colors.text },
  rowMeta: { fontSize: 11, color: colors.textFaint },
  rowTime: { fontSize: 11.5, fontWeight: '600', color: colors.textSubtle },
});
