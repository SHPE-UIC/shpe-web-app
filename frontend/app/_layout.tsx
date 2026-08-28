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
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Redirecting before the stored token has been checked would bounce a
    // signed-in member to the login screen on every cold start.
    if (loading) return;

    const isAuthScreen = AUTH_SEGMENTS.has(segments[0] ?? '');

    if (!user && !isAuthScreen) {
      router.replace('/');
    } else if (user && isAuthScreen) {
      router.replace('/(tabs)/home');
    }
  }, [user, loading, segments, router]);

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
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="organizer/[eventId]" />
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
