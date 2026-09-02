import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import AuthLayout, { AuthError, AuthFooter, AuthSubmit } from '../components/AuthLayout';
import { colors } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../lib/api/client';

/**
 * The nudge to verify, shown once right after registering.
 *
 * Not a gate. The API does not refuse unverified members, so nothing here is
 * load-bearing — it exists because the moment someone finishes signing up is
 * the one moment they are certainly thinking about the address they typed.
 * Skipping is a first-class option, deliberately: while mail to uic.edu is
 * unreliable, trapping people here punishes them for our delivery problem
 * rather than their inaction. See docs/EMAIL-DELIVERY.md.
 */
export default function VerifyEmailScreen() {
  const { user, logout, resendVerification, recheckVerification, verificationEmailSent, dismissVerificationPrompt } =
    useAuth();
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleContinue = async () => {
    setError(null);
    setNotice(null);
    setIsChecking(true);
    try {
      const verified = await recheckVerification();
      // When it is verified, AuthGate reacts to the new state and moves to the
      // tabs — navigating from here as well would race it.
      if (!verified) {
        setError('That address is still unverified. Open the link in the email, then try again.');
      }
    } catch {
      setError('Could not check just now. Try again in a moment.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleResend = async () => {
    if (isResending) return;

    setError(null);
    setNotice(null);
    setIsResending(true);
    try {
      await resendVerification();
      setNotice('Sent. It can take a minute to arrive — check your spam folder too.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the email. Try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleSkip = () => {
    dismissVerificationPrompt();
    router.replace('/(tabs)/home');
  };

  return (
    <AuthLayout title={'Verify\nYour Email'}>
      {/* Only claim a link was sent when one actually was. Saying it anyway
          sends a member off to wait on an email that never left, and that
          silence is what made a failed send impossible to spot from the app. */}
      {verificationEmailSent === false ? (
        <Text style={styles.body}>
          We could not send the link to{' '}
          <Text style={styles.address}>{user?.email ?? 'your address'}</Text> automatically. Tap
          Resend email below to try again.
        </Text>
      ) : (
        <Text style={styles.body}>
          We sent a link to <Text style={styles.address}>{user?.email ?? 'your address'}</Text>.
          Open it, then come back here. You can use the app either way.
        </Text>
      )}

      <AuthError message={error} />
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <AuthSubmit label="I've verified" onPress={handleContinue} loading={isChecking} />

      <AuthFooter
        prompt="Didn't get it?"
        action={isResending ? 'Sending…' : 'Resend email'}
        onPress={handleResend}
      />

      <AuthFooter prompt="Not now?" action="Skip for now" onPress={handleSkip} />

      <AuthFooter prompt="Wrong address?" action="Sign out" onPress={() => void logout()} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    marginBottom: 24,
  },
  address: {
    color: colors.text,
    fontWeight: '600',
  },
  notice: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.blue,
    marginBottom: 12,
  },
});
