import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, shadow } from '../constants/theme';
import { ApiError } from '../lib/api/client';
import { setRsvp } from '../lib/rsvp';
import { useHasPassed } from '../lib/useHasPassed';

type RsvpButtonProps = {
  eventId: string;
  startsAt: Date;
  /** The signed-in member's current answer, from GET /api/events/:id. */
  going: boolean;
  onChange: (going: boolean) => void;
};

/**
 * The member's own RSVP to one event: RSVP, or "You're going" with a way to
 * take it back. Closed once the event starts, matching the server, which
 * refuses both then — including on a screen left open across the start, which
 * closes on time, or at the latest when the server says so.
 *
 * Nothing here says who else is going or how many — that is for officers.
 */
export function RsvpButton({ eventId, startsAt, going, onChange }: RsvpButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useHasPassed(startsAt);
  // The server's clock is the one that counts; a device running slow can
  // still offer the button after it has closed.
  const [refused, setRefused] = useState(false);

  if (started || refused) {
    return (
      // Plain status text, not a disabled control: nothing here was ever
      // pressable, and aria-disabled on a view with no role says nothing.
      <View style={[styles.button, styles.closed]}>
        <Text style={styles.closedText}>{going ? "You RSVP'd · RSVPs closed" : 'RSVPs closed'}</Text>
      </View>
    );
  }

  const answer = async (next: boolean) => {
    setPending(true);
    setError(null);
    try {
      onChange(await setRsvp(eventId, next));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'rsvp_closed') setRefused(true);
      else setError(err instanceof Error ? err.message : 'Could not save your RSVP.');
    } finally {
      setPending(false);
    }
  };

  return (
    <View>
      {going ? (
        <View style={[styles.button, styles.going]}>
          <Ionicons name="checkmark-circle" size={19} color={colors.tealDark} />
          <Text style={styles.goingText}>You&apos;re going</Text>
          <TouchableOpacity
            accessibilityRole="button"
            aria-label="Cancel RSVP"
            aria-busy={pending}
            disabled={pending}
            onPress={() => void answer(false)}
            style={styles.cancel}
            activeOpacity={0.7}
          >
            {pending ? (
              <ActivityIndicator color={colors.orangeDark} />
            ) : (
              <Text style={styles.cancelText}>Cancel RSVP</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          accessibilityRole="button"
          aria-label="RSVP"
          aria-busy={pending}
          disabled={pending}
          onPress={() => void answer(true)}
          style={[styles.button, styles.rsvp]}
          activeOpacity={0.85}
        >
          {pending ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.rsvpText}>RSVP</Text>
          )}
        </TouchableOpacity>
      )}
      {error ? (
        <Text style={styles.error} role="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: radius.pill - 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  // orangeDark rather than the brand orange: white on #FD652F is under 3:1.
  rsvp: {
    backgroundColor: colors.orangeDark,
    ...shadow.accent,
  },
  rsvpText: {
    color: colors.surface,
    fontSize: 14.5,
    fontWeight: '700',
  },
  going: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.tealDark,
    paddingLeft: 16,
    gap: 8,
    justifyContent: 'flex-start',
  },
  goingText: {
    flex: 1,
    color: colors.text,
    fontSize: 14.5,
    fontWeight: '700',
  },
  cancel: {
    paddingHorizontal: 16,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  cancelText: {
    color: colors.orangeDark,
    fontSize: 13,
    fontWeight: '700',
  },
  closed: {
    backgroundColor: colors.divider,
  },
  closedText: {
    color: colors.textSubtle,
    fontSize: 13.5,
    fontWeight: '700',
  },
  error: {
    color: colors.orangeDark,
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
});
