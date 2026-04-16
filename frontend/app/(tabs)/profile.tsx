import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';

const RED = '#c0392b';

const ProfileScreen = () => {
  const router = useRouter();
  const { user, profile, profileLoading, logout } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [eventsAttended, setEventsAttended] = useState(0);

  useEffect(() => {
    if (!user) {
      setEventsAttended(0);
      return;
    }

    const fetchCheckIns = async () => {
      try {
        const checkInsQuery = query(
          collection(db, 'checkIns'),
          where('userId', '==', user.uid),
        );
        const snapshot = await getDocs(checkInsQuery);
        setEventsAttended(snapshot.size);
      } catch (error) {
        console.error('Error fetching check-ins:', error);
      }
    };
    fetchCheckIns();
  }, [user]);

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const roleLine =
    [profile?.schoolLevel, profile?.memberId && `ID ${profile.memberId}`]
      .filter(Boolean)
      .join(' · ') || 'Member';

  const detailRows: { icon: any; label: string; value: string }[] = [
    { icon: 'calendar-outline', label: 'Age', value: profile?.age != null ? String(profile.age) : '—' },
    { icon: 'male-female-outline', label: 'Sex assigned at birth', value: profile?.sexAtBirth ?? '—' },
    { icon: 'person-outline', label: 'Gender', value: profile?.gender || '—' },
    { icon: 'school-outline', label: 'School level', value: profile?.schoolLevel ?? '—' },
    { icon: 'card-outline', label: 'Member ID', value: profile?.memberId || '—' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#f2f2f7" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.card}>
          {profileLoading ? (
            <ActivityIndicator size="large" color={RED} />
          ) : (
            <>
              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={36} color="#fff" />
                </View>
              </View>
              <Text style={styles.userName}>{profile?.name ?? 'Member'}</Text>
              <Text style={styles.userRole}>{roleLine}</Text>
              <Text style={styles.userEmail}>{user?.email ?? ''}</Text>
              {profile?.isAdmin ? (
                <View style={styles.adminBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#fff" />
                  <Text style={styles.adminBadgeText}>Organizer</Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="calendar-clear" size={20} color={RED} />
            </View>
            <Text style={styles.statNumber}>{eventsAttended}</Text>
            <Text style={styles.statLabel}>Events{'\n'}Attended</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="trophy" size={20} color={RED} />
            </View>
            <Text style={styles.statNumber}>{eventsAttended * 20}</Text>
            <Text style={styles.statLabel}>Points{'\n'}Earned</Text>
          </View>
        </View>

        {/* Details */}
        <Text style={styles.settingsTitle}>Details</Text>
        <View style={[styles.card, styles.settingsCard]}>
          {detailRows.map((row, idx) => (
            <React.Fragment key={row.label}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <View style={styles.settingIconWrap}>
                    <Ionicons name={row.icon} size={22} color="#555" />
                  </View>
                  <Text style={styles.settingLabel}>{row.label}</Text>
                </View>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {row.value}
                </Text>
              </View>
              {idx < detailRows.length - 1 ? <View style={styles.divider} /> : null}
            </React.Fragment>
          ))}
        </View>

        {/* Settings Section */}
        <Text style={styles.settingsTitle}>Settings</Text>
        <View style={[styles.card, styles.settingsCard]}>
          {/* Edit Profile */}
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/edit-profile')}
          >
            <View style={styles.settingLeft}>
              <View style={styles.settingIconWrap}>
                <Ionicons name="create-outline" size={22} color="#555" />
              </View>
              <Text style={styles.settingLabel}>Edit Profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#bbb" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Notifications */}
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIconWrap}>
                <Ionicons name="notifications-outline" size={22} color="#555" />
              </View>
              <Text style={styles.settingLabel}>Notifications</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#ccc', true: RED }}
              thumbColor="#fff"
              ios_backgroundColor="#ccc"
            />
          </View>

          <View style={styles.divider} />

          {/* Privacy */}
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIconWrap}>
                <Ionicons name="lock-closed-outline" size={22} color="#555" />
              </View>
              <Text style={styles.settingLabel}>Privacy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#bbb" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Sign Out */}
          <TouchableOpacity style={styles.settingRow} onPress={handleSignOut}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIconWrap}>
                <Ionicons name="log-out-outline" size={22} color={RED} />
              </View>
              <Text style={[styles.settingLabel, styles.signOutLabel]}>Sign Out</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#bbb" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f2f2f7',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Shared card
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
  },

  // Profile
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 2,
  },
  userRole: {
    fontSize: 14,
    color: '#888',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: '#888',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B2A6B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    gap: 4,
  },
  adminBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 24,
    overflow: 'hidden',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 18,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff0f0',
    borderWidth: 2,
    borderColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#777',
    textAlign: 'center',
    lineHeight: 16,
  },

  // Settings
  settingsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  settingsCard: {
    alignItems: 'stretch',
    padding: 0,
    paddingHorizontal: 16,
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
    flex: 1,
  },
  settingIconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 15,
    color: '#111',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#555',
    maxWidth: 160,
    textAlign: 'right',
  },
  signOutLabel: {
    color: RED,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e5e5',
    marginLeft: 44,
  },
});

export default ProfileScreen;
