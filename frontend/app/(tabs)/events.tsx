// app/event-page.tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../contexts/AuthContext';
import { colors, radius, shadow } from '../../constants/theme';
import {
  accentForTag,
  formatDay,
  formatMonth,
  formatTimeRange,
  useUpcomingEvents,
} from '../../lib/events';

const ALL = 'All';

export default function EventPage() {
  const router = useRouter();
  const { events, error, loading, refreshing, refresh } = useUpcomingEvents();
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<string>(ALL);

  // Chips come from whatever tags the API actually returns, so a new tag on an
  // event shows up as a filter without a code change.
  const filters = useMemo(
    () => [ALL, ...Array.from(new Set((events ?? []).map((e) => e.tag)))],
    [events],
  );

  const visibleEvents = (events ?? []).filter(
    (e) => activeFilter === ALL || e.tag === activeFilter,
  );

  return (
    <View style={styles.container}>
      <PageHeader
        title="Upcoming Events"
        subtitle={
          loading
            ? 'Loading events…'
            : `${events?.length ?? 0} upcoming ${events?.length === 1 ? 'event' : 'events'}`
        }
        right={
          user?.isAdmin ? (
            <TouchableOpacity
              style={styles.newButton}
              onPress={() => router.push('/admin/event')}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          ) : undefined
        }
      >
        <View style={styles.chipRow}>
          {filters.map((filter) => {
            const active = filter === activeFilter;
            return (
              <TouchableOpacity
                key={filter}
                onPress={() => setActiveFilter(filter)}
                style={[styles.chip, active && styles.chipActive]}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{filter}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </PageHeader>

      {loading ? (
        <ActivityIndicator style={styles.centered} color={colors.navy} />
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Couldn&apos;t load events</Text>
          <Text style={styles.emptyBody}>{error.message}</Text>
        </View>
      ) : visibleEvents.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="calendar-outline" size={34} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>No upcoming events</Text>
          <Text style={styles.emptyBody}>Check back soon for new events.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.eventList}
          // Firestore's live updates are gone, so pull-to-refresh is how a
          // member forces a re-read without leaving and re-entering the screen.
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.navy} />
          }
        >
          {visibleEvents.map((event) => (
            <TouchableOpacity
              key={event.id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => router.push({
                pathname: '/(tabs)/events-info/[id]',
                params: { id: event.id },
              })}
            >
              {/* Date badge */}
              <View style={[styles.dateBadge, { backgroundColor: accentForTag(event.tag) }]}>
                <Text style={styles.dateMonth}>{formatMonth(event.startsAt)}</Text>
                <Text style={styles.dateDay}>{formatDay(event.startsAt)}</Text>
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.title}>{event.name}</Text>
                <Text style={styles.meta}>
                  {/* Location is optional, so the separator has to be too —
                      otherwise the line ends in a dangling "·". */}
                  {[formatTimeRange(event.startsAt, event.endsAt), event.location]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {event.description ? (
                  <Text style={styles.desc} numberOfLines={2}>{event.description}</Text>
                ) : null}
              </View>

              <Ionicons name="chevron-forward" size={18} color="#c3cad8" style={styles.arrow} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  newButton: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },

  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  chipActive: {
    backgroundColor: colors.surface,
  },

  chipText: {
    color: colors.surface,
    fontSize: 11.5,
    fontWeight: '500',
  },

  chipTextActive: {
    color: colors.navy,
    fontWeight: '600',
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 6,
  },

  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },

  emptyBody: {
    fontSize: 12,
    color: colors.textSubtle,
    textAlign: 'center',
  },

  eventList: {
    padding: 20,
    paddingBottom: 40,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 15,
    marginBottom: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    ...shadow.card,
  },

  dateBadge: {
    width: 52,
    paddingVertical: 9,
    borderRadius: 16,
    alignItems: 'center',
  },

  dateMonth: {
    color: colors.surface,
    fontSize: 10,
    letterSpacing: 0.6,
    opacity: 0.8,
  },

  dateDay: {
    color: colors.surface,
    fontSize: 19,
    fontWeight: '800',
  },

  cardBody: {
    flex: 1,
  },

  arrow: {
    alignSelf: 'center',
  },

  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },

  meta: {
    fontSize: 11.5,
    color: colors.textSubtle,
    marginTop: 5,
  },

  desc: {
    marginTop: 6,
    fontSize: 11.5,
    color: colors.textMuted,
    lineHeight: 17,
  },

  scroll: {
    flex: 1,
  },
});
