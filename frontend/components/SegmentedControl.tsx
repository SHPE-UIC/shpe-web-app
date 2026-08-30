import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '../constants/theme';

type SegmentedControlProps<T extends string> = {
  options: readonly T[];
  value: T | undefined;
  onChange: (value: T) => void;
};

/**
 * Pill picker for the short enumerated profile fields. Wraps onto a second row
 * rather than scrolling, so every option stays visible on a narrow screen.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <TouchableOpacity
            key={option}
            onPress={() => onChange(option)}
            style={[styles.pill, selected && styles.pillSelected]}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{option}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  pill: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  pillSelected: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSubtle,
  },
  labelSelected: {
    color: colors.surface,
  },
});
