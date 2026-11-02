import { act, renderHook } from '@testing-library/react-native';
import { useHasPassed } from './useHasPassed';

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useHasPassed', () => {
  it('turns true at the moment, not before', () => {
    const at = new Date(Date.now() + 60_000);
    const { result } = renderHook(() => useHasPassed(at));

    act(() => jest.advanceTimersByTime(59_999));
    expect(result.current).toBe(false);
    act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it('is true for a time already past', () => {
    const { result } = renderHook(() => useHasPassed(new Date(Date.now() - 1)));
    expect(result.current).toBe(true);
  });

  it('is never true for no time at all', () => {
    const { result } = renderHook(() => useHasPassed(null));
    expect(result.current).toBe(false);
  });

  // setTimeout fires at once for a delay past 2^31-1 ms (about 24.8 days), so
  // an event a month out must not be treated as already started.
  it('stays false for a time further off than a timer can wait', () => {
    const { result } = renderHook(() => useHasPassed(new Date(Date.now() + 30 * DAY)));

    act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe(false);
  });
});
