import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SegmentedControlProps<T extends string> {
  options: readonly T[];
  value: T | undefined;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const selected = opt === value;
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => onChange(opt)}
            style={[styles.pill, selected && styles.pillSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {opt}
            </Text>
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
    marginBottom: 15,
    gap: 8,
  },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#3a3f47',
    borderWidth: 1,
    borderColor: '#3a3f47',
  },
  pillSelected: {
    backgroundColor: '#D50032',
    borderColor: '#D50032',
  },
  label: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '600',
  },
  labelSelected: {
    color: '#fff',
  },
});
