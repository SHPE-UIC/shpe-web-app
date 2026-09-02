import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

/**
 * Segments that belong to the signed-out half of the app.
 *
 * useSegments() reports the root route as '', so that empty string is the login
 * screen — not a missing value.
 */
const AUTH_SEGMENTS = new Set(['', 'signup']);

function AuthGate() {
  const { user, loading, emailVerified, promptVerification } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Redirecting before the stored token has been checked would bounce a
    // signed-in member to the login screen on every cold start.
    if (loading) return;

    const first = segments[0] ?? '';
    const isAuthScreen = AUTH_SEGMENTS.has(first);
    const isVerifyScreen = first === 'verify-email';

    if (!user && !isAuthScreen) {
      router.replace('/');
    } else if (user && isAuthScreen) {
      // Unverified members are members: the API no longer refuses them, so
      // there is nothing to protect them from. The verification screen is a
      // prompt shown once after registering, not a room they are locked in —
      // it cost two people their access the last two times it was. See
      // docs/EMAIL-DELIVERY.md.
      router.replace(promptVerification && !emailVerified ? '/verify-email' : '/(tabs)/home');
    } else if (user && emailVerified && isVerifyScreen) {
      // Verified while sitting on it; nothing left to do there.
      router.replace('/(tabs)/home');
    }
  }, [user, loading, emailVerified, promptVerification, segments, router]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.navy} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Only routes that actually have a file. Registering one that does not
          makes expo-router warn on every navigation. */}
      <Stack.Screen name="index" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="verify-email" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="organizer/[eventId]" />
      <Stack.Screen name="announcements" />
      <Stack.Screen name="admin/announcement" />
      <Stack.Screen name="admin/event" />
      <Stack.Screen name="admin/attendance" />
      <Stack.Screen name="admin/members" />
      <Stack.Screen name="admin/member" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
