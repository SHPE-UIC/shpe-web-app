import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { FormError, FormNotice, PrimaryButton } from '../../components/FormField';
import PageHeader from '../../components/PageHeader';
import { colors, radius, shadow } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { ApiError, apiFetch } from '../../lib/api/client';
import { useMembers } from '../../lib/adminStats';
import { ROLE, ROLE_DESCRIPTION, ROLE_LABEL, isTop8, type Role } from '../../lib/roles';
import { useGoBack } from '../../lib/useGoBack';

const LEVELS: Role[] = [ROLE.MEMBER, ROLE.BOARD, ROLE.TOP8];

/** Set one member's level. Top 8 only. */
export default function MemberRoleScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const goBack = useGoBack('/admin/members');
  const canManage = isTop8(user?.role);

  const { data, refresh } = useMembers(canManage);
  const member = useMemo(
    () => data?.members.find((m) => m.id === id),
    [data, id],
  );

  const [selected, setSelected] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (member && selected === null) setSelected(member.role);
  }, [member, selected]);

  const isSelf = member?.id === user?.id;

  const save = async () => {
    if (!member || selected === null) return;
    setError(null);
    setSaving(true);

    try {
      await apiFetch(`/api/admin/members/${member.id}/role`, {
        method: 'PATCH',
        body: { role: selected },
      });
      await refresh();
      goBack();
    } catch (err) {
      setSaving(false);
      setError(err instanceof ApiError ? err.message : 'Could not change the level.');
    }
  };

  if (user && !canManage) {
    return (
      <View style={styles.screen}>
        <PageHeader title="Member" backLabel="Back" onBack={goBack} />
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={34} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Top 8 only</Text>
          <Text style={styles.emptyBody}>Only the Top 8 can change what level a member has.</Text>
        </View>
      </View>
    );
  }

  if (!member) {
    return (
      <View style={styles.screen}>
        <PageHeader title="Member" backLabel="Back" onBack={goBack} />
        <ActivityIndicator style={styles.centered} color={colors.navy} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <PageHeader title={member.name} subtitle={member.email} backLabel="Back" onBack={goBack} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.identity}>
          <Avatar name={member.name} url={member.avatarUrl} size={56} />
        </View>

        <FormError message={error} />

        {/* The server refuses this too; saying so up front beats a 403 later. */}
        {isSelf ? (
          <FormNotice message="This is your own account. Levels can only be changed by another Top 8, so that nobody can accidentally remove their own access." />
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Level</Text>

          {LEVELS.map((level) => {
            const active = selected === level;
            return (
              <TouchableOpacity
                key={level}
                style={[styles.option, active && styles.optionActive]}
                onPress={() => setSelected(level)}
                disabled={isSelf || saving}
                activeOpacity={0.85}
              >
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={styles.optionBody}>
                  <Text style={[styles.optionLabel, isSelf && styles.optionDisabled]}>
                    {ROLE_LABEL[level]}
                  </Text>
                  <Text style={styles.optionHint}>{ROLE_DESCRIPTION[level]}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <PrimaryButton
          label={selected === member.role ? 'No change' : `Make ${ROLE_LABEL[selected ?? member.role]}`}
          onPress={save}
          loading={saving}
          disabled={isSelf || selected === member.role}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  identity: { alignItems: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 30 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 6 },
  emptyBody: { fontSize: 12.5, color: colors.textSubtle, textAlign: 'center', lineHeight: 19 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 16,
    gap: 10,
    ...shadow.card,
  },
  cardTitle: { fontSize: 12.5, fontWeight: '600', color: '#8a94a6' },

  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  optionActive: { borderColor: colors.navy, backgroundColor: 'rgba(0,31,91,0.04)' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  radioActive: { borderColor: colors.navy },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.navy },
  optionBody: { flex: 1, gap: 3 },
  optionLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  optionDisabled: { color: colors.textFaint },
  optionHint: { fontSize: 11.5, color: colors.textSubtle, lineHeight: 17 },
});
