import { accentForTag, formatDateLong, formatDay, formatMonth, formatTimeRange } from './events';
import { colors } from '../constants/theme';

describe('accentForTag', () => {
  it('gives a tag the same colour every time', () => {
    expect(accentForTag('GBM')).toBe(accentForTag('GBM'));
    expect(Object.values(colors)).toContain(accentForTag('GBM'));
  });
});

describe('date formatting', () => {
  const at = new Date(2026, 0, 15, 18, 0);

  it('formats a real date', () => {
    expect(formatMonth(at)).toBe('JAN');
    expect(formatDay(at)).toBe('15');
    expect(formatDateLong(at)).toBe('January 15, 2026');
  });

  it('pads a single-digit day, so the badge does not jump', () => {
    expect(formatDay(new Date(2026, 0, 5))).toBe('05');
  });

  it('formats a range, and falls back when the end is unusable', () => {
    expect(formatTimeRange(at, new Date(2026, 0, 15, 19, 30))).toBe('6:00 PM - 7:30 PM');
    expect(formatTimeRange(at, new Date(NaN))).toBe('6:00 PM');
  });

  // An unparseable date must never reach the screen as "Invalid Date".
  it('degrades to placeholders instead of throwing', () => {
    const bad = new Date(NaN);
    expect(formatMonth(bad)).toBe('—');
    expect(formatDay(bad)).toBe('--');
    expect(formatDateLong(bad)).toBe('Date TBD');
    expect(formatTimeRange(bad, bad)).toBe('Time TBD');
  });
});
