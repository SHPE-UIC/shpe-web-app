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
  const { user, loading, emailVerified } = useAuth();
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
    } else if (user && !emailVerified && !isVerifyScreen) {
      // Signed in, but the API answers 403 for everything except /me until the
      // link is clicked. Every other screen would render as a wall of errors.
      router.replace('/verify-email');
    } else if (user && emailVerified && (isAuthScreen || isVerifyScreen)) {
      router.replace('/(tabs)/home');
    }
  }, [user, loading, emailVerified, segments, router]);

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
