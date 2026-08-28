import Ionicons from '@expo/vector-icons/Ionicons';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PageHeader from '../../components/PageHeader';
import { colors, shadow } from '../../constants/theme';
import { ApiError } from '../../lib/api/client';
import { submitCheckIn, type CheckInResult } from '../../lib/checkIns';

type ScanState =
  | { status: 'ready' }
  | { status: 'submitting' }
  | { status: 'done'; result: CheckInResult }
  | { status: 'failed'; message: string };

export default function CheckInScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scan, setScan] = useState<ScanState>({ status: 'ready' });

  // Auto-request permission when the screen loads.
  useEffect(() => {
    if (!permission) void requestPermission();
  }, [permission, requestPermission]);

  const handleBarCodeScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      // Lock the scanner first: the camera fires this repeatedly while the code
      // stays in frame, which would otherwise send a burst of requests.
      setScan({ status: 'submitting' });

      try {
        const checkIn = await submitCheckIn(result.data);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setScan({ status: 'done', result: checkIn });
      } catch (err) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setScan({
          status: 'failed',
          message:
            err instanceof ApiError
              ? err.message
              : 'That code could not be read. Ask an organizer for help.',
        });
      }
    },
    [],
  );

  const reset = () => setScan({ status: 'ready' });
  const scanning = scan.status === 'ready' && permission?.granted === true;

  return (
    <View style={styles.container}>
      <PageHeader title="Check In" subtitle="Scan the code an organizer is showing" />

      <View style={styles.content}>
        <View style={styles.qrCard}>
          <View style={styles.scannerFrame}>
            {scan.status === 'done' ? (
              <View style={[styles.resultFill, styles.successFill]}>
                <Ionicons name="checkmark-circle" size={54} color="#fff" />
              </View>
            ) : scan.status === 'failed' ? (
              <View style={[styles.resultFill, styles.failureFill]}>
                <Ionicons name="close-circle" size={54} color="#fff" />
              </View>
            ) : scan.status === 'submitting' ? (
              <View style={styles.resultFill}>
                <ActivityIndicator size="large" color={colors.navy} />
              </View>
            ) : permission?.granted ? (
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                onBarcodeScanned={scanning ? (r) => void handleBarCodeScanned(r) : undefined}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              />
            ) : (
              <TouchableOpacity style={styles.enableButton} onPress={requestPermission}>
                <Text style={styles.enableText}>Enable Camera</Text>
              </TouchableOpacity>
            )}

            {/* Corner brackets sit above the preview, but not over a result. */}
            {scan.status === 'ready' ? (
              <>
                <View pointerEvents="none" style={[styles.corner, styles.topLeft]} />
                <View pointerEvents="none" style={[styles.corner, styles.topRight]} />
                <View pointerEvents="none" style={[styles.corner, styles.bottomLeft]} />
                <View pointerEvents="none" style={[styles.corner, styles.bottomRight]} />
                <View pointerEvents="none" style={styles.scanLine} />
              </>
            ) : null}
          </View>

          {scan.status === 'done' ? (
            <>
              <Text style={styles.cardTitle}>You&apos;re checked in</Text>
              <Text style={styles.cardSubtitle}>
                {scan.result.eventName}
                {scan.result.points > 0 ? ` · +${scan.result.points} points` : ''}
              </Text>
            </>
          ) : scan.status === 'failed' ? (
            <>
              <Text style={styles.cardTitle}>Check-in failed</Text>
              <Text style={styles.cardSubtitle}>{scan.message}</Text>
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>Scan QR Code to Check In</Text>
              <Text style={styles.cardSubtitle}>
                Position the QR code within the frame to check in to the event
              </Text>
            </>
          )}

          {scan.status === 'done' || scan.status === 'failed' ? (
            <TouchableOpacity style={styles.againButton} onPress={reset} activeOpacity={0.85}>
              <Text style={styles.againText}>Scan again</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, !scanning && styles.statusDotIdle]} />
              <Text style={styles.statusText}>
                {scan.status === 'submitting'
                  ? 'Checking you in…'
                  : scanning
                    ? 'Scanner ready'
                    : 'Scanner paused'}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.footerText}>
          Codes refresh every minute. <Text style={styles.linkText}>Ask an organizer</Text> if yours
          will not scan.
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
  resultFill: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successFill: {
    backgroundColor: colors.teal,
  },
  failureFill: {
    backgroundColor: colors.orangeDark,
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
  topLeft: { top: 16, left: 16, borderLeftWidth: 5, borderTopWidth: 5, borderTopLeftRadius: 10 },
  topRight: { top: 16, right: 16, borderRightWidth: 5, borderTopWidth: 5, borderTopRightRadius: 10 },
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
  againButton: {
    marginTop: 18,
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 16,
    backgroundColor: colors.navy,
  },
  againText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '700',
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
