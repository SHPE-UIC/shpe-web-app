import { Stack } from 'expo-router';

export default function EventsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#001E62' },
        headerTintColor: '#fff',
        headerBackTitle: 'Back to Events',
        headerTitleStyle: { 
          fontWeight: 700, 
          fontSize: 28,
          color: '#D50032',
        },
      }}
    />
  );
}