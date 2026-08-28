import { authErrorCode, loginErrorMessage, registerErrorMessage } from '../authErrors';

const FALLBACK = 'An unexpected error occurred. Please try again.';

describe('authErrorCode', () => {
  it('extracts a string code from a Firebase error', () => {
    expect(authErrorCode({ code: 'auth/user-not-found' })).toBe('auth/user-not-found');
  });

  it('returns undefined for a plain Error', () => {
    expect(authErrorCode(new Error('boom'))).toBeUndefined();
  });

  it('returns undefined for null', () => {
    expect(authErrorCode(null)).toBeUndefined();
  });

  it('returns undefined when code is not a string', () => {
    expect(authErrorCode({ code: 42 })).toBeUndefined();
  });
});

describe('loginErrorMessage', () => {
  it('maps invalid-credential to a password hint', () => {
    expect(loginErrorMessage({ code: 'auth/invalid-credential' })).toBe(
      'Incorrect password. Please try again.',
    );
  });

  it('maps user-not-found to a missing-account message', () => {
    expect(loginErrorMessage({ code: 'auth/user-not-found' })).toBe(
      'No account found with this email.',
    );
  });

  it('maps too-many-requests to a rate-limit message', () => {
    expect(loginErrorMessage({ code: 'auth/too-many-requests' })).toBe(
      'Too many failed attempts. Please try again later.',
    );
  });

  it('falls back for an unrecognized code', () => {
    expect(loginErrorMessage({ code: 'auth/network-request-failed' })).toBe(FALLBACK);
  });
});

describe('registerErrorMessage', () => {
  it('maps email-already-in-use', () => {
    expect(registerErrorMessage({ code: 'auth/email-already-in-use' })).toBe(
      'An account with this email already exists.',
    );
  });

  it('maps weak-password', () => {
    expect(registerErrorMessage({ code: 'auth/weak-password' })).toBe(
      'Password is too weak. Use at least 6 characters.',
    );
  });

  it('falls back for an unrecognized code', () => {
    expect(registerErrorMessage({ code: 'auth/internal-error' })).toBe(FALLBACK);
  });
});
