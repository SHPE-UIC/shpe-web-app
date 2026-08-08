import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack>
        {/*  Login Screen */}
       <Stack.Screen
          name="index"
          options={{ headerShown: false }}
        />
        {/*  Create Account Screen */}
        <Stack.Screen
          name="signup"
          options={{ headerShown: false }}
        />
        {/*  Main App (Tabs) */}
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}