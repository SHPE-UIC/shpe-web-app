import { fromDateTimeInput, toDateInput, toTimeInput } from './admin';

/**
 * The event form's date handling.
 *
 * Officers type a local date and time; the API stores instants. These run in
 * whatever timezone the test machine is in, so they are written to assert the
 * *round trip* rather than specific UTC strings — a test that hardcoded
 * "18:00 becomes 23:00Z" would only pass in Chicago.
 */
describe('date inputs', () => {
  it('round-trips an instant through the form fields unchanged', () => {
    const original = new Date(2026, 8, 5, 18, 30).toISOString();

    const date = toDateInput(original);
    const time = toTimeInput(original);

    expect(fromDateTimeInput(date, time)).toBe(original);
  });

  it('formats to the shapes the form advertises', () => {
    const iso = new Date(2026, 0, 9, 7, 5).toISOString();
    expect(toDateInput(iso)).toBe('2026-01-09');
    expect(toTimeInput(iso)).toBe('07:05');
  });

  it('reads back the same wall-clock time the officer typed', () => {
    const iso = fromDateTimeInput('2026-09-05', '18:30');
    expect(iso).not.toBeNull();

    const at = new Date(iso!);
    expect(at.getFullYear()).toBe(2026);
    expect(at.getMonth()).toBe(8);
    expect(at.getDate()).toBe(5);
    expect(at.getHours()).toBe(18);
    expect(at.getMinutes()).toBe(30);
  });

  it('defaults a missing time to midnight, for all-day events', () => {
    const iso = fromDateTimeInput('2026-09-05', '');
    expect(iso).not.toBeNull();
    expect(new Date(iso!).getHours()).toBe(0);
  });

  it('returns null rather than an Invalid Date for malformed input', () => {
    expect(fromDateTimeInput('', '18:00')).toBeNull();
    expect(fromDateTimeInput('05/09/2026', '18:00')).toBeNull();
    expect(fromDateTimeInput('2026-09-05', '6pm')).toBeNull();
    expect(fromDateTimeInput('nonsense', 'nonsense')).toBeNull();
  });

  it('gives empty strings for an unusable instant instead of throwing', () => {
    expect(toDateInput('not-a-date')).toBe('');
    expect(toTimeInput('not-a-date')).toBe('');
  });
});
