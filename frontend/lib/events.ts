import { collection, doc, onSnapshot, type DocumentSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { colors } from '../constants/theme';
import { db } from './firebase';

export type ShpeEvent = {
  id: string;
  name: string;
  tag: string;
  description: string;
  location: string;
  points: number;
  startsAt: Date;
  endsAt: Date;
  createdBy?: string;
  googleCalendarEventId?: string;
  imageUrl?: string;
};

function parseEventDate(date?: string, time?: string): Date {
  const [month, day, year] = (date ?? '').split('/').map(Number);
  if (!month || !day || !year) return new Date(NaN);

  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((time ?? '').trim());
  if (!match) return new Date(year, month - 1, day);

  const [, rawHour, minute, meridiem] = match;
  const hour = (Number(rawHour) % 12) + (meridiem.toUpperCase() === 'PM' ? 12 : 0);
  return new Date(year, month - 1, day, hour, Number(minute));
}

function fromDoc(snap: DocumentSnapshot): ShpeEvent {
  const d = snap.data()!;
  return {
    id: snap.id,
    name: d.name ?? 'Untitled event',
    tag: d.tag ?? 'Event',
    description: d.description ?? '',
    location: d.location ?? '',
    points: d.points ?? 0,
    startsAt: parseEventDate(d.date, d.startsAt),
    endsAt: parseEventDate(d.date, d.endsAt),
    createdBy: d.createdBy,
    googleCalendarEventId: d.googleCalendarEventId,
    imageUrl: d.imageUrl,
  };
}

/**
 * Live list of events that haven't ended yet, soonest first. The dates live in
 * Firestore as display strings, so the filter and sort have to happen here
 * rather than in the query — every event doc is downloaded on each snapshot.
 */
export function useUpcomingEvents() {
  const [events, setEvents] = useState<ShpeEvent[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(
    () =>
      onSnapshot(
        collection(db, 'events'),
        (snap) => {
          const now = Date.now();
          setEvents(
            snap.docs
              .map(fromDoc)
              .filter((e) => !Number.isNaN(e.endsAt.getTime()) && e.endsAt.getTime() >= now)
              .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
          );
        },
        setError,
      ),
    [],
  );

  return { events, error, loading: events === null && !error };
}

const accentPalette = [colors.navy, colors.orange, colors.teal, colors.blue];

/** Stable accent per tag, so "GBM" is always the same color across screens. */
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

export function useEvent(id: string) {
  const [event, setEvent] = useState<ShpeEvent | null | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);

  useEffect(
    () =>
      onSnapshot(
        doc(db, 'events', id),
        (snap) => setEvent(snap.exists() ? fromDoc(snap) : null),
        setError,
      ),
    [id],
  );

  return { event, error, loading: event === undefined };
}
