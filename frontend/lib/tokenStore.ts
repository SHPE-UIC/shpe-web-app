import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'shpe.session.token';

/**
 * Where the session token lives.
 *
 * expo-secure-store has no web implementation, and web is this app's primary
 * deployment target, so the two platforms need different backing stores. Every
 * access is guarded: localStorage throws outright in some privacy modes, and a
 * storage failure should sign the member out, not crash the app.
 */
export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(KEY) ?? null;
    } catch {
      return null;
    }
  }

  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(KEY, token);
    } catch {
      // Session lasts until reload. Better than refusing to sign in.
    }
    return;
  }

  try {
    await SecureStore.setItemAsync(KEY, token);
  } catch {
    // As above.
  }
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.removeItem(KEY);
    } catch {
      // Nothing to do — the token was never stored.
    }
    return;
  }

  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // As above.
  }
}
