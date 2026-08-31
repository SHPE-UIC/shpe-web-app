import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Avatar } from '../../components/Avatar';
import PageHeader from '../../components/PageHeader';
import { colors, radius, shadow } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useMembers } from '../../lib/adminStats';
import { ROLE, isBoardOrAbove, isTop8 } from '../../lib/roles';
import { useGoBack } from '../../lib/useGoBack';

/**
 * The member roster, most engaged first.
 *
 * Shows what an officer needs to run the chapter — who is a member, how to
 * reach them, and how involved they are. Age, sex at birth, and gender are
 * collected at signup but deliberately not sent to this screen.
 */
export default function MembersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const goBack = useGoBack('/(tabs)/dashboard');
  const isOfficer = isBoardOrAbove(user?.role);
  // Only a top 8 can change levels, so only they get tappable rows.
  const canManageRoles = isTop8(user?.role);

  const { data, error, loading, refreshing, refresh } = useMembers(isOfficer);
  const [query, setQuery] = useState('');

  // Memoised because the ?? [] fallback would otherwise be a fresh array on
  // every render, making the filter below recompute each time.
  const members = useMemo(() => data?.members ?? [], [data]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(needle) ||
        m.email.toLowerCase().includes(needle) ||
        (m.memberId ?? '').toLowerCase().includes(needle),
    );
  }, [members, query]);

  if (user && !isOfficer) {
    return (
      <View style={styles.screen}>
        <PageHeader title="Members" backLabel="Back" onBack={goBack} />
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={34} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Board members only</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <PageHeader
        title="Members"
        subtitle={
          loading
            ? 'Loading…'
            : canManageRoles
              ? `${members.length} registered · tap to change a level`
              : `${members.length} registered`
        }
        backLabel="Back"
        onBack={goBack}
      />

      {loading ? (
        <ActivityIndicator style={styles.centered} color={colors.navy} />
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={34} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Couldn&apos;t load members</Text>
          <Text style={styles.emptyBody}>{error.message}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.navy} />
          }
        >
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={colors.textFaint} />
            <TextInput
              style={styles.search}
              placeholder="Search name, email, or member ID"
              placeholderTextColor="#c3cad8"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
            />
          </View>

          {visible.length === 0 ? (
            <Text style={styles.emptyInline}>
              {members.length === 0 ? 'Nobody has registered yet.' : 'No members match that.'}
            </Text>
          ) : (
            visible.map((member) => (
              <TouchableOpacity
                key={member.id}
                style={styles.row}
                activeOpacity={canManageRoles ? 0.85 : 1}
                disabled={!canManageRoles}
                onPress={() =>
                  router.push({ pathname: '/admin/member', params: { id: member.id } })
                }
              >
                <Avatar name={member.name} url={member.avatarUrl} size={36} />
                <View style={styles.rowBody}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {member.name}
                    </Text>
                    {member.role > ROLE.MEMBER ? (
                      <View
                        style={[
                          styles.officerChip,
                          member.role >= ROLE.TOP8 && styles.topEightChip,
                        ]}
                      >
                        <Text
                          style={[
                            styles.officerText,
                            member.role >= ROLE.TOP8 && styles.topEightText,
                          ]}
                        >
                          {member.roleLabel}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.email} numberOfLines={1}>
                    {member.email}
                  </Text>
                  <Text style={styles.meta}>
                    {[
                      member.schoolLevel,
                      member.memberId ? `ID ${member.memberId}` : null,
                      `joined ${new Date(member.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric',
                      })}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>

                <View style={styles.stats}>
                  <Text style={styles.statValue}>{member.eventsAttended}</Text>
                  <Text style={styles.statLabel}>events</Text>
                  <Text style={styles.statPoints}>{member.pointsEarned} pts</Text>
                </View>

                {canManageRoles ? (
                  <Ionicons name="chevron-forward" size={16} color="#c3cad8" />
                ) : null}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 32, gap: 10 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 30 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 6 },
  emptyBody: { fontSize: 12.5, color: colors.textSubtle, textAlign: 'center', lineHeight: 19 },
  emptyInline: { fontSize: 12.5, color: colors.textSubtle, textAlign: 'center', paddingVertical: 20 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 4,
    ...shadow.card,
  },
  search: { flex: 1, fontSize: 13.5, color: colors.navy },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    ...shadow.card,
  },
  rowBody: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 13.5, fontWeight: '700', color: colors.text, flexShrink: 1 },
  officerChip: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 9,
    backgroundColor: 'rgba(0,112,192,0.12)',
  },
  officerText: { fontSize: 9.5, fontWeight: '700', color: colors.blue },
  topEightChip: { backgroundColor: 'rgba(253,101,47,0.16)' },
  topEightText: { color: colors.orangeDark },
  email: { fontSize: 11.5, color: colors.textSubtle },
  meta: { fontSize: 10.5, color: colors.textFaint },

  stats: { alignItems: 'flex-end', gap: 1 },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.navy },
  statLabel: { fontSize: 10, color: colors.textFaint },
  statPoints: { fontSize: 10.5, fontWeight: '700', color: colors.orange, marginTop: 3 },
});
