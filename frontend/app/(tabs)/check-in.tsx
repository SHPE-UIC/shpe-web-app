import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera'; //For the QR code to be scanned using cameraview
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics'; //For vibration on phone for the scan
import PageHeader from '../../components/PageHeader';
import { colors, radius, shadow } from '../../constants/theme';

export default function CheckInScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const handleBarCodeScanned = (result: BarcodeScanningResult) => {
    console.log("QR code scanned!");
    setScanned(true); // Lock the scanner
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const qrCode = result.data;
    console.log(qrCode);
    Alert.alert(
      "Check-in Successful",
      `Scanned Data: ${qrCode}`, //Event ID
      [{ text: "OK", onPress: () => setScanned(false) }]
    );
  };

  // Auto-request permission when the screen loads
  useEffect(() => {
    if (!permission) requestPermission();
  }, []);

  const ready = permission?.granted && !scanned;

  return (
    <View style={styles.container}>
      <PageHeader title="Check In" subtitle="General Meeting · EIB 124" />

      <View style={styles.content}>
        <View style={styles.qrCard}>
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
              <TouchableOpacity style={styles.enableButton} onPress={requestPermission}>
                <Text style={styles.enableText}>Enable Camera</Text>
              </TouchableOpacity>
            )}

            {/* Corner brackets + sweep line sit above the camera preview */}
            <View pointerEvents="none" style={[styles.corner, styles.topLeft]} />
            <View pointerEvents="none" style={[styles.corner, styles.topRight]} />
            <View pointerEvents="none" style={[styles.corner, styles.bottomLeft]} />
            <View pointerEvents="none" style={[styles.corner, styles.bottomRight]} />
            <View pointerEvents="none" style={styles.scanLine} />
          </View>

          <Text style={styles.cardTitle}>Scan QR Code to Check In</Text>
          <Text style={styles.cardSubtitle}>
            Position the QR code within the frame to check in to the event
          </Text>

          <View style={styles.statusPill}>
            <View style={[styles.statusDot, !ready && styles.statusDotIdle]} />
            <Text style={styles.statusText}>{ready ? 'Scanner ready' : 'Scanner paused'}</Text>
          </View>
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
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: 22,
    alignItems: 'center',
  },
  qrCard: {
    backgroundColor: colors.surface,
    borderRadius: 30,
    width: '100%',
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
    marginTop: 4,
    ...shadow.card,
  },
  scannerFrame: {
    width: 200,
    height: 200,
    backgroundColor: '#eef2f8',
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  enableButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: colors.navy,
  },
  enableText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '600',
  },
  scanLine: {
    height: 3,
    left: 14,
    right: 14,
    borderRadius: 3,
    backgroundColor: colors.orange,
    position: 'absolute',
    top: 72,
  },
  corner: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderColor: colors.navy,
  },
  topLeft: {
    top: 16,
    left: 16,
    borderLeftWidth: 5,
    borderTopWidth: 5,
    borderTopLeftRadius: 10,
  },
  topRight: {
    top: 16,
    right: 16,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderTopRightRadius: 10,
  },
  bottomLeft: {
    bottom: 16,
    left: 16,
    borderLeftWidth: 5,
    borderBottomWidth: 5,
    borderBottomLeftRadius: 10,
  },
  bottomRight: {
    bottom: 16,
    right: 16,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderBottomRightRadius: 10,
  },

  cardTitle: {
    fontSize: 16.5,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginTop: 22,
  },
  cardSubtitle: {
    fontSize: 12.5,
    color: colors.textSubtle,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(114,169,190,0.16)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.teal,
  },
  statusDotIdle: {
    backgroundColor: colors.textFaint,
  },
  statusText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#2c5b6d',
  },
  footerText: {
    marginTop: 26,
    fontSize: 12,
    color: colors.textSubtle,
    textAlign: 'center',
  },
  linkText: {
    fontWeight: '600',
    color: colors.blue,
  },
});
