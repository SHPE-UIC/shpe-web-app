import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { apiFetch } from './api/client';
import type { PublicEvent } from './api/types';

export type CheckInResult = {
  id: string;
  eventId: string;
  eventName: string;
  points: number;
  createdAt: string;
};

/** Records attendance from a scanned QR payload. */
export function submitCheckIn(token: string) {
  return apiFetch<{ checkIn: CheckInResult }>('/api/check-ins', {
    method: 'POST',
    body: { token },
  }).then((data) => data.checkIn);
}

/**
 * A fresh check-in code for an event. Admin only.
 *
 * `expiresIn` is seconds; the organizer screen re-fetches on that cadence so
 * the displayed code is never stale enough to be useful away from the room.
 */
export function fetchCheckinToken(eventId: string) {
  return apiFetch<{ token: string; expiresIn: number; event: PublicEvent }>(
    `/api/events/${eventId}/checkin-token`,
  );
}

export type CheckInTotals = { events: number; points: number };

/** The signed-in member's own attendance, with running totals. */
export function useMyCheckIns() {
  const [checkIns, setCheckIns] = useState<CheckInResult[] | null>(null);
  const [totals, setTotals] = useState<CheckInTotals | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ checkIns: CheckInResult[]; totals: CheckInTotals }>(
        '/api/check-ins/me',
      );
      setCheckIns(data.checkIns);
      setTotals(data.totals);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Could not load your check-ins'));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { checkIns, totals, error, loading: checkIns === null && !error, refresh: load };
}
