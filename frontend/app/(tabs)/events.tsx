// app/event-page.tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { db } from '../../firebaseConfig';

export default function EventPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const q = query(collection(db, 'events'), orderBy('date', 'asc'));
        const snapshot = await getDocs(q);
        setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error('Error fetching events:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  return (
    <View style={styles.container}>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.eventList}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Upcoming Events</Text>
      </View>

        {loading ? (
          <View style={{ flexGrow: 1, minHeight: 200, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#D40032" />
          </View>
        ) : events.length === 0 ? (
          <Text style={[styles.desc, { marginHorizontal: 20 }]}>No upcoming events.</Text>
        ) : (
          events.map((ev) => {
            const timeParts = [ev.startTime, ev.endTime].filter(Boolean);
            const timeStr = timeParts.length > 0 ? ` · ${timeParts.join(' – ')}` : '';
            return (
              <View key={ev.id} style={styles.card}>
                <Text style={styles.arrow}><Ionicons name="chevron-forward" size={20} color="#999" /></Text>

                <Text style={styles.title}>{ev.title ?? ''}</Text>
                <Text style={styles.info}>
                  📅{ev.date ?? ''}{timeStr}
                </Text>
                <Text style={styles.info}>📍{ev.location ?? ''}</Text>
                <Text style={styles.desc}>{ev.description ?? ''}</Text>
              </View>
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
    backgroundColor: "#F2F2F2",
  },

  header: {
    backgroundColor: "#082352",
    paddingTop: 25,
    paddingBottom: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    alignItems: "center",
    marginBottom: 20,
  },

  headerText: {
    color: "#D40032",
    fontSize: 28,
    fontWeight: "bold",
  },

  eventList: {
    //padding: 20,
    paddingBottom: 40,
    //paddingTop: 0,
  },

  card: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 18,
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },

  arrow: {
  position: "absolute",
  top: 15,
  right: 15,
  fontSize: 24,
  color: "#D40032"
  },

  title: {
    fontSize: 25,
    fontWeight: "bold",
    color: "navy",
    marginBottom: 6,
    //textAlign: "center", //maybe remove lets get opinions
  },

  info: {
    fontSize: 14,
    color: "#636363",
    marginBottom: 3,
    textAlign: "center",
  },

  desc: {
    marginTop: 8,
    fontSize: 14,
    color: "#444",
    textAlign: "center",
  },

  scroll: {
  flex: 1,
  },


});
