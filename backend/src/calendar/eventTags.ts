// Google Calendar event colours are the officer-facing control for how an event
// is categorised. Officers pick a colour in Calendar; the sync turns it into a
// tag, and the tag decides the default point value.
//
// The colorId values below are Google's fixed event palette (1-11). The names
// are what the colour picker shows, so keep them for reference when editing.

export type EventTag = { tag: string; points: number };

export const TAGS_BY_COLOR_ID: Record<string, EventTag> = {
  1: { tag: 'Social', points: 1 },      // Lavender
  2: { tag: 'Volunteer', points: 3 },   // Sage
  3: { tag: 'Social', points: 1 },      // Grape
  4: { tag: 'Study', points: 1 },       // Flamingo
  5: { tag: 'Fundraiser', points: 2 },  // Banana
  6: { tag: 'Career', points: 3 },      // Tangerine
  7: { tag: 'Workshop', points: 2 },    // Peacock
  8: { tag: 'Other', points: 0 },       // Graphite
  9: { tag: 'GBM', points: 3 },         // Blueberry
  10: { tag: 'Volunteer', points: 3 },  // Basil
  11: { tag: 'Career', points: 3 },     // Tomato
};

// Events created without an explicit colour inherit the calendar default, which
// the API reports by omitting colorId entirely.
export const DEFAULT_TAG: EventTag = { tag: 'Event', points: 1 };

export function tagForColorId(colorId?: string | null): EventTag {
  if (colorId === undefined || colorId === null) return DEFAULT_TAG;
  return TAGS_BY_COLOR_ID[String(colorId)] ?? DEFAULT_TAG;
}
