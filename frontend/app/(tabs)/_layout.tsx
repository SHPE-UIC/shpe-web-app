import { Tabs } from 'expo-router';

import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadow } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { isBoardOrAbove } from '../../lib/roles';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// active tabs get an orange tile, inactive ones stay flat outlines. Both share the
// same box so every label sits on the same baseline.
function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return (
    <View style={[styles.tabIcon, focused && styles.activeTile]}>
      <Ionicons
        name={name}
        size={focused ? 21 : 22}
        color={focused ? '#fff' : colors.iconInactive}
      />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.iconInactive,
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          height: 78 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 8,
          ...shadow.card,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 4,
        },
      }}
    >

      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: ({ focused }) => <TabIcon name="calendar-clear" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="events-info/[id]"
        options={{
          title: 'Event Info',
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="check-in"
        options={{
          title: 'Check-In',
          tabBarIcon: ({ focused }) => <TabIcon name="scan" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          // href: null removes the tab for members. The route still exists, so
          // the screen and the API both check the role as well.
          href: isBoardOrAbove(user?.role) ? '/dashboard' : null,
          tabBarIcon: ({ focused }) => <TabIcon name="stats-chart" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTile: {
    backgroundColor: colors.orange,
    ...shadow.accent,
  },
});
