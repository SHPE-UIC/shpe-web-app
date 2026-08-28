import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import PageHeader from '../../components/PageHeader';
import { colors, shadow } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { ApiError } from '../../lib/api/client';
import type { PublicEvent } from '../../lib/api/types';
import { fetchCheckinToken } from '../../lib/checkIns';
import { useGoBack } from '../../lib/useGoBack';
import { formatDateLong } from '../../lib/events';

/**
 * The code officers project or hold up at an event.
 *
 * It re-fetches as the token expires. A static code would be photographed once
 * and reused from anywhere for the rest of the event, which is the whole reason
 * the QR carries a signed short-lived token rather than the event id.
 */
export default function OrganizerQrScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { user } = useAuth();

  const [token, setToken] = useState<string | null>(null);
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchCheckinToken(eventId);
      setToken(data.token);
      setEvent(data.event);
      setSecondsLeft(data.expiresIn);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not get a check-in code for this event.',
      );
    }
  }, [eventId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Tick the countdown once a second.
  useEffect(() => {
    const timer = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch a replacement as the current one runs out. Kept in its own effect so
  // the interval above stays a pure countdown.
  useEffect(() => {
    if (token && secondsLeft === 0) void refresh();
  }, [token, secondsLeft, refresh]);

  const goBack = useGoBack('/(tabs)/events');

  // The API is the real gate; this only avoids showing officers-only UI to a
  // member who reached the URL somehow.
  if (user && !user.isAdmin) {
    return (
      <View style={styles.screen}>
        <PageHeader title="Check-in code" backLabel="Back" onBack={goBack} />
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={34} color={colors.textFaint} />
          <Text style={styles.heading}>Officers only</Text>
          <Text style={styles.body}>Ask an officer to display the check-in code.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <PageHeader
        title={event?.name ?? 'Check-in code'}
        subtitle={event ? formatDateLong(new Date(event.startsAt)) : undefined}
        backLabel="Back"
        onBack={goBack}
      />

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.qrBox}>
            {error ? (
              <Ionicons name="alert-circle-outline" size={44} color={colors.orangeDark} />
            ) : token ? (
              <QRCode
                value={token}
                size={230}
                color={colors.navy}
                backgroundColor="#ffffff"
                // Tokens are long, and a projector plus a phone camera is a
                // lossy path. The higher correction level survives it.
                ecl="M"
              />
            ) : (
              <ActivityIndicator size="large" color={colors.navy} />
            )}
          </View>

          {error ? (
            <>
              <Text style={styles.heading}>Cannot show a code</Text>
              <Text style={styles.body}>{error}</Text>
            </>
          ) : (
            <>
              <Text style={styles.heading}>Members scan this to check in</Text>
              <Text style={styles.body}>
                It refreshes automatically. A photo of it stops working within a minute, so it
                cannot be shared with anyone who is not here.
              </Text>

              <View style={styles.countdownPill}>
                <View style={[styles.dot, secondsLeft <= 5 && styles.dotStale]} />
                <Text style={styles.countdownText}>
                  {token ? `New code in ${secondsLeft}s` : 'Getting a code…'}
                </Text>
              </View>
            </>
          )}
        </View>

        <Text style={styles.footer}>Keep this screen open for the whole event.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: 22,
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 30,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 30,
    width: '100%',
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
    ...shadow.card,
  },
  qrBox: {
    width: 262,
    height: 262,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 16.5,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginTop: 18,
  },
  body: {
    fontSize: 12.5,
    color: colors.textSubtle,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 10,
  },
  countdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(114,169,190,0.16)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.teal,
  },
  dotStale: {
    backgroundColor: colors.orange,
  },
  countdownText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#2c5b6d',
  },
  footer: {
    marginTop: 26,
    fontSize: 12,
    color: colors.textSubtle,
    textAlign: 'center',
  },
});
