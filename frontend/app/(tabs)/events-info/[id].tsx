import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Card from '../../../components/Card';
import PageHeader from '../../../components/PageHeader';
import { colors, radius, shadow } from '../../../constants/theme';

export default function EventInfo() {
  const router = useRouter();
  const { name, category, date, time, location, desc } = useLocalSearchParams();

  return (
    <View style={styles.screen}>
      <PageHeader
        title={String(name ?? 'Event')}
        backLabel="Back to Events"
        onBack={() => router.push('/(tabs)/events')}
      >
        <View style={styles.categoryChip}>
          <Text style={styles.categoryText}>{String(category ?? 'Event')}</Text>
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
              <Text style={styles.value}>{date}</Text>
              <Text style={styles.subValue}>{time}</Text>
            </View>
          </View>

          <View style={styles.verticalDivider} />

          <View style={styles.splitColumn}>
            <View style={[styles.iconTile, styles.orangeTile]}>
              <Ionicons name="location-outline" size={16} color={colors.orange} />
            </View>
            <View style={styles.splitText}>
              <Text style={styles.label}>Location</Text>
              <Text style={styles.value}>{location}</Text>
              <Text style={styles.subValue}>UIC Campus</Text>
            </View>
          </View>
        </Card>

        <Card>
          <Text style={styles.cardHeading}>About This Event</Text>
          <Text style={styles.body}>{desc}</Text>
        </Card>

        {/* Attendees */}
        <Card style={styles.attendeeCard}>
          <View style={styles.avatarStack}>
            <View style={[styles.avatar, { backgroundColor: colors.navy }]} />
            <View style={[styles.avatar, styles.avatarOverlap, { backgroundColor: colors.blue }]} />
            <View style={[styles.avatar, styles.avatarOverlap, { backgroundColor: colors.teal }]} />
          </View>
          <View>
            <Text style={styles.cardHeading}>45 attending</Text>
            <Text style={styles.subValue}>RSVP open until Jan 14</Text>
          </View>
        </Card>

        <TouchableOpacity style={styles.rsvpButton} activeOpacity={0.85}>
          <Text style={styles.rsvpText}>RSVP Now</Text>
        </TouchableOpacity>

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
  categoryChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 16,
    marginTop: 12,
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
});
