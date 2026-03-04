import {View, Text, StyleSheet, ScrollView, Image} from 'react-native';
import { Stack } from 'expo-router';
import Card from '../components/Card';
import calendarIcon from '../../assets/images/calendarIcon.png';
import locationIcon from '../../assets/images/locationIcon.png';
import rsvpIcon from '../../assets/images/rsvpIcon.png';
import attendanceIcon from '../../assets/images/attendanceIcon.png';
import checkinIcon from '../../assets/images/checkinIcon.png';

export default function EventInfo() {
  return (
    <>
      <Stack.Screen options={{ title: 'General Meeting', headerBackTitle: 'Back to Events', headerBackVisible: true }} />
      <ScrollView contentContainerStyle={styles.container}>

        {/* Event Details Section */}
        <Card>
          <View style={styles.iconRow}>
            <Image source={calendarIcon} style={styles.medIcon} />
            <Text style={styles.meta}>Date & Time</Text>          
          </View>

          <Text style={[styles.meta, styles.marginLeft]}>January 15, 2024</Text>
          <Text style={[styles.meta, styles.marginLeft]}>6:00 PM - 7:00 PM</Text>

          <View style={styles.iconRow}>
            <Image source={locationIcon} style={styles.medIcon} />
            <Text style={styles.meta}>Location</Text>
          </View>

          <Text style={[styles.meta, styles.marginLeft]}>EIB 124</Text>
        </Card>

        {/* Description Section */}
        <Card>
          <Text style={[styles.header2, styles.blue]}>About This Event</Text>
          <Text style={styles.meta}>
            Monthly general meeting for all members. We'll discuss upcoming events and opportunities.
          </Text>
        </Card>

        {/* Actions Section */}
        <View style={styles.section}>
          <Card>
            {/* RSVP Button Section */}
            <View style={styles.iconRow}>
              <Image source={rsvpIcon} style={styles.smallIcon} />
              <Text style={[styles.header2, styles.blue]}>RSVP</Text>
              <Image source={attendanceIcon} style={styles.smallIcon} />
              <Text style={styles.meta}>45 attending</Text>
            </View>

            <View style={styles.idbutton}>
              <Text style={styles.buttonTxt}>RSVP Now</Text>
            </View>
          </Card>

          {/* Check In Button Section */}
          <View style={styles.checkinbutton}>
            <View style={styles.iconRow}>
              <Image source={checkinIcon} style={styles.smallIcon} />
              <Text style={styles.buttonTxt}>Check in to Event</Text>
              
            </View> 
          </View>



        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  headerSection: {
    marginBottom: 15,
  },
  header1: {
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 8,
  },
  header2: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 8,
  },

  red: {
    color: '#D50032',
  },
  
  blue: {
    color: '#001E62',
  },
  
  meta: {
    fontSize: 15,
    color: '#333333',
  },

  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  
   marginLeft: {
    marginLeft: 48,
  },

  medIcon: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  smallIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },

  section: {
    marginBottom: 25,
  },
  idbutton: {
    padding: 15,
    borderRadius: 16,
    backgroundColor: '#001E62',
    marginBottom: 10,
    alignItems: 'center',
  },
  checkinbutton: {
    padding: 15,
    borderRadius: 16,
    backgroundColor: '#D50032',
    marginBottom: 10,
    alignItems: 'center',
  },
  buttonTxt: {
    color: '#ffff',
  },
});