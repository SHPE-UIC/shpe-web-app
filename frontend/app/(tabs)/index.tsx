import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';

const announcements = [
  {
    id: 1,
    title: 'Announcement #1',
    body: 'This is a placeholder.',
    time: 'TBD',
  },
  {
    id: 2,
    title: 'Announcement #2',
    body: 'This is a placeholder.',
    time: 'TBD',
  },
  {
    id: 3,
    title: 'Announcement #3',
    body: 'This is a placeholder.',
    time: 'TBD',
  },
];

function ActionButton({ icon, label, onPress } : { icon: any; label: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress}>
      <View style={styles.actionIconCircle}>
        <Ionicons name={icon} size={26} color="#fff" />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function Index() {
  const router = useRouter();
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.actionsRow}>
        <ActionButton icon="calendar-clear" label="View Events" onPress={() => router.push('/events')} />
        <ActionButton icon="scan" label="Check In" onPress={() => router.push('/check-in')} />
        <ActionButton icon="person" label="Profile" onPress={() => router.push('/profile')} />
      </View>

      <Text style={styles.sectionTitle}>Announcements</Text>
      {announcements.map((a) => (
        <TouchableOpacity key={a.id} style={styles.card}>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{a.title}</Text>
            <Text style={styles.cardBody}>{a.body}</Text>
            <Text style={styles.cardTime}>{a.time}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width : 0, height : 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIconCircle: {
    backgroundColor: '#D50032',
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#202020',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000080',
    marginBottom: 4,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width : 0, height : 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardContent: {
    flex: 1,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000080',
    marginBottom: 4,
  },
  cardBody: {
    fontSize: 14,
    color: '#202020',
    marginBottom: 6,
    lineHeight: 20,
  },
  cardTime: {
    fontSize: 12,
    color: '#999',
  },
});
