// Marks a control that is deliberately present but not built yet.
//
// The app's design was drawn before the data behind it existed, so several
// controls were laid out for features that do not work. Rather than quietly
// leaving them tappable — which reads as broken — they are disabled and
// labelled. One component so the treatment is consistent, and so `ComingSoon`
// greps to a complete list of what is still owed.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../constants/theme';

function ComingSoonBadge({ label = 'Coming soon' }: { label?: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

/**
 * Wraps a control so it is visibly inert: dimmed, non-interactive, and badged.
 * `pointerEvents="none"` is what actually stops the tap — a disabled prop on
 * the child would still leave nested pressables live.
 */
export function ComingSoon({
  children,
  label,
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.dimmed} pointerEvents="none">
        {children}
      </View>
      <ComingSoonBadge label={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dimmed: {
    flex: 1,
    opacity: 0.45,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.divider,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: colors.textSubtle,
    textTransform: 'uppercase',
  },
});
