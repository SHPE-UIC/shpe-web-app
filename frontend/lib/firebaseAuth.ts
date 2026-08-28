import type { FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

// Browser and fallback initialization. Metro replaces this module with the
// `.native` variant on iOS and Android.
export function getPlatformAuth(app: FirebaseApp): Auth {
  return getAuth(app);
}
