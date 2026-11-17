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
 * Mirrors MAX_SELF_DESCRIPTION_LENGTH in backend/src/validation.ts. Used to cap
 * the input, so the limit is reached before the request is sent rather than
 * reported back as an error.
 */
export const MAX_SELF_DESCRIPTION_LENGTH = 50;

/** @deprecated Use MAX_SELF_DESCRIPTION_LENGTH. */
export const MAX_GENDER_SELF_DESCRIPTION_LENGTH = MAX_SELF_DESCRIPTION_LENGTH;

/**
 * The step-2 signup rules that also apply when editing a profile. One copy so
 * the two forms give the same messages. Returns null when the answers are fine.
 */
export function profileAnswersError(answers: {
  gender: string | undefined;
  genderSelfDescribed: string;
  schoolLevel: string | undefined;
  schoolLevelOther: string;
  majors: readonly string[];
  otherMajorChosen: boolean;
  majorOther: string;
}): string | null {
  const { gender, schoolLevel, majors, otherMajorChosen } = answers;
  const majorOther = answers.majorOther.trim();

  if (!gender) return 'Select your gender.';
  if (gender === 'Other' && !answers.genderSelfDescribed.trim()) {
    return 'Tell us how you describe your gender.';
  }
  if (!schoolLevel) return 'Select your school year.';
  if (schoolLevel === 'Other' && !answers.schoolLevelOther.trim()) {
    return 'Tell us your school year.';
  }
  if (majors.length === 0 && !(otherMajorChosen && majorOther)) return 'Select at least one major.';
  if (otherMajorChosen && !majorOther) return 'Tell us your major.';
  return null;
}

/**
 * Mirrors UIN_PATTERN in backend/src/validation.ts, which is the copy that
 * decides. Test the normalised digits, not what was typed — the number is
 * printed on the i-card in groups and people enter it that way.
 */
export const UIN_PATTERN = /^\d{9}$/;

export const normaliseUin = (uin: string): string => uin.trim().replace(/[\s-]/g, '');

export const isValidUin = (uin: string): boolean => UIN_PATTERN.test(normaliseUin(uin));
