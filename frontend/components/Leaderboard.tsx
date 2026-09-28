import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, shadow } from '../constants/theme';
import type { Leader } from '../lib/api/types';
import { Avatar } from './Avatar';

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st. */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

type LeaderboardProps = {
  leaders: Leader[] | null;
  loading: boolean;
  error: Error | null;
};

/**
 * The top five on the home screen: place, picture, name, points.
 *
 * Nothing here is pressable, on purpose — a name and a picture is all a member
 * gets to see of anyone else, and the API sends nothing that could lead
 * further. Each row reads as one sentence to a screen reader rather than four
 * fragments.
 */
export function Leaderboard({ leaders, loading, error }: LeaderboardProps) {
  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator testID="leaderboard-loading" color={colors.navy} />
      </View>
    );
  }

  if (error || !leaders) {
    return (
      <View style={styles.card}>
        <Text style={styles.empty}>Couldn&apos;t load the leaderboard.</Text>
      </View>
    );
  }

  if (leaders.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.empty}>No points yet — check in at an event to get on the board.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card} role="list" aria-label="Leaderboard">
      {leaders.map((leader, index) => (
        <View
          // Names can repeat and ranks do on a tie; position is the identity.
          key={index}
          role="listitem"
          aria-label={`${ordinal(leader.rank)} place, ${leader.name}, ${leader.points} points`}
          style={[styles.row, index > 0 && styles.rowDivided]}
        >
          <View style={[styles.rankTile, leader.rank === 1 && styles.rankTileFirst]}>
            <Text style={[styles.rank, leader.rank === 1 && styles.rankFirst]}>{leader.rank}</Text>
          </View>
          <Avatar name={leader.name} url={leader.avatarUrl} size={34} />
          <Text style={styles.name} numberOfLines={1}>
            {leader.name}
          </Text>
          <Text style={styles.points}>{`${leader.points} pts`}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 15,
    ...shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 9,
  },
  rowDivided: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  rankTile: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankTileFirst: {
    backgroundColor: colors.orangeDark,
  },
  rank: {
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.text,
  },
  rankFirst: {
    color: colors.surface,
  },
  name: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.text,
  },
  points: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.orangeDark,
  },
  empty: {
    fontSize: 12.5,
    color: colors.textSubtle,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
