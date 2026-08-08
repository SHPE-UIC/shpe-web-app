// app/event-page.tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PageHeader from '../../components/PageHeader';
import { colors, radius, shadow } from '../../constants/theme';

const filters = ['All', 'Meetings', 'Career'] as const;

const events = [
  {
    id: '1',
    name: 'General Meeting',
    category: 'Meetings',
    month: 'JAN',
    day: '15',
    accent: colors.navy,
    date: 'January 15, 2026',
    time: '6:00 PM - 7:00 PM',
    location: 'EIB 124',
    desc: 'Monthly general meeting for all members. We\'ll discuss upcoming events and opportunities.',
  },
  {
    id: '2',
    name: 'Resume Workshop',
    category: 'Career',
    month: 'FEB',
    day: '08',
    accent: colors.orange,
    date: 'February 8, 2026',
    time: '6:00 PM - 7:00 PM',
    location: 'EIB 124',
    desc: 'Bring your resume and get feedback from professionals.',
  },
  {
    id: '3',
    name: 'Study Night',
    category: 'Meetings',
    month: 'FEB',
    day: '12',
    accent: colors.teal,
    date: 'February 12, 2026',
    time: '3:00 PM - 5:00 PM',
    location: 'EIEP',
    desc: 'Collaborative study session for midterms. Snacks provided.',
  },
];

export default function EventPage() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]>('All');

  const visibleEvents =
    activeFilter === 'All' ? events : events.filter((e) => e.category === activeFilter);

  return (
    <View style={styles.container}>
      <PageHeader
        title="Upcoming Events"
        subtitle={`${events.length} events this semester`}
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

      <ScrollView style={styles.scroll} contentContainerStyle={styles.eventList}>
        {visibleEvents.map((event) => (
          <TouchableOpacity
            key={event.id}
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => router.push({
              pathname: '/events-info/[id]',
              params: {
                id: event.id,
                name: event.name,
                category: event.category,
                date: event.date,
                time: event.time,
                location: event.location,
                desc: event.desc,
              }
            })}
          >
            {/* Date badge */}
            <View style={[styles.dateBadge, { backgroundColor: event.accent }]}>
              <Text style={styles.dateMonth}>{event.month}</Text>
              <Text style={styles.dateDay}>{event.day}</Text>
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.title}>{event.name}</Text>
              <Text style={styles.meta}>{`${event.time} · ${event.location}`}</Text>
              <Text style={styles.desc}>{event.desc}</Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color="#c3cad8" style={styles.arrow} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  chipRow: {
    flexDirection: 'row',
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
