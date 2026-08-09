// Google Calendar event colors are the officer-facing control for how an event
// is categorized. Officers pick a color in Calendar; the sync turns it into a
// tag, and the tag decides the default point value.
//
// The colorId values below are Google's fixed event palette (1-11). The names
// are what the color picker shows, so keep them for reference when editing.

export const TAGS_BY_COLOR_ID = {
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

// Events created without an explicit color inherit the calendar default, which
// the API reports by omitting colorId entirely.
export const DEFAULT_TAG = { tag: 'Event', points: 1 };

export function tagForColorId(colorId) {
  return TAGS_BY_COLOR_ID[colorId] ?? DEFAULT_TAG;
}
