import { GENDER_OPTIONS, SCHOOL_LEVEL_OPTIONS } from './db/schema';
import type { Gender, SchoolLevel } from './db/schema';
import { badRequest } from './middleware/errors';

export const UIC_EMAIL_DOMAIN = 'uic.edu';

/**
 * Membership is restricted to UIC addresses.
 *
 * Anchored at both ends on purpose: a bare `includes('uic.edu')` would accept
 * `someone@uic.edu.example.com` and `someone@fake-uic.edu`, both of which are
 * addresses an outsider can actually obtain.
 */
export const isUicEmail = (email: string): boolean => /^[^\s@]+@uic\.edu$/i.test(email.trim());

export const MIN_PASSWORD_LENGTH = 8;

export type RegistrationInput = {
  email: string;
  password: string;
  name: string;
  gender: Gender;
  schoolLevel: SchoolLevel | null;
  memberId: string | null;
};

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalStr(value: unknown): string | null {
  const trimmed = str(value);
  return trimmed === '' ? null : trimmed;
}

function oneOf<T extends string>(value: unknown, options: readonly T[]): T | null {
  const trimmed = str(value);
  return options.includes(trimmed as T) ? (trimmed as T) : null;
}

/**
 * Validates a registration payload. The app validates the same rules for
 * immediate feedback, but this is the copy that decides — a client can send
 * whatever it likes.
 */
export function parseRegistration(body: unknown): RegistrationInput {
  const input = (body ?? {}) as Record<string, unknown>;

  const email = str(input.email).toLowerCase();
  const password = typeof input.password === 'string' ? input.password : '';
  const name = str(input.name);

  if (!email) throw badRequest('Email is required', 'email_required');
  if (!isUicEmail(email)) {
    throw badRequest(`Use your @${UIC_EMAIL_DOMAIN} email address`, 'email_not_uic');
  }
  if (!name) throw badRequest('Name is required', 'name_required');
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw badRequest(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      'password_too_short',
    );
  }

  const gender = oneOf(input.gender, GENDER_OPTIONS);
  if (!gender) throw badRequest('Select your gender', 'gender_required');

  return {
    email,
    password,
    name,
    gender,
    schoolLevel: oneOf(input.schoolLevel, SCHOOL_LEVEL_OPTIONS),
    memberId: optionalStr(input.memberId),
  };
}

export function parseCredentials(body: unknown): { email: string; password: string } {
  const input = (body ?? {}) as Record<string, unknown>;
  const email = str(input.email).toLowerCase();
  const password = typeof input.password === 'string' ? input.password : '';

  if (!email || !password) {
    throw badRequest('Email and password are required', 'credentials_required');
  }
  return { email, password };
}
