// Form controls for the officer screens.
//
// AuthLayout has its own field components, but those are styled for the auth
// hero — full-bleed on white, bottom-rule only. These sit inside cards on the
// app background and need their own treatment, so the two are kept separate
// rather than one being bent to cover both.

import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, shadow } from '../constants/theme';

export function FormCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function FormField({
  label,
  hint,
  error,
  ...inputProps
}: { label: string; hint?: string; error?: string | null } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          inputProps.multiline ? styles.inputMultiline : null,
          error ? styles.inputError : null,
        ]}
        placeholderTextColor="#c3cad8"
        {...inputProps}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

/** A label wrapped around something that is not a TextInput. */
export function FormGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/** Two fields on one row, for a date and its time. */
export function FormRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle" size={16} color={colors.orangeDark} />
      <Text style={styles.errorBoxText}>{message}</Text>
    </View>
  );
}

export function FormNotice({ message }: { message: string }) {
  return (
    <View style={styles.noticeBox}>
      <Ionicons name="information-circle" size={16} color={colors.blue} />
      <Text style={styles.noticeText}>{message}</Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.primary, (loading || disabled) && styles.primaryDisabled]}
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.primaryText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

export function DangerButton({
  label,
  onPress,
  loading,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.danger}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.85}
    >
      <Text style={styles.dangerText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 18,
    gap: 16,
    ...shadow.card,
  },
  field: {
    gap: 7,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#8a94a6',
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14.5,
    color: colors.navy,
    backgroundColor: colors.surface,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.orangeDark,
  },
  hint: {
    fontSize: 11.5,
    color: colors.textFaint,
  },
  error: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.orangeDark,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(211,58,2,0.09)',
  },
  errorBoxText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.orangeDark,
    fontWeight: '600',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(0,112,192,0.09)',
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#1d4f7c',
  },
  primary: {
    paddingVertical: 14,
    borderRadius: radius.pill - 2,
    backgroundColor: colors.navy,
    alignItems: 'center',
  },
  primaryDisabled: {
    opacity: 0.6,
  },
  primaryText: {
    color: colors.surface,
    fontSize: 14.5,
    fontWeight: '700',
  },
  danger: {
    paddingVertical: 13,
    borderRadius: radius.pill - 2,
    borderWidth: 1.5,
    borderColor: colors.orangeDark,
    alignItems: 'center',
  },
  dangerText: {
    color: colors.orangeDark,
    fontSize: 14,
    fontWeight: '700',
  },
});
