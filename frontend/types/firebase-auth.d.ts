import type { Persistence, ReactNativeAsyncStorage } from 'firebase/auth';

// The firebase/auth runtime selects its React Native entry through Metro and
// exports this helper, but firebase@12's wrapper declaration points at the
// platform-neutral types and omits it. Keep the public runtime import while
// filling that declaration gap for TypeScript.
declare module 'firebase/auth' {
  export function getReactNativePersistence(
    storage: ReactNativeAsyncStorage,
  ): Persistence;
}
