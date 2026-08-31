// shared shell for the sign in / create account screens: branded hero card + form body

import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import shpeLogo from '../assets/images/shpe_logo.png';

type AuthLayoutProps = {
  /** rendered in the hero, use \n to break onto a second line */
  title: string;
  onBack?: () => void;
  children: React.ReactNode;
};

export default function AuthLayout({ title, onBack, children }: AuthLayoutProps) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* hero runs under the status bar, so its icons need to be light */}
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero: orange field, teal accent circle, and the navy blob layered on top.
            Shapes live outside the padded layer so they can reach the screen edges. */}
        <View style={[styles.hero, { height: 300 + insets.top }]}>
          <View style={styles.heroCircle} />
          <View style={styles.heroBlob} />

          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>{title}</Text>
          </View>

          {onBack ? (
            <TouchableOpacity
              style={[styles.heroBack, { top: insets.top + 16 }]}
              onPress={onBack}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={18} color="#fff" />
            </TouchableOpacity>
          ) : null}

          <View style={[styles.heroLogoTile, { top: insets.top + 16 }]}>
            <Image source={shpeLogo} style={styles.heroLogo} resizeMode="contain" />
          </View>
        </View>

        <View style={styles.body}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function AuthField({
  label,
  error,
  ...inputProps
}: { label: string; error?: string | null } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        placeholderTextColor="#c3cad8"
        {...inputProps}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

/**
 * AuthField's label styling wrapped around arbitrary children.
 *
 * AuthField is typed `{ label } & TextInputProps`, so it cannot host a
 * SegmentedControl. This reuses the established look rather than introducing a
 * second way for a labelled control to appear on these screens.
 */
export function AuthFieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

/** Form-level error banner, for failures that belong to no single field. */
export function AuthError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle" size={16} color={colors.orangeDark} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function AuthSubmit({
  label,
  onPress,
  loading,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <View style={styles.submitRow}>
      <Text style={styles.submitLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.submitButton}
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        )}
      </TouchableOpacity>
    </View>
  );
}

export function AuthFooter({
  prompt,
  action,
  onPress,
}: {
  prompt: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.footerRow}>
      <Text style={styles.footerText}>{prompt} </Text>
      <TouchableOpacity onPress={onPress}>
        <Text style={styles.footerLink}>{action}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },

  // Hero — full bleed to the screen edges
  hero: {
    backgroundColor: colors.orange,
    overflow: 'hidden',
  },
  heroContent: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 28,
    paddingBottom: 44,
  },
  heroCircle: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.teal,
    left: 8,
    bottom: 58,
  },
  // navy shape with an oversized corner radius to mimic the curved blob edge
  heroBlob: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 58,
    backgroundColor: colors.navy,
    borderTopLeftRadius: 170,
    borderBottomLeftRadius: 110,
  },
  heroBack: {
    position: 'absolute',
    left: 22,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLogoTile: {
    position: 'absolute',
    right: 22,
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLogo: {
    width: 24,
    height: 24,
  },
  heroTitle: {
    color: colors.surface,
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 41,
  },

  // Form
  body: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 30,
    gap: 22,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    color: '#8a94a6',
  },
  input: {
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 2,
    fontSize: 15,
    color: colors.navy,
  },
  inputError: {
    borderBottomColor: colors.orangeDark,
  },
  fieldError: {
    fontSize: 12,
    color: colors.orangeDark,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(211,58,2,0.09)',
  },
  errorText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.orangeDark,
    fontWeight: '600',
  },
  submitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  submitLabel: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.navy,
  },
  submitButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#8a94a6',
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.navy,
  },
});
