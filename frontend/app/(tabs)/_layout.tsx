import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../contexts/AuthContext';

export default function TabLayout() {
  const { profile } = useAuth();
  const isAdmin = profile?.isAdmin === true;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#D50032',
        headerStyle: {
          backgroundColor: '#25292e',
        },
        headerShadowVisible: false,
        headerTintColor: '#fff',
        tabBarStyle: {
          backgroundColor: '#25292e',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home-sharp' : 'home-outline'} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar-clear' : 'calendar-clear-outline'} color={color} size={24}/>
          ),
        }}
      />
      <Tabs.Screen
        name="check-in"
        options={{
          title: 'Check In',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'scan' : 'scan-outline'} color={color} size={24}/>
          ),
        }}
      />
      <Tabs.Screen
        name="organizer"
        options={{
          href: isAdmin ? '/organizer' : null,
          title: 'Organizer',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'} color={color} size={24}/>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} color={color} size={24}/>
          ),
        }}
      />
    </Tabs>
  );
}
