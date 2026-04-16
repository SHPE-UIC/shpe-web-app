import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import QRCode from 'react-native-qrcode-svg';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../../contexts/AuthContext';

export default function OrganizerQrScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { profile, profileLoading } = useAuth();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    const fetchEvent = async () => {
      try {
        const snap = await getDoc(doc(db, 'events', String(eventId)));
        if (!snap.exists()) {
          setNotFound(true);
        } else {
          setEvent({ id: snap.id, ...snap.data() });
        }
      } catch (error) {
        console.error('Error fetching event:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [eventId]);

  if (!profileLoading && profile && profile.isAdmin !== true) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="lock-closed-outline" size={48} color="#888" />
        <Text style={styles.blockedTitle}>Organizer access required</Text>
        <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
          <Text style={styles.doneButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Event QR Code</Text>
      </View>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#D50032" />
        ) : notFound || !event ? (
          <Text style={styles.errorText}>Event not found.</Text>
        ) : (
          <>
            <View style={styles.qrCard}>
              <QRCode
                value={String(eventId)}
                size={260}
                color="#1B2A6B"
                backgroundColor="#fff"
              />
            </View>

            <Text style={styles.eventTitle}>{event.title ?? 'Event'}</Text>
            {event.date ? (
              <Text style={styles.eventMeta}>
                {event.date}
                {event.startTime ? ` · ${event.startTime}` : ''}
                {event.endTime ? ` – ${event.endTime}` : ''}
              </Text>
            ) : null}
            {event.location ? (
              <Text style={styles.eventMeta}>{event.location}</Text>
            ) : null}

            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Event ID (manual entry fallback)</Text>
              <Text selectable style={styles.codeValue}>
                {String(eventId)}
              </Text>
            </View>

            <Text style={styles.instructions}>
              Members can scan this code from the Check In tab to record attendance.
            </Text>
          </>
        )}
      </View>

      <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
        <Text style={styles.doneButtonText}>Done</Text>
      </TouchableOpacity>
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
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    color: '#D50032',
    fontSize: 26,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 12,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 12,
  },
  qrCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B2A6B',
    textAlign: 'center',
  },
  eventMeta: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
  },
  codeBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  codeLabel: {
    fontSize: 11,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  codeValue: {
    fontSize: 14,
    fontFamily: 'Menlo',
    color: '#1B2A6B',
    fontWeight: '600',
  },
  instructions: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 300,
  },
  blockedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
  doneButton: {
    backgroundColor: '#D50032',
    marginHorizontal: 20,
    marginBottom: 24,
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
