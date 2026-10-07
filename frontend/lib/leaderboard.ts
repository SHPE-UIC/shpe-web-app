import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { apiFetch } from './api/client';
import type { Leader } from './api/types';

/**
 * The chapter's top five by all-time points. Refetched whenever Home regains
 * focus, so a member who has just checked in sees the board move.
 */
export function useLeaderboard() {
  const [leaders, setLeaders] = useState<Leader[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ leaders: Leader[] }>('/api/leaderboard');
      setLeaders(data.leaders);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Could not load the leaderboard'));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { leaders, error, loading: leaders === null && !error };
}
