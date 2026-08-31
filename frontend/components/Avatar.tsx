import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

type AvatarProps = {
  name: string;
  /** Null until the member sets a picture. */
  url?: string | null;
  size: number;
  /** Rounding. Defaults to a circle. */
  borderRadius?: number;
};

/**
 * First and last initial — a middle name must not push the surname out, since
 * two members sharing a first name is exactly when the initials matter.
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';

  const first = words[0]![0]!;
  const last = words.length > 1 ? words[words.length - 1]![0]! : '';
  return (first + last).toUpperCase();
}

/**
 * A member's picture, or their initials when they have none. Everywhere a
 * member is listed uses this, so the fallback is consistent rather than each
 * screen inventing its own placeholder.
 */
export function Avatar({ name, url, size, borderRadius }: AvatarProps) {
  const shape = {
    width: size,
    height: size,
    borderRadius: borderRadius ?? size / 2,
  };

  if (url) {
    return (
      <Image
        testID="avatar-image"
        source={{ uri: url }}
        style={[styles.image, shape]}
        accessibilityLabel={`${name}'s profile picture`}
      />
    );
  }

  return (
    <View style={[styles.fallback, shape]}>
      <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initialsOf(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.divider,
  },
  fallback: {
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    fontWeight: '700',
  },
});
