import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { colors } from '../constants/theme';
import { ApiError, apiFetch } from './api/client';
import type { PublicEvent } from './api/types';

export type ShpeEvent = {
  id: string;
  name: string;
  tag: string;
  description: string;
  location: string;
  points: number;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  source: string;
};

/**
 * The API sends real ISO instants, so this is a straight parse.
 *
 * The Firestore version had to reconstruct dates from display strings like
 * "01/15/2026" and "6:00 PM" with a regex, and could not filter or sort in the
 * query as a result. Postgres timestamptz removed all of that.
 */
function fromDto(dto: PublicEvent): ShpeEvent {
  return {
    id: dto.id,
    name: dto.name,
    tag: dto.tag,
    description: dto.description,
    location: dto.location,
    points: dto.points,
    startsAt: new Date(dto.startsAt),
    endsAt: new Date(dto.endsAt),
    allDay: dto.allDay,
    source: dto.source,
  };
}

const asError = (err: unknown): Error =>
  err instanceof Error ? err : new Error('Something went wrong');

/**
 * Events that have not finished yet, soonest first.
 *
 * A REST API gives no live updates. Refetching when the screen regains focus
 * covers the case that actually matters — an officer edits an event, a member
 * switches tabs and back — without polling in the background.
 */
export function useUpcomingEvents() {
  const [events, setEvents] = useState<ShpeEvent[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (options?: { showSpinner?: boolean }) => {
    if (options?.showSpinner) setRefreshing(true);
    try {
      const data = await apiFetch<{ events: PublicEvent[] }>('/api/events?upcoming=1');
      setEvents(data.events.map(fromDto));
      setError(null);
    } catch (err) {
      setError(asError(err));
    } finally {
      if (options?.showSpinner) setRefreshing(false);
    }
  }, []);

  // Runs on mount and on every return to the screen.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return {
    events,
    error,
    loading: events === null && !error,
    refreshing,
    refresh: useCallback(() => load({ showSpinner: true }), [load]),
  };
}

/** One event. `undefined` while loading, `null` when it does not exist. */
export function useEvent(id: string) {
  const [event, setEvent] = useState<ShpeEvent | null | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setEvent(null);
      return;
    }
    try {
      const data = await apiFetch<{ event: PublicEvent }>(`/api/events/${id}`);
      setEvent(fromDto(data.event));
      setError(null);
    } catch (err) {
      // A missing event is an outcome, not a failure — the screen has its own
      // "Event not found" state, which is friendlier than an error message.
      if (err instanceof ApiError && err.status === 404) {
        setEvent(null);
        setError(null);
        return;
      }
      setError(asError(err));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { event, error, loading: event === undefined && !error };
}

const accentPalette = [colors.navy, colors.orange, colors.teal, colors.blue];

/** Stable accent per tag, so "GBM" is always the same colour across screens. */
export function accentForTag(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i += 1) hash += tag.charCodeAt(i);
  return accentPalette[hash % accentPalette.length];
}

const isValid = (d: Date) => !Number.isNaN(d.getTime());

export function formatMonth(d: Date) {
  return isValid(d) ? d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : '—';
}

export function formatDay(d: Date) {
  return isValid(d) ? String(d.getDate()).padStart(2, '0') : '--';
}

export function formatDateLong(d: Date) {
  return isValid(d)
    ? d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'Date TBD';
}

export function formatTimeRange(start: Date, end: Date) {
  if (!isValid(start)) return 'Time TBD';
  const time = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return isValid(end) ? `${time(start)} - ${time(end)}` : time(start);
}
