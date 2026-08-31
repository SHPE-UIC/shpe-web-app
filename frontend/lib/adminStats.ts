import type { Role } from './roles';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { apiFetch } from './api/client';

export type AdminOverview = {
  events: { total: number; upcoming: number; past: number; fromCalendar: number };
  members: { total: number; board: number; topEight: number; joinedLast30Days: number };
  checkIns: { total: number; uniqueAttendees: number; pointsAwarded: number };
  engagement: {
    averageAttendance: number;
    /** Zero means nothing has finished yet, so averageAttendance is not meaningful. */
    finishedEvents: number;
    participationRate: number;
    neverAttended: number;
  };
};

export type EventAttendance = {
  id: string;
  name: string;
  tag: string;
  points: number;
  source: string;
  startsAt: string;
  endsAt: string;
  attendees: number;
};

export type Attendee = {
  userId: string;
  name: string;
  email: string;
  schoolLevel: string | null;
  avatarUrl: string | null;
  points: number;
  checkedInAt: string;
};

/**
 * The roster the dashboard shows.
 *
 * Gender is absent here because the API does not send it — see the note on
 * GET /api/admin/members.
 */
export type MemberRow = {
  id: string;
  name: string;
  email: string;
  schoolLevel: string | null;
  memberId: string | null;
  avatarUrl: string | null;
  role: Role;
  roleLabel: string;
  createdAt: string;
  eventsAttended: number;
  pointsEarned: number;
};

export type ActivityEntry = {
  id: string;
  actorEmail: string;
  action: 'create' | 'update' | 'delete';
  /** 'member' covers a level change — see recordAudit in the API. */
  entity: 'event' | 'announcement' | 'member';
  entityId: string;
  entityLabel: string;
  changedFields: string[];
  createdAt: string;
};

/** Shared shape for the read-only admin views: fetch on focus, expose refresh. */
function useAdminResource<T>(path: string, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (options?: { showSpinner?: boolean }) => {
      if (!enabled) return;
      if (options?.showSpinner) setRefreshing(true);
      try {
        setData(await apiFetch<T>(path));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Could not load this'));
      } finally {
        if (options?.showSpinner) setRefreshing(false);
      }
    },
    [path, enabled],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return {
    data,
    error,
    loading: data === null && !error && enabled,
    refreshing,
    refresh: useCallback(() => load({ showSpinner: true }), [load]),
  };
}

export function useAdminOverview(enabled = true) {
  return useAdminResource<AdminOverview>('/api/admin/overview', enabled);
}

export function useEventAttendance(enabled = true) {
  return useAdminResource<{ events: EventAttendance[] }>('/api/admin/events', enabled);
}

export function useMembers(enabled = true) {
  return useAdminResource<{ members: MemberRow[] }>('/api/admin/members', enabled);
}

export function useRecentActivity(enabled = true) {
  return useAdminResource<{ activity: ActivityEntry[] }>('/api/admin/activity?limit=25', enabled);
}

export function useAttendees(eventId: string, enabled = true) {
  return useAdminResource<{ event: EventAttendance; attendance: Attendee[] }>(
    `/api/admin/events/${eventId}/attendance`,
    enabled && Boolean(eventId),
  );
}
