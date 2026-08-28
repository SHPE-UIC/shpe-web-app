import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import PageHeader from '../../components/PageHeader';
import { colors, radius, shadow } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { accentColor, formatRelativeTime, useAnnouncements } from '../../lib/announcements';
import shpeLogo from '../../assets/images/shpe_logo.png';

function ActionButton({
  icon,
  label,
  color,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  color: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.actionIconTile, { backgroundColor: color }]}>
        <Ionicons name={icon} size={20} color="#fff" />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function Index() {
  const router = useRouter();
  const { user } = useAuth();
  const { announcements, loading: announcementsLoading } = useAnnouncements();

  // Members introduce themselves by first name; the header has room for one.
  const firstName = user?.name?.trim().split(/\s+/)[0];

  return (
    <View style={styles.container}>
      <PageHeader
        title="SHPE @ UIC"
        subtitle={firstName ? `Welcome back, ${firstName}!` : 'Welcome back!'}
        right={
          <View style={styles.logoTile}>
            <Image source={shpeLogo} style={styles.logo} resizeMode="contain" />
          </View>
        }
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* pulled up so the tiles straddle the header's rounded edge */}
        <View style={styles.actionsRow}>
          <ActionButton
            icon="calendar-clear"
            label="View Events"
            color={colors.orange}
            onPress={() => router.push('/events')}
          />
          <ActionButton
            icon="scan"
            label="Check In"
            color={colors.blue}
            onPress={() => router.push('/check-in')}
          />
          <ActionButton
            icon="person"
            label="Profile"
            color={colors.teal}
            onPress={() => router.push('/profile')}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Announcements</Text>
          <TouchableOpacity onPress={() => router.push('/announcements')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {announcementsLoading ? (
          <ActivityIndicator style={styles.feedState} color={colors.navy} />
        ) : !announcements || announcements.length === 0 ? (
          <Text style={styles.feedEmpty}>No announcements yet.</Text>
        ) : (
          // Only the newest few belong on the home screen; the rest live behind
          // "See all".
          announcements.slice(0, 3).map((a) => (
            <TouchableOpacity
              key={a.id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => router.push('/announcements')}
            >
              <View style={[styles.cardAccent, { backgroundColor: accentColor(a) }]} />
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{a.title}</Text>
                <Text style={styles.cardBody} numberOfLines={2}>{a.body}</Text>
                <Text style={styles.cardTime}>{formatRelativeTime(a.publishedAt)}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  logoTile: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 24,
    height: 24,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 9,
    ...shadow.card,
  },
  actionIconTile: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  seeAll: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.blue,
  },
  feedState: {
    marginTop: 18,
  },
  feedEmpty: {
    fontSize: 12.5,
    color: colors.textSubtle,
    textAlign: 'center',
    marginTop: 14,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    ...shadow.card,
  },
  cardAccent: {
    width: 5,
    borderRadius: 4,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.navy,
  },
  cardBody: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 4,
  },
  cardTime: {
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 7,
  },
});
