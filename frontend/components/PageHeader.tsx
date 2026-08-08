// the banner styling for the title, and optional subtitle and back button

import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, gradientEnd, gradientStart, headerGradient, radius } from '../constants/theme';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  /** shows a translucent chevron button above the title */
  backLabel?: string;
  onBack?: () => void;
  /** accessory pinned to the right of the title row, e.g. the logo tile */
  right?: React.ReactNode;
  /** extra content rendered under the title, e.g. the events filter chips */
  children?: React.ReactNode;
};

export default function PageHeader({
  title,
  subtitle,
  backLabel,
  onBack,
  right,
  children,
}: PageHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={headerGradient}
      start={gradientStart}
      end={gradientEnd}
      style={[styles.header, { paddingTop: insets.top + 16 }]}
    >
      {onBack ? (
        <TouchableOpacity style={styles.backRow} onPress={onBack} activeOpacity={0.7}>
          <View style={styles.backButton}>
            <Ionicons name="chevron-back" size={18} color="#fff" />
          </View>
          {backLabel ? <Text style={styles.backLabel}>{backLabel}</Text> : null}
        </TouchableOpacity>
      ) : null}

      <View style={styles.titleRow}>
        <View style={styles.titleColumn}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>

      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 22,
    paddingBottom: 26,
    borderBottomLeftRadius: radius.header,
    borderBottomRightRadius: radius.header,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '500',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleColumn: {
    flex: 1,
  },
  title: {
    color: colors.surface,
    fontSize: 23,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    marginTop: 4,
  },
});
