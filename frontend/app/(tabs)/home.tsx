import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import PageHeader from '../../components/PageHeader';
import { colors, radius, shadow } from '../../constants/theme';
import shpeLogo from '../../assets/images/shpe_logo.png';

const announcements = [
  {
    id: 1,
    title: 'General Meeting This Wednesday',
    body: 'Join us for our monthly general meeting at 6 PM in EIB 124.',
    time: '2 hours ago',
    accent: colors.orange,
  },
  {
    id: 2,
    title: 'Resume Workshop Next Week',
    body: 'Get your resume reviewed by industry professionals.',
    time: '5 hours ago',
    accent: colors.blue,
  },
];

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
  return (
    <View style={styles.container}>
      <PageHeader
        title="SHPE @ UIC"
        subtitle="Welcome back, User!"
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
          <TouchableOpacity>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {announcements.map((a) => (
          <TouchableOpacity key={a.id} style={styles.card} activeOpacity={0.85}>
            <View style={[styles.cardAccent, { backgroundColor: a.accent }]} />
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{a.title}</Text>
              <Text style={styles.cardBody}>{a.body}</Text>
              <Text style={styles.cardTime}>{a.time}</Text>
            </View>
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
