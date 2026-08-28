// Firebase surfaces failures as an error object carrying a `code` string.
// Both auth screens map those to human copy, so the mapping lives here.

const FALLBACK = 'An unexpected error occurred. Please try again.';

const LOGIN_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/invalid-credential': 'Incorrect password. Please try again.',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
};

const REGISTER_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
};

export function authErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const { code } = error as { code: unknown };
  return typeof code === 'string' ? code : undefined;
}

export function loginErrorMessage(error: unknown): string {
  return LOGIN_MESSAGES[authErrorCode(error) ?? ''] ?? FALLBACK;
}

export function registerErrorMessage(error: unknown): string {
  return REGISTER_MESSAGES[authErrorCode(error) ?? ''] ?? FALLBACK;
}
