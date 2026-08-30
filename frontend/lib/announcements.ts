import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { colors } from '../constants/theme';
import { apiFetch } from './api/client';

export type Announcement = {
  id: string;
  title: string;
  body: string;
  accent: string | null;
  /** Null means a draft, which only officers can see. */
  publishedAt: string | null;
  createdAt: string;
};

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (options?: { showSpinner?: boolean }) => {
    if (options?.showSpinner) setRefreshing(true);
    try {
      const data = await apiFetch<{ announcements: Announcement[] }>('/api/announcements');
      setAnnouncements(data.announcements);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Could not load announcements'));
    } finally {
      if (options?.showSpinner) setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return {
    announcements,
    error,
    loading: announcements === null && !error,
    refreshing,
    refresh: useCallback(() => load({ showSpinner: true }), [load]),
  };
}

const accentPalette = [colors.orange, colors.blue, colors.teal, colors.navy];

/**
 * The accent stripe on an announcement card.
 *
 * Officers can pick one; when they have not, it is derived from the id so a
 * run of announcements does not come out as a wall of the same colour, and so
 * a given announcement keeps its colour between renders.
 */
export function accentColor(announcement: Pick<Announcement, 'id' | 'accent'>): string {
  switch (announcement.accent) {
    case 'navy':
      return colors.navy;
    case 'blue':
      return colors.blue;
    case 'orange':
      return colors.orange;
    case 'teal':
      return colors.teal;
    default: {
      let hash = 0;
      for (let i = 0; i < announcement.id.length; i += 1) {
        hash += announcement.id.charCodeAt(i);
      }
      return accentPalette[hash % accentPalette.length];
    }
  }
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600_000],
  ['month', 30 * 24 * 3600_000],
  ['week', 7 * 24 * 3600_000],
  ['day', 24 * 3600_000],
  ['hour', 3600_000],
  ['minute', 60_000],
];

/** "2 hours ago". Replaces the hardcoded strings the cards used to carry. */
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Draft';

  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return '';

  const delta = at - Date.now();
  const magnitude = Math.abs(delta);
  const format = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });

  for (const [unit, ms] of UNITS) {
    if (magnitude >= ms) return format.format(Math.round(delta / ms), unit);
  }
  return 'Just now';
}
