import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      {/*  Login Screen */}
     <Stack.Screen 
        name="index" 
        options={{ headerShown: false }} 
      />
      {/*  Main App (Tabs) */}
      <Stack.Screen 
        name="(tabs)" 
        options={{ headerShown: false }} 
      />
    </Stack>
  );
}