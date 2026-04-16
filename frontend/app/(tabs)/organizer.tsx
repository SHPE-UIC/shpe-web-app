import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';

export default function OrganizerScreen() {
  const router = useRouter();
  const { profile, profileLoading } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const q = query(collection(db, 'events'), orderBy('date', 'asc'));
        const snapshot = await getDocs(q);
        setEvents(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error('Error fetching events:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  if (!profileLoading && profile && profile.isAdmin !== true) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="lock-closed-outline" size={48} color="#888" />
        <Text style={styles.noAccessTitle}>Organizer access required</Text>
        <Text style={styles.noAccessBody}>
          Only SHPE organizers can generate event QR codes.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Organizer</Text>
        <Text style={styles.headerSubtitle}>
          Tap an event to display its check-in QR code
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#D50032" />
          </View>
        ) : events.length === 0 ? (
          <Text style={styles.emptyText}>No events yet.</Text>
        ) : (
          events.map((ev) => {
            const timeParts = [ev.startTime, ev.endTime].filter(Boolean);
            const timeStr = timeParts.length > 0 ? ` · ${timeParts.join(' – ')}` : '';
            return (
              <TouchableOpacity
                key={ev.id}
                style={styles.card}
                onPress={() => router.push(`/organizer/qr/${ev.id}`)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{ev.title ?? 'Untitled Event'}</Text>
                  <Text style={styles.cardInfo}>
                    {ev.date ?? ''}
                    {timeStr}
                  </Text>
                  <Text style={styles.cardLocation}>{ev.location ?? ''}</Text>
                </View>
                <View style={styles.qrButton}>
                  <Ionicons name="qr-code" size={22} color="#fff" />
                </View>
              </TouchableOpacity>
            );
          })
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
    color: '#D50032',
    fontSize: 30,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#fff',
    fontSize: 14,
    marginTop: 6,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B2A6B',
    marginBottom: 4,
  },
  cardInfo: {
    fontSize: 13,
    color: '#555',
    marginBottom: 2,
  },
  cardLocation: {
    fontSize: 13,
    color: '#888',
  },
  qrButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#D50032',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  noAccessTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 12,
  },
  noAccessBody: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    maxWidth: 260,
  },
});
