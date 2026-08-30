import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ComingSoon } from '../../components/ComingSoon';
import PageHeader from '../../components/PageHeader';
import { colors, gradientEnd, gradientStart, radius, shadow } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useMyCheckIns } from '../../lib/checkIns';

const ProfileScreen = () => {
  const { user, logout } = useAuth();
  const { totals, loading: statsLoading } = useMyCheckIns();

  return (
    <View style={styles.screen}>
      <PageHeader
        title="Profile"
        subtitle={user?.memberId ? `Member ID ${user.memberId}` : undefined}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <LinearGradient
            colors={[colors.orange, colors.orangeDark]}
            start={gradientStart}
            end={gradientEnd}
            style={styles.avatar}
          >
            <Ionicons name="person" size={34} color="#fff" />
          </LinearGradient>

          <Text style={styles.userName}>{user?.name ?? 'Member'}</Text>
          <View style={styles.roleChip}>
            <Text style={styles.roleText}>{user?.roleLabel ?? 'Member'}</Text>
          </View>
          <Text style={styles.userEmail}>{user?.email ?? ''}</Text>
        </View>

        {/* Stats Row. Both figures come from recorded check-ins. Points sum
            each row's snapshot rather than the event's current value, so
            re-tagging an event cannot change what someone already earned. */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, styles.navyTint]}>
              <Ionicons name="calendar-clear-outline" size={18} color={colors.navy} />
            </View>
            {statsLoading ? (
              <ActivityIndicator style={styles.statSpinner} color={colors.navy} />
            ) : (
              <Text style={styles.statNumber}>{totals?.events ?? 0}</Text>
            )}
            <Text style={styles.statLabel}>Events{'\n'}Attended</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, styles.orangeTint]}>
              <Ionicons name="trophy-outline" size={18} color={colors.orange} />
            </View>
            {statsLoading ? (
              <ActivityIndicator style={styles.statSpinner} color={colors.orange} />
            ) : (
              <Text style={styles.statNumber}>{totals?.points ?? 0}</Text>
            )}
            <Text style={styles.statLabel}>Points{'\n'}Earned</Text>
          </View>
        </View>

        {/* Settings Section */}
        <Text style={styles.settingsTitle}>Settings</Text>
        <View style={styles.settingsCard}>
          {/* Notifications */}
          <ComingSoon>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="notifications-outline" size={19} color="#5c6678" />
                <Text style={styles.settingLabel}>Notifications</Text>
              </View>
            </View>
          </ComingSoon>

          <View style={styles.divider} />

          {/* Privacy */}
          <ComingSoon>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="lock-closed-outline" size={19} color="#5c6678" />
                <Text style={styles.settingLabel}>Privacy</Text>
              </View>
            </View>
          </ComingSoon>

          <View style={styles.divider} />

          {/* Sign Out */}
          <TouchableOpacity style={styles.settingRow} onPress={logout}>
            <View style={styles.settingLeft}>
              <Ionicons name="log-out-outline" size={19} color={colors.orangeDark} />
              <Text style={[styles.settingLabel, styles.signOutLabel]}>Sign Out</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#c3cad8" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 32,
    // leaves room for the avatar that pokes out above the profile card
    paddingTop: 52,
  },

  // Profile card with the overlapping avatar
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    paddingTop: 52,
    paddingBottom: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    ...shadow.card,
  },
  avatar: {
    position: 'absolute',
    top: -38,
    width: 78,
    height: 78,
    borderRadius: 28,
    borderWidth: 4,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.accent,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  roleChip: {
    marginTop: 7,
    backgroundColor: 'rgba(0,112,192,0.12)',
    paddingVertical: 5,
    paddingHorizontal: 13,
    borderRadius: 16,
  },
  roleText: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 12.5,
    color: colors.textSubtle,
    marginTop: 9,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    ...shadow.card,
  },
  statIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navyTint: {
    backgroundColor: 'rgba(0,31,91,0.1)',
  },
  orangeTint: {
    backgroundColor: 'rgba(253,101,47,0.14)',
  },
  statSpinner: {
    height: 27,
    marginTop: 8,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSubtle,
    textAlign: 'center',
    lineHeight: 15,
  },

  // Settings
  settingsTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8b95a8',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginTop: 20,
    marginBottom: 9,
    marginLeft: 4,
  },
  settingsCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingHorizontal: 18,
    ...shadow.card,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    fontSize: 13.5,
    color: colors.text,
    fontWeight: '500',
  },
  signOutLabel: {
    color: colors.orangeDark,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginLeft: 31,
  },
});

export default ProfileScreen;
