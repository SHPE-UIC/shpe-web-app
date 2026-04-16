// app/event-page.tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import minicalendarIcon from '../../assets/images/mini-calendarIcon.png';
import minilocationIcon from '../../assets/images/mini-locationIcon.png';

export default function EventPage() {
  const router = useRouter();

  const events = [
    {id: '1', name: 'General Meeting', date: 'January 15, 2024', time: '6:00 PM - 7:00 PM', location: 'EIB 124', desc: 'Monthly general meeting for all members. We\'ll discuss upcoming events and opportunities.'},
    {id: '2', name: 'Event Name', date: 'Event Date', time: 'Event Time', location: 'Event Location', desc: 'Event Description'},
  ];
  
  return (
    <View style={styles.container}>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.eventList}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Upcoming Events</Text>
      </View>
      {events.map((event) => (
        <TouchableOpacity key={event.id} style={styles.card} onPress={() => router.push({
          pathname: '/events-info/[id]',
          params: { id: event.id, name: event.name, date: event.date, time: event.time, location: event.location, desc: event.desc }
        })}>
          {/* Event Cards */}
          <Text style={styles.arrow}><Ionicons name="chevron-forward" size={20} color="#999" /></Text>
          <Text style={styles.title}>{event.name}</Text>
          <View style={styles.iconRow}>
            <Image source={minicalendarIcon} style={styles.smallIcon} />
            <Text style={styles.info}>{event.date}</Text>
          </View>
          <View style={styles.iconRow}>
            <Image source={minilocationIcon} style={styles.smallIcon} />
            <Text style={styles.info}>{event.location}</Text>
          </View>
          <Text style={styles.desc}>{event.desc}</Text>
        </TouchableOpacity>
      ))}

        

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

  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 6,
  },

  smallIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
  },

});
