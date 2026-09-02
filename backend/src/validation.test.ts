import { describe, expect, it } from 'vitest';
import { GENDER_OPTIONS, MAJOR_OPTIONS, SCHOOL_LEVEL_OPTIONS } from './db/schema';
import {
  MAX_GENDER_SELF_DESCRIPTION_LENGTH,
  MAX_SELF_DESCRIPTION_LENGTH,
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
    schoolLevel: '3rd',
    majors: ['Computer Science'],
    memberId: 'M-1234',
    uin: '651234567',
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

  it('treats a blank member ID as null rather than an empty string', () => {
    expect(parseRegistration({ ...valid, memberId: '' }).memberId).toBeNull();
  });

  describe('school level', () => {
    it('accepts each option in the set', () => {
      for (const schoolLevel of SCHOOL_LEVEL_OPTIONS) {
        const description = schoolLevel === 'Other' ? { schoolLevelOther: 'Certificate' } : {};
        expect(parseRegistration({ ...valid, schoolLevel, ...description }).schoolLevel).toBe(
          schoolLevel,
        );
      }
    });

    // The class-year wording the app used until September 2026. A member on a
    // stale bundle must be corrected, not silently recorded as level-less.
    it('refuses the retired class-year wording', () => {
      expect(() => parseRegistration({ ...valid, schoolLevel: 'Freshman' })).toThrow(
        /school year/i,
      );
    });

    it('is required', () => {
      expect(() => parseRegistration({ ...valid, schoolLevel: undefined })).toThrow(/school year/i);
      expect(() => parseRegistration({ ...valid, schoolLevel: 'Wizard' })).toThrow(/school year/i);
    });

    it('requires a description when Other is chosen', () => {
      expect(() => parseRegistration({ ...valid, schoolLevel: 'Other' })).toThrow(
        /tell us your school year/i,
      );
    });

    it('keeps the description, trimmed, alongside Other', () => {
      const parsed = parseRegistration({
        ...valid,
        schoolLevel: 'Other',
        schoolLevelOther: '  Post-bacc ',
      });
      expect(parsed.schoolLevelOther).toBe('Post-bacc');
    });

    // Same contradiction the gender pair avoids: '3rd' beside a description of
    // some other level is a row nothing downstream can read.
    it('discards a description sent alongside a real level', () => {
      const parsed = parseRegistration({ ...valid, schoolLevel: '3rd', schoolLevelOther: 'Nope' });
      expect(parsed.schoolLevelOther).toBeNull();
    });
  });

  describe('majors', () => {
    it('keeps every recognised major, in the order given', () => {
      const parsed = parseRegistration({
        ...valid,
        majors: ['Data Science', 'Computer Science'],
      });
      expect(parsed.majors).toEqual(['Data Science', 'Computer Science']);
    });

    it('drops values outside the list rather than refusing the whole payload', () => {
      const parsed = parseRegistration({
        ...valid,
        majors: ['Computer Science', 'Underwater Basket Weaving'],
      });
      expect(parsed.majors).toEqual(['Computer Science']);
    });

    it('de-duplicates', () => {
      const parsed = parseRegistration({
        ...valid,
        majors: ['Computer Science', 'Computer Science'],
      });
      expect(parsed.majors).toEqual(['Computer Science']);
    });

    /**
     * 'Other' is not one of MAJOR_OPTIONS, so it cannot reach the array that
     * targeting selects on — the whole point of keeping it in its own column.
     */
    it('never stores Other in the array', () => {
      const parsed = parseRegistration({
        ...valid,
        majors: ['Other', 'Computer Science'],
        majorOther: 'Linguistics',
      });
      expect(parsed.majors).toEqual(['Computer Science']);
      expect(parsed.majors).not.toContain('Other');
      expect(parsed.majorOther).toBe('Linguistics');
    });

    it('requires at least one answer', () => {
      expect(() => parseRegistration({ ...valid, majors: [] })).toThrow(/major/i);
      expect(() => parseRegistration({ ...valid, majors: ['Other'] })).toThrow(/major/i);
    });

    it('is satisfied by an Other description alone', () => {
      const parsed = parseRegistration({ ...valid, majors: [], majorOther: '  Linguistics ' });
      expect(parsed.majors).toEqual([]);
      expect(parsed.majorOther).toBe('Linguistics');
    });

    it('refuses a description longer than the limit', () => {
      const tooLong = 'x'.repeat(MAX_SELF_DESCRIPTION_LENGTH + 1);
      expect(() => parseRegistration({ ...valid, majorOther: tooLong })).toThrow(
        /too long|characters/i,
      );
    });

    it('accepts every option in the set', () => {
      const parsed = parseRegistration({ ...valid, majors: [...MAJOR_OPTIONS] });
      expect(parsed.majors).toEqual([...MAJOR_OPTIONS]);
    });
  });

  describe('UIN', () => {
    it('keeps nine digits as they were typed', () => {
      expect(parseRegistration(valid).uin).toBe('651234567');
    });

    // Helped rather than scolded: the number is printed on the i-card in
    // groups, and people type it that way.
    it('normalises spaces and dashes away', () => {
      expect(parseRegistration({ ...valid, uin: '651-234-567' }).uin).toBe('651234567');
      expect(parseRegistration({ ...valid, uin: ' 651 234 567 ' }).uin).toBe('651234567');
    });

    it('refuses anything that is not exactly nine digits', () => {
      for (const uin of ['12345678', '1234567890', '65123456a', 'abcdefghi']) {
        expect(() => parseRegistration({ ...valid, uin })).toThrow(/9-digit|nine digit/i);
      }
    });

    it('is required', () => {
      expect(() => parseRegistration({ ...valid, uin: undefined })).toThrow(/UIN/i);
      expect(() => parseRegistration({ ...valid, uin: '   ' })).toThrow(/UIN/i);
    });

    /** Stored as text precisely so this one survives. */
    it('keeps a leading zero', () => {
      expect(parseRegistration({ ...valid, uin: '000000001' }).uin).toBe('000000001');
    });
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

