// app/event-page.tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function EventPage() {
  return (
    <View style={styles.container}>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.eventList}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Upcoming Events</Text>
      </View>

        {/* Event Cards */}

        <View style={styles.card}>
          <Text style={styles.arrow}><Ionicons name="chevron-forward" size={20} color="#999" /></Text>
          
          <Text style={styles.title}>Event Name</Text>
          <Text style={styles.info}>📅Event Date</Text>
          <Text style={styles.info}>📍Location</Text>
          <Text style={styles.desc}>description</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.arrow}><Ionicons name="chevron-forward" size={20} color="#999" /></Text>
          <Text style={styles.title}>Event Name</Text>
          <Text style={styles.info}>📅Event Date</Text>
          <Text style={styles.info}>📍Location</Text>
          <Text style={styles.desc}>description</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.arrow}><Ionicons name="chevron-forward" size={20} color="#999" /></Text>
          <Text style={styles.title}>Event Name</Text>
          <Text style={styles.info}>📅Event Date</Text>
          <Text style={styles.info}>📍Location</Text>
          <Text style={styles.desc}>description</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.arrow}><Ionicons name="chevron-forward" size={20} color="#999" /></Text>
          <Text style={styles.title}>Event Name</Text>
          <Text style={styles.info}>📅Event Date</Text>
          <Text style={styles.info}>📍Location</Text>
          <Text style={styles.desc}>description</Text>
        </View>

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
