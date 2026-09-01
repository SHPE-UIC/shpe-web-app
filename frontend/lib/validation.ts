/**
 * Mirrors the same check on the server, which is the one that decides. This
 * copy exists only so the form can object before a round trip.
 *
 * Anchored at both ends: an unanchored match would accept
 * `someone@uic.edu.evil.com` and `someone@fake-uic.edu`.
 */
export const isUicEmail = (email: string): boolean => /^[^\s@]+@uic\.edu$/i.test(email.trim());

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Mirrors MAX_GENDER_SELF_DESCRIPTION_LENGTH in backend/src/validation.ts.
 * Used to cap the input, so the limit is reached before the request is sent
 * rather than reported back as an error.
 */
export const MAX_GENDER_SELF_DESCRIPTION_LENGTH = 50;
