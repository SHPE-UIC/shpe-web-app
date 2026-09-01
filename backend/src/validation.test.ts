import { describe, expect, it } from 'vitest';
import { GENDER_OPTIONS } from './db/schema';
import {
  MAX_GENDER_SELF_DESCRIPTION_LENGTH,
  isUicEmail,
  parseRegistration,
} from './validation';

describe('isUicEmail', () => {
  it('accepts a plain UIC address', () => {
    expect(isUicEmail('someone@uic.edu')).toBe(true);
  });

  it('is case insensitive and tolerates surrounding whitespace', () => {
    expect(isUicEmail('  SomeOne@UIC.EDU  ')).toBe(true);
  });

  // The cases that motivate anchoring the pattern at both ends.
  it('rejects a domain that merely starts with uic.edu', () => {
    expect(isUicEmail('someone@uic.edu.evil.com')).toBe(false);
  });

  it('rejects a domain that merely ends with uic.edu', () => {
    expect(isUicEmail('someone@fake-uic.edu')).toBe(false);
  });

  it('rejects subdomains and non-UIC addresses', () => {
    expect(isUicEmail('someone@mail.uic.edu')).toBe(false);
    expect(isUicEmail('someone@gmail.com')).toBe(false);
    expect(isUicEmail('uic.edu')).toBe(false);
    expect(isUicEmail('')).toBe(false);
  });
});

describe('parseRegistration', () => {
  const valid = {
    email: 'Member@UIC.edu',
    password: 'a-good-password',
    name: '  Ada Lovelace ',
    gender: 'Female',
    schoolLevel: 'Junior',
    memberId: 'M-1234',
  };

  it('normalises email to lower case and trims the name', () => {
    const parsed = parseRegistration(valid);
    expect(parsed.email).toBe('member@uic.edu');
    expect(parsed.name).toBe('Ada Lovelace');
  });

  it('rejects a non-UIC email', () => {
    expect(() => parseRegistration({ ...valid, email: 'a@gmail.com' })).toThrow(/uic\.edu/);
  });

  it('rejects a short password', () => {
    expect(() => parseRegistration({ ...valid, password: 'short' })).toThrow(/at least/);
  });

  it('requires a name', () => {
    expect(() => parseRegistration({ ...valid, name: '   ' })).toThrow(/Name is required/);
  });

  it('drops an unrecognised school level instead of storing it', () => {
    expect(parseRegistration({ ...valid, schoolLevel: 'Wizard' }).schoolLevel).toBeNull();
  });

  it('treats a blank member ID as null rather than an empty string', () => {
    expect(parseRegistration({ ...valid, memberId: '' }).memberId).toBeNull();
  });

  // Gender is the one demographic still collected, and unlike the old
  // free-text field it has to be one of three values.
  it('requires a gender from the fixed set', () => {
    expect(() => parseRegistration({ ...valid, gender: undefined })).toThrow('Select your gender');
    expect(() => parseRegistration({ ...valid, gender: 'Nonbinary' })).toThrow(
      'Select your gender',
    );
  });

  it('accepts each allowed gender', () => {
    for (const gender of GENDER_OPTIONS) {
      // 'Other' carries its own description; the other two must not.
      const description = gender === 'Other' ? { genderSelfDescribed: 'Non-binary' } : {};
      expect(parseRegistration({ ...valid, gender, ...description }).gender).toBe(gender);
    }
  });

  // 'Other' on its own says nothing, so the app asks the member to describe it
  // and this is the copy that enforces the answer.
  describe('a self-described gender', () => {
    const other = { ...valid, gender: 'Other' };

    it('is stored, trimmed, when Other is chosen', () => {
      expect(parseRegistration({ ...other, genderSelfDescribed: '  Genderfluid ' }))
        .toHaveProperty('genderSelfDescribed', 'Genderfluid');
    });

    it('is required when Other is chosen', () => {
      expect(() => parseRegistration(other)).toThrow(/how you describe your gender/i);
    });

    it('is not satisfied by whitespace alone', () => {
      expect(() => parseRegistration({ ...other, genderSelfDescribed: '   ' })).toThrow(
        /how you describe your gender/i,
      );
    });

    it('is refused when it is longer than the limit', () => {
      const tooLong = 'x'.repeat(MAX_GENDER_SELF_DESCRIPTION_LENGTH + 1);
      expect(() => parseRegistration({ ...other, genderSelfDescribed: tooLong })).toThrow(
        /too long|characters/i,
      );
    });

    it('accepts a description exactly at the limit', () => {
      const exact = 'x'.repeat(MAX_GENDER_SELF_DESCRIPTION_LENGTH);
      expect(parseRegistration({ ...other, genderSelfDescribed: exact }).genderSelfDescribed).toBe(
        exact,
      );
    });

    /**
     * The client hides the field unless Other is selected, but a client can
     * send whatever it likes. Storing 'Male' next to a description would be a
     * contradiction nothing downstream knows how to read.
     */
    it('is discarded when the gender is not Other', () => {
      const parsed = parseRegistration({ ...valid, gender: 'Male', genderSelfDescribed: 'Woman' });
      expect(parsed.genderSelfDescribed).toBeNull();
    });
  });

  it('no longer accepts or returns age or sex at birth', () => {
    const parsed = parseRegistration({ ...valid, age: 22, sexAtBirth: 'Male' });
    expect(parsed).not.toHaveProperty('age');
    expect(parsed).not.toHaveProperty('sexAtBirth');
  });

  it('does not crash on a missing body', () => {
    expect(() => parseRegistration(undefined)).toThrow(/Email is required/);
  });
});

