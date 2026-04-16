import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import attendanceIcon from '../../../assets/images/attendanceIcon.png';
import calendarIcon from '../../../assets/images/calendarIcon.png';
import checkinIcon from '../../../assets/images/checkinIcon.png';
import locationIcon from '../../../assets/images/locationIcon.png';
import rsvpIcon from '../../../assets/images/rsvpIcon.png';
import Card from '../../components/Card';

export default function EventInfo() {
  const router = useRouter();
  const { name, date, time, location, desc } = useLocalSearchParams();
  console.log('params:', name, date, time, location, desc);

  return (
    <>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            onPress={() => router.push('/(tabs)/events')}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerSubtitle}>Back to Events!</Text>
        </View>
        <Text style={styles.headerTitle}>{name}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Card>
          <View style={styles.iconRow}>
            <Image source={calendarIcon} style={styles.medIcon} />
            <Text style={styles.meta}>Date & Time</Text>          
          </View>
          <Text style={[styles.meta, styles.marginLeft]}>{date}</Text>
          <Text style={[styles.meta, styles.marginLeft]}>{time}</Text>
          <View style={styles.iconRow}>
            <Image source={locationIcon} style={styles.medIcon} />
            <Text style={styles.meta}>Location</Text>
          </View>
          <Text style={[styles.meta, styles.marginLeft]}>{location}</Text>
        </Card>

        <Card>
          <Text style={[styles.header2, styles.blue]}>About This Event</Text>
          <Text style={styles.meta}>
            {desc}
          </Text>
        </Card>

        <View style={styles.section}>
          <Card>
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
  header: {
    backgroundColor: '#001E62',
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    flexDirection: 'column',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    color: '#D50032',
    fontSize: 32,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#fff',
    fontSize: 15,
  },
  header2: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
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
    color: '#ffffff',
  },
});