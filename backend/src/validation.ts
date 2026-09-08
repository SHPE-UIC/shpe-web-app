import { GENDER_OPTIONS, MAJOR_OPTIONS, SCHOOL_LEVEL_OPTIONS } from './db/schema';
import type { Gender, Major, SchoolLevel } from './db/schema';
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

/**
 * Long enough for any answer someone actually gives, short enough that the
 * column is not a free-text note field. Shared by all three "Other" answers.
 */
export const MAX_SELF_DESCRIPTION_LENGTH = 50;

/** @deprecated Use MAX_SELF_DESCRIPTION_LENGTH — kept for the app's copy of it. */
export const MAX_GENDER_SELF_DESCRIPTION_LENGTH = MAX_SELF_DESCRIPTION_LENGTH;

/**
 * The university's student number: nine digits, no more and no less.
 *
 * Not to be confused with the SHPE membership number in `memberId`, which is
 * also nine digits and is issued by someone else entirely.
 */
export const UIN_PATTERN = /^\d{9}$/;

export type RegistrationInput = {
  email: string;
  password: string;
  name: string;
  gender: Gender;
  /** How the member describes their gender. Only ever set alongside 'Other'. */
  genderSelfDescribed: string | null;
  schoolLevel: SchoolLevel;
  /** The member's own words for a school level of 'Other'. */
  schoolLevelOther: string | null;
  /** Canonical majors only — an 'Other' answer lives in majorOther. */
  majors: Major[];
  majorOther: string | null;
  memberId: string | null;
  uin: string;
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
 * A free-text description that belongs to one option and is required there.
 *
 * 'Other' on its own records nothing — it is the reason the option exists
 * rather than an answer in itself, which is why each of the three uses this.
 */
function requiredDescription(value: unknown, missing: string, code: string): string {
  const described = str(value);
  if (!described) throw badRequest(missing, `${code}_required`);
  if (described.length > MAX_SELF_DESCRIPTION_LENGTH) {
    throw badRequest(
      `Use at most ${MAX_SELF_DESCRIPTION_LENGTH} characters`,
      `${code}_too_long`,
    );
  }
  return described;
}

/**
 * The description that accompanies a gender of 'Other', and null for every
 * other gender.
 *
 * The form only shows the field for 'Other', but a client can send whatever it
 * likes, and a row reading 'Male' beside a description is a contradiction no
 * reader could resolve.
 */
function parseGenderSelfDescribed(gender: Gender, value: unknown): string | null {
  if (gender !== 'Other') return null;
  return requiredDescription(
    value,
    'Tell us how you describe your gender',
    'gender_self_described',
  );
}

/** The same arrangement for a school level of 'Other'. */
function parseSchoolLevelOther(schoolLevel: SchoolLevel, value: unknown): string | null {
  if (schoolLevel !== 'Other') return null;
  return requiredDescription(value, 'Tell us your school year', 'school_level_other');
}

/**
 * The majors the member picked, keeping only values the app knows.
 *
 * Unknown strings are dropped rather than refused: the list can grow, and a
 * member on a bundle older than the server should lose the option they could
 * not have chosen, not their whole registration. 'Other' is not in
 * MAJOR_OPTIONS, so it is dropped here too — by design, since the array is
 * what targeting selects on.
 */
function parseMajors(value: unknown): Major[] {
  if (!Array.isArray(value)) return [];

  const chosen: Major[] = [];
  for (const entry of value) {
    const major = oneOf(entry, MAJOR_OPTIONS);
    if (major && !chosen.includes(major)) chosen.push(major);
  }
  return chosen;
}

/**
 * The UIN, with the punctuation people type stripped first.
 *
 * The number is printed on the i-card in groups, so `651-234-567` is what a
 * member reading it aloud to themselves will enter. Normalising before the
 * test helps them rather than scolding them for a format nobody stated.
 */
function parseUin(value: unknown): string {
  const raw = str(value);
  if (!raw) throw badRequest('Enter your UIN', 'uin_required');

  const digits = raw.replace(/[\s-]/g, '');
  if (!UIN_PATTERN.test(digits)) {
    throw badRequest('Your UIN is the 9-digit number on your i-card', 'uin_invalid');
  }
  return digits;
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

  const schoolLevel = oneOf(input.schoolLevel, SCHOOL_LEVEL_OPTIONS);
  if (!schoolLevel) throw badRequest('Select your school year', 'school_level_required');

  const majors = parseMajors(input.majors);
  const majorOther = optionalStr(input.majorOther);
  if (majorOther !== null && majorOther.length > MAX_SELF_DESCRIPTION_LENGTH) {
    throw badRequest(`Use at most ${MAX_SELF_DESCRIPTION_LENGTH} characters`, 'major_other_too_long');
  }

  // Either a major from the list or one in their own words. Both is fine; a
  // registration naming neither has not answered the question.
  if (majors.length === 0 && majorOther === null) {
    throw badRequest('Select at least one major', 'major_required');
  }

  return {
    email,
    password,
    name,
    gender,
    genderSelfDescribed: parseGenderSelfDescribed(gender, input.genderSelfDescribed),
    schoolLevel,
    schoolLevelOther: parseSchoolLevelOther(schoolLevel, input.schoolLevelOther),
    majors,
    majorOther,
    memberId: optionalStr(input.memberId),
    uin: parseUin(input.uin),
  };
}

