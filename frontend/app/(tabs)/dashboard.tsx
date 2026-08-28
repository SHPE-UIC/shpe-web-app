import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import PageHeader from '../../components/PageHeader';
import { colors, radius, shadow } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminOverview, useEventAttendance } from '../../lib/adminStats';
import { formatDateLong } from '../../lib/events';

function StatTile({
  icon,
  tint,
  value,
  label,
  hint,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tint: string;
  value: string | number;
  label: string;
  hint?: string;
}) {
  return (
    <View style={styles.tile}>
      <View style={[styles.tileIcon, { backgroundColor: `${tint}22` }]}>
        <Ionicons name={icon} size={17} color={tint} />
      </View>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
      {hint ? <Text style={styles.tileHint}>{hint}</Text> : null}
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isOfficer = user?.isAdmin === true;

  const overview = useAdminOverview(isOfficer);
  const events = useEventAttendance(isOfficer);

  // The tab is hidden from members, but the route is still reachable by URL.
  // The API refuses either way; this just avoids a bare error screen.
  if (user && !isOfficer) {
    return (
      <View style={styles.screen}>
        <PageHeader title="Dashboard" />
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={34} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Officers only</Text>
          <Text style={styles.emptyBody}>This dashboard is for chapter officers.</Text>
        </View>
      </View>
    );
  }

  const stats = overview.data;
  const rows = events.data?.events ?? [];
  const busiest = Math.max(1, ...rows.map((e) => e.attendees));

  return (
    <View style={styles.screen}>
      <PageHeader title="Dashboard" subtitle="How the chapter is doing" />

      {overview.loading ? (
        <ActivityIndicator style={styles.centered} color={colors.navy} />
      ) : overview.error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={34} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Couldn&apos;t load the dashboard</Text>
          <Text style={styles.emptyBody}>{overview.error.message}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={overview.refreshing}
              onRefresh={() => {
                void overview.refresh();
                void events.refresh();
              }}
              tintColor={colors.navy}
            />
          }
        >
          <View style={styles.tileRow}>
            <StatTile
              icon="people"
              tint={colors.navy}
              value={stats?.members.total ?? 0}
              label="Members"
              hint={`${stats?.members.joinedLast30Days ?? 0} joined in 30 days`}
            />
            <StatTile
              icon="calendar-clear"
              tint={colors.orange}
              value={stats?.events.total ?? 0}
              label="Events"
              hint={`${stats?.events.upcoming ?? 0} upcoming`}
            />
          </View>

          <View style={styles.tileRow}>
            <StatTile
              icon="scan"
              tint={colors.teal}
              value={stats?.checkIns.total ?? 0}
              label="Check-ins"
              hint={`${stats?.checkIns.pointsAwarded ?? 0} points awarded`}
            />
            <StatTile
              icon="trending-up"
              tint={colors.blue}
              value={`${stats?.engagement.participationRate ?? 0}%`}
              label="Participation"
              hint={`${stats?.checkIns.uniqueAttendees ?? 0} of ${stats?.members.total ?? 0} ever attended`}
            />
          </View>

          {/* The two numbers an officer can act on this week. */}
          <View style={styles.insightCard}>
            <Text style={styles.sectionTitle}>Worth knowing</Text>

            <View style={styles.insightRow}>
              <Ionicons name="stats-chart-outline" size={17} color={colors.navy} />
              <Text style={styles.insightText}>
                {stats && stats.engagement.finishedEvents > 0 ? (
                  <>
                    Events that have finished averaged{' '}
                    <Text style={styles.insightStrong}>
                      {stats.engagement.averageAttendance}
                    </Text>{' '}
                    {stats.engagement.averageAttendance === 1 ? 'attendee' : 'attendees'}.
                  </>
                ) : (
                  'No events have finished yet, so there is no attendance average to report.'
                )}
              </Text>
            </View>

            <View style={styles.insightRow}>
              <Ionicons name="person-add-outline" size={17} color={colors.orange} />
              <Text style={styles.insightText}>
                {stats && stats.engagement.neverAttended > 0 ? (
                  <>
                    <Text style={styles.insightStrong}>{stats.engagement.neverAttended}</Text>{' '}
                    {stats.engagement.neverAttended === 1 ? 'member has' : 'members have'} never
                    checked in to anything.
                  </>
                ) : (
                  'Every member has checked in to at least one event.'
                )}
              </Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Attendance by event</Text>
            <TouchableOpacity onPress={() => router.push('/admin/members')}>
              <Text style={styles.link}>View members</Text>
            </TouchableOpacity>
          </View>

          {events.loading ? (
            <ActivityIndicator style={styles.inlineLoader} color={colors.navy} />
          ) : rows.length === 0 ? (
            <Text style={styles.emptyInline}>No events yet.</Text>
          ) : (
            rows.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={styles.eventRow}
                activeOpacity={0.85}
                onPress={() =>
                  router.push({ pathname: '/admin/attendance', params: { id: event.id } })
                }
              >
                <View style={styles.eventTop}>
                  <Text style={styles.eventName} numberOfLines={1}>
                    {event.name}
                  </Text>
                  <Text style={styles.eventCount}>{event.attendees}</Text>
                </View>

                {/* Bar is relative to the best-attended event, so the comparison
                    between events is the point rather than an absolute scale. */}
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.round((event.attendees / busiest) * 100)}%` },
                    ]}
                  />
                </View>

                <Text style={styles.eventMeta}>
                  {formatDateLong(new Date(event.startsAt))} · {event.tag}
                  {event.source === 'google_calendar' ? ' · from Calendar' : ''}
                </Text>
              </TouchableOpacity>
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
  content: { padding: 18, paddingBottom: 32, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 30 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 6 },
  emptyBody: { fontSize: 12.5, color: colors.textSubtle, textAlign: 'center', lineHeight: 19 },
  emptyInline: { fontSize: 12.5, color: colors.textSubtle, textAlign: 'center', paddingVertical: 16 },
  inlineLoader: { paddingVertical: 20 },

  tileRow: { flexDirection: 'row', gap: 12 },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 14,
    gap: 4,
    ...shadow.card,
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tileValue: { fontSize: 24, fontWeight: '800', color: colors.text },
  tileLabel: { fontSize: 12, fontWeight: '600', color: colors.textSubtle },
  tileHint: { fontSize: 10.5, color: colors.textFaint, lineHeight: 15 },

  insightCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 16,
    gap: 12,
    marginTop: 4,
    ...shadow.card,
  },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  insightText: { flex: 1, fontSize: 12.5, lineHeight: 19, color: colors.textMuted },
  insightStrong: { fontWeight: '800', color: colors.text },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  link: { fontSize: 12, fontWeight: '600', color: colors.blue },

  eventRow: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    gap: 8,
    ...shadow.card,
  },
  eventTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  eventName: { flex: 1, fontSize: 13.5, fontWeight: '700', color: colors.navy },
  eventCount: { fontSize: 15, fontWeight: '800', color: colors.orange },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.divider, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.orange },
  eventMeta: { fontSize: 11, color: colors.textFaint },
});
