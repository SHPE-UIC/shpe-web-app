import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';

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
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error('Error fetching announcements:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SHPE App</Text>
        <Text style={styles.headerSubtitle}>
          Welcome back, {user?.email?.split('@')[0] ?? 'Member'}!
        </Text>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.actionsRow}>
          <ActionButton icon="calendar-clear" label="View Events" onPress={() => router.push('/events')} />
          <ActionButton icon="scan" label="Check In" onPress={() => router.push('/check-in')} />
          <ActionButton icon="person" label="Profile" onPress={() => router.push('/profile')} />
        </View>

        <Text style={styles.sectionTitle}>Announcements</Text>
        {loading ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#1B2A6B" />
          </View>
        ) : announcements.length === 0 ? (
          <Text style={[styles.cardBody, { textAlign: 'center', marginTop: 8 }]}>No announcements yet.</Text>
        ) : (
          announcements.map((a) => (
            <TouchableOpacity key={a.id} style={styles.card}>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{a.title}</Text>
                <Text style={styles.cardBody}>{a.body}</Text>
                <Text style={styles.cardTime}>{a.time}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
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
    backgroundColor: '#f0f2f5',
  },
  header: {
    backgroundColor: '#1B2A6B',
    paddingTop: 56,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  headerTitle: {
    color: '#ff003c',
    fontSize: 30,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#fff',
    fontSize: 15,
    marginTop: 10,
  },
  scrollView: {
    flex: 1,
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
    height: 140,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 4,
    paddingVertical: 20,
    justifyContent: 'flex-start',
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
    marginBottom: 12,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#25292e',
    textAlign: 'center',
    marginRight: 30,
    marginLeft: 30,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1B2A6B',
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
    color: '#1B2A6B',
    marginBottom: 4,
  },
  cardBody: {
    fontSize: 14,
    color: '#25292e',
    marginBottom: 6,
    lineHeight: 20,
  },
  cardTime: {
    fontSize: 12,
    color: '#999',
  },
});
