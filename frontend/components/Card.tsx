// card styling for consitency

import { View, StyleSheet, ViewProps } from 'react-native';
import { colors, radius, shadow } from '../constants/theme';

export default function Card({ children, style, ...props }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 18,
    marginBottom: 14,
    ...shadow.card,
  },
});
