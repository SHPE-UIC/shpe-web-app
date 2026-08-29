import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Card from '../../../components/Card';
import { ComingSoon } from '../../../components/ComingSoon';
import PageHeader from '../../../components/PageHeader';
import { colors, radius, shadow } from '../../../constants/theme';
import { useAuth } from '../../../contexts/AuthContext';
import { isBoardOrAbove } from '../../../lib/roles';
import { formatDateLong, formatTimeRange, useEvent } from '../../../lib/events';

export default function EventInfo() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { event, error, loading } = useEvent(id);
  const { user } = useAuth();

  const goBack = () => router.push('/(tabs)/events');

  if (loading || error || !event) {
    return (
      <View style={styles.screen}>
        <PageHeader title="Event" backLabel="Back to Events" onBack={goBack} />
        {loading ? (
          <ActivityIndicator style={styles.centered} color={colors.navy} />
        ) : (
          <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={34} color={colors.textFaint} />
            <Text style={styles.cardHeading}>
              {error ? "Couldn't load this event" : 'Event not found'}
            </Text>
            <Text style={styles.subValue}>
              {error ? error.message : 'It may have been removed.'}
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <PageHeader title={event.name} backLabel="Back to Events" onBack={goBack}>
        <View style={styles.chipRow}>
          <View style={styles.categoryChip}>
            <Text style={styles.categoryText}>{event.tag}</Text>
          </View>
          {event.points > 0 ? (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryText}>{`${event.points} pts`}</Text>
            </View>
          ) : null}
        </View>
      </PageHeader>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Date / location split card */}
        <Card style={styles.splitCard}>
          <View style={styles.splitColumn}>
            <View style={[styles.iconTile, styles.blueTile]}>
              <Ionicons name="calendar-clear-outline" size={16} color={colors.blue} />
            </View>
            <View style={styles.splitText}>
              <Text style={styles.label}>Date</Text>
              <Text style={styles.value}>{formatDateLong(event.startsAt)}</Text>
              <Text style={styles.subValue}>
                {formatTimeRange(event.startsAt, event.endsAt)}
              </Text>
            </View>
          </View>

          <View style={styles.verticalDivider} />

          <View style={styles.splitColumn}>
            <View style={[styles.iconTile, styles.orangeTile]}>
              <Ionicons name="location-outline" size={16} color={colors.orange} />
            </View>
            <View style={styles.splitText}>
              <Text style={styles.label}>Location</Text>
              <Text style={styles.value}>{event.location || 'Location TBD'}</Text>
              <Text style={styles.subValue}>
                {event.location ? 'UIC campus' : 'No location set yet'}
              </Text>
            </View>
          </View>
        </Card>

        <Card>
          <Text style={styles.cardHeading}>About This Event</Text>
          <Text style={[styles.body, !event.description && styles.bodyEmpty]}>
            {event.description || 'No description has been added yet.'}
          </Text>
        </Card>

        <ComingSoon>
          <View style={styles.rsvpButton}>
            <Text style={styles.rsvpText}>RSVP Now</Text>
          </View>
        </ComingSoon>

        {/* Officers show the code; members scan it. */}
        {isBoardOrAbove(user?.role) ? (
          <TouchableOpacity
            style={styles.editButton}
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: '/admin/event', params: { id: event.id } })}
          >
            <Ionicons name="create-outline" size={17} color={colors.navy} />
            <Text style={styles.editText}>Edit event</Text>
          </TouchableOpacity>
        ) : null}

        {isBoardOrAbove(user?.role) ? (
          <TouchableOpacity
            style={styles.organizerButton}
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: '/organizer/[eventId]', params: { eventId: event.id } })}
          >
            <Ionicons name="qr-code-outline" size={17} color={colors.surface} />
            <Text style={styles.organizerText}>Show check-in code</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={styles.checkinButton}
          activeOpacity={0.85}
          onPress={() => router.push('/(tabs)/check-in')}
        >
          <Text style={styles.checkinText}>Check In to Event</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 22,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 6,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 16,
  },
  categoryText: {
    color: colors.surface,
    fontSize: 11,
    fontWeight: '600',
  },

  // Date / location
  splitCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  splitColumn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  splitText: {
    flex: 1,
  },
  iconTile: {
    width: 30,
    height: 30,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blueTile: {
    backgroundColor: 'rgba(0,112,192,0.12)',
  },
  orangeTile: {
    backgroundColor: 'rgba(253,101,47,0.14)',
  },
  verticalDivider: {
    width: 1,
    backgroundColor: '#eef1f6',
  },
  label: {
    fontSize: 10.5,
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.text,
    marginTop: 3,
  },
  subValue: {
    fontSize: 11.5,
    color: colors.textSubtle,
  },

  cardHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  bodyEmpty: {
    fontStyle: 'italic',
    color: colors.textFaint,
  },
  body: {
    fontSize: 12.5,
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: 7,
  },

  // Attendees
  attendeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  avatarOverlap: {
    marginLeft: -11,
  },

  // Actions
  rsvpButton: {
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: colors.orange,
    alignItems: 'center',
    marginTop: 2,
    ...shadow.accent,
  },
  rsvpText: {
    color: colors.surface,
    fontSize: 14.5,
    fontWeight: '700',
  },
  checkinButton: {
    paddingVertical: 14,
    borderRadius: radius.pill - 2,
    borderWidth: 1.5,
    borderColor: colors.navy,
    alignItems: 'center',
    marginTop: 9,
  },
  checkinText: {
    color: colors.navy,
    fontSize: 14.5,
    fontWeight: '700',
  },
  // Solid navy so it reads as the officer's primary action on this screen,
  // against the outlined member-facing button below it.
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.pill - 2,
    borderWidth: 1.5,
    borderColor: colors.navy,
    marginTop: 9,
  },
  editText: {
    color: colors.navy,
    fontSize: 14.5,
    fontWeight: '700',
  },
  organizerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.pill - 2,
    backgroundColor: colors.navy,
    marginTop: 9,
  },
  organizerText: {
    color: colors.surface,
    fontSize: 14.5,
    fontWeight: '700',
  },
});
