import { apiFetch } from './api/client';
import type { PublicEvent } from './api/types';
import type { Announcement } from './announcements';

// ── Announcements ───────────────────────────────────────────────────────────

export type AnnouncementInput = {
  title: string;
  body: string;
  accent: string | null;
  draft: boolean;
};

export function createAnnouncement(input: AnnouncementInput) {
  return apiFetch<{ announcement: Announcement }>('/api/announcements', {
    method: 'POST',
    body: input,
  }).then((data) => data.announcement);
}

export function updateAnnouncement(id: string, input: Partial<AnnouncementInput>) {
  return apiFetch<{ announcement: Announcement }>(`/api/announcements/${id}`, {
    method: 'PATCH',
    body: input,
  }).then((data) => data.announcement);
}

export function deleteAnnouncement(id: string) {
  return apiFetch<void>(`/api/announcements/${id}`, { method: 'DELETE' });
}

// ── Events ──────────────────────────────────────────────────────────────────

export type EventInput = {
  name: string;
  description: string;
  location: string;
  tag: string;
  points: number;
  /** ISO 8601 instants. */
  startsAt: string;
  endsAt: string;
  allDay: boolean;
};

export function createEvent(input: EventInput) {
  return apiFetch<{ event: PublicEvent }>('/api/events', {
    method: 'POST',
    body: input,
  }).then((data) => data.event);
}

export function updateEvent(id: string, input: Partial<EventInput>) {
  return apiFetch<{ event: PublicEvent }>(`/api/events/${id}`, {
    method: 'PATCH',
    body: input,
  }).then((data) => data.event);
}

export function deleteEvent(id: string) {
  return apiFetch<void>(`/api/events/${id}`, { method: 'DELETE' });
}

// ── Date inputs ─────────────────────────────────────────────────────────────
//
// Officers type a date and a time in their own timezone; the API stores real
// instants. A picker component would be nicer, but the ones that work well on
// native do not on web, and web is this app's primary target — so these are
// plain text fields with a fixed format, and the conversion lives here.

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO instant -> "YYYY-MM-DD" in the viewer's timezone. */
export function toDateInput(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** ISO instant -> "HH:MM" in the viewer's timezone. */
export function toTimeInput(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return `${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/**
 * "YYYY-MM-DD" + "HH:MM" -> ISO instant, or null when either is unusable.
 *
 * The combined string is deliberately left without a timezone suffix, which
 * makes JavaScript parse it as local time — the officer's own clock, which is
 * what they just typed.
 */
export function fromDateTimeInput(date: string, time: string): string | null {
  const d = date.trim();
  const t = (time.trim() || '00:00').slice(0, 5);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  if (!/^\d{2}:\d{2}$/.test(t)) return null;

  const at = new Date(`${d}T${t}`);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}
