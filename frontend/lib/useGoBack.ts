import { useRouter } from 'expo-router';
import { useCallback } from 'react';

type Destination = Parameters<ReturnType<typeof useRouter>['replace']>[0];

/**
 * A back handler that always goes somewhere.
 *
 * `router.back()` is a no-op when there is nothing to go back to, which happens
 * whenever a screen is opened by a direct link rather than pushed — a shared
 * URL, a hard refresh on web, or a deep link. The back button then does
 * nothing and the person is stuck on the screen.
 *
 * Every screen that can be reached directly should use this instead, passing
 * wherever it makes sense to land when there is no history.
 */
export function useGoBack(fallback: Destination) {
  const router = useRouter();

  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}
