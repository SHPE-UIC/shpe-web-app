import { accentColor, formatRelativeTime } from './announcements';
import { colors } from '../constants/theme';

describe('formatRelativeTime', () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

  it('describes recent times in words', () => {
    expect(formatRelativeTime(ago(30_000))).toBe('Just now');
    expect(formatRelativeTime(ago(5 * 60_000))).toMatch(/5 minutes ago/);
    expect(formatRelativeTime(ago(3 * 3_600_000))).toMatch(/3 hours ago/);
    expect(formatRelativeTime(ago(2 * 24 * 3_600_000))).toMatch(/2 days ago/);
  });

  // A null publishedAt is a draft, not a missing date.
  it('calls a null timestamp a draft', () => {
    expect(formatRelativeTime(null)).toBe('Draft');
  });

  it('returns empty rather than "Invalid Date" for junk', () => {
    expect(formatRelativeTime('not-a-date')).toBe('');
  });
});

describe('accentColor', () => {
  it('uses the officer’s choice when there is one', () => {
    expect(accentColor({ id: 'x', accent: 'navy' })).toBe(colors.navy);
    expect(accentColor({ id: 'x', accent: 'teal' })).toBe(colors.teal);
  });

  // Derived from the id so a run of posts is not one flat colour, and so a
  // given announcement keeps its colour between renders.
  it('derives a stable colour when none is set', () => {
    const first = accentColor({ id: 'abc-123', accent: null });
    expect(accentColor({ id: 'abc-123', accent: null })).toBe(first);
    expect(Object.values(colors)).toContain(first);
  });

  it('ignores an unrecognised accent rather than rendering nothing', () => {
    const derived = accentColor({ id: 'abc-123', accent: 'hotpink' });
    expect(Object.values(colors)).toContain(derived);
  });
});
