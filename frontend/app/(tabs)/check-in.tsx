import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Button, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera'; //For the QR code to be scanned using cameraview
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import * as Haptics from 'expo-haptics'; //For vibration on phone for the scan
import { db } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';

export default function CheckInScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    console.log('QR code scanned!');
    setScanned(true); // Lock the scanner
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const resetScan = () => setScanned(false);

    try {
      if (!user) {
        Alert.alert('Error', 'You must be signed in to check in.', [
          { text: 'OK', onPress: resetScan },
        ]);
        return;
      }

      const eventId = result.data?.trim() ?? '';
      if (!eventId) {
        Alert.alert('Error', 'Invalid QR code.', [{ text: 'OK', onPress: resetScan }]);
        return;
      }

      const eventSnap = await getDoc(doc(db, 'events', eventId));
      if (!eventSnap.exists()) {
        Alert.alert('Error', 'Event not found', [{ text: 'OK', onPress: resetScan }]);
        return;
      }

      const eventData = eventSnap.data();
      const eventTitle =
        typeof eventData?.title === 'string' ? eventData.title : 'Event';

      await addDoc(collection(db, 'checkIns'), {
        userId: user.uid,
        eventId,
        timestamp: serverTimestamp(),
      });

      Alert.alert('Check-in Successful', eventTitle, [
        { text: 'OK', onPress: resetScan },
      ]);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Something went wrong';
      Alert.alert('Error', message, [{ text: 'OK', onPress: resetScan }]);
    }
  };

  // Auto-request permission when the screen loads
  useEffect(() => {
    if (!permission) requestPermission();
  }, []);

  

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Check In</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.qrCard}>
          {/* <View style={styles.scannerFrame}>
            <View style={styles.scannerTarget}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
              
              <View style={styles.scanLine} />
            </View>
          </View> */}
          <View style={styles.scannerFrame}>
            {permission?.granted ? (
              <CameraView 
                style={StyleSheet.absoluteFillObject} 
                facing="back"
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes: ["qr"],
                }}
              />
            ) : (
              <Button title="Enable Camera" onPress={requestPermission} />
            )}
            <View style={styles.scanLine} />
          </View>

          <Text style={styles.cardTitle}>Scan QR Code to Check In</Text>
          <Text style={styles.cardSubtitle}>
            Position the QR code within the frame to check in to the event
          </Text>
        </View>

        
        <Text style={styles.footerText}>
          No QR code? <Text style={styles.linkText}>Ask an organizer for assistance</Text>
        </Text>
      </View>
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
    paddingBottom: 30,
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
    fontSize: 32,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCard: {
    backgroundColor: '#fff',
    borderRadius: 30,
    width: '100%',
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  scannerFrame: {
    width: 220,
    height: 220,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  scannerTarget: {
    width: 140,
    height: 140,
    borderWidth: 0,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanLine: {
    height: 2,
    width: '110%',
    backgroundColor: '#D50032',
    position: 'absolute',
    zIndex: 2,
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#1B2A6B',
    borderWidth: 6,
    borderRadius: 4,
  },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B2A6B',
    textAlign: 'center',
    marginBottom: 12,
  },
  cardSubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  footerText: {
    marginTop: 30,
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
  },
  linkText: {
    fontWeight: '600',
    color: '#444',
  },
});