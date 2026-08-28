import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import PageHeader from '../components/PageHeader';
import { colors, shadow } from '../constants/theme';
import { accentColor, formatRelativeTime, useAnnouncements } from '../lib/announcements';

export default function AnnouncementsScreen() {
  const router = useRouter();
  const { announcements, error, loading, refreshing, refresh } = useAnnouncements();

  return (
    <View style={styles.screen}>
      <PageHeader
        title="Announcements"
        subtitle={
          loading
            ? 'Loading…'
            : `${announcements?.length ?? 0} ${announcements?.length === 1 ? 'post' : 'posts'}`
        }
        backLabel="Back"
        onBack={() => router.back()}
      />

      {loading ? (
        <ActivityIndicator style={styles.centered} color={colors.navy} />
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={34} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Couldn&apos;t load announcements</Text>
          <Text style={styles.emptyBody}>{error.message}</Text>
        </View>
      ) : !announcements || announcements.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="megaphone-outline" size={34} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Nothing yet</Text>
          <Text style={styles.emptyBody}>Announcements from officers will appear here.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.navy} />
          }
        >
          {announcements.map((a) => (
            <View key={a.id} style={styles.card}>
              <View style={[styles.cardAccent, { backgroundColor: accentColor(a) }]} />
              <View style={styles.cardContent}>
                <View style={styles.cardHeadRow}>
                  <Text style={styles.cardTitle}>{a.title}</Text>
                  {/* Officers see their own drafts in this list; members never do. */}
                  {a.publishedAt === null ? (
                    <View style={styles.draftChip}>
                      <Text style={styles.draftText}>Draft</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.cardBody}>{a.body}</Text>
                <Text style={styles.cardTime}>{formatRelativeTime(a.publishedAt)}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  list: {
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 30,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginTop: 6,
  },
  emptyBody: {
    fontSize: 12.5,
    color: colors.textSubtle,
    textAlign: 'center',
    lineHeight: 19,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    ...shadow.card,
  },
  cardAccent: {
    width: 5,
    borderRadius: 4,
  },
  cardContent: {
    flex: 1,
  },
  cardHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.navy,
  },
  draftChip: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(253,101,47,0.14)',
  },
  draftText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.orangeDark,
  },
  cardBody: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 4,
  },
  cardTime: {
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 7,
  },
});
