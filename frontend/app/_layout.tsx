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
    } else if (user && isAuthScreen) {
      // Signing in goes straight to the app, verified or not. The API refuses
      // nobody on the claim, so there is nothing to hold anyone back for, and
      // interrupting every new member with a screen about an email that
      // currently does not arrive is friction with no payoff. The verification
      // screen still exists and still works; nothing routes to it
      // automatically. See docs/EMAIL-DELIVERY.md.
      router.replace('/(tabs)/home');
    } else if (user && emailVerified && isVerifyScreen) {
      // Verified while sitting on it; nothing left to do there.
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
