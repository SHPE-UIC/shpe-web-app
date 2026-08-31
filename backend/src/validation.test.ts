import { describe, expect, it } from 'vitest';
import { GENDER_OPTIONS } from './db/schema';
import { isUicEmail, parseRegistration, parseCredentials } from './validation';

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
      expect(parseRegistration({ ...valid, gender }).gender).toBe(gender);
    }
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

describe('parseCredentials', () => {
  it('lower-cases the email', () => {
    expect(parseCredentials({ email: 'A@UIC.edu', password: 'x' }).email).toBe('a@uic.edu');
  });

  it('requires both fields', () => {
    expect(() => parseCredentials({ email: 'a@uic.edu' })).toThrow(/required/);
    expect(() => parseCredentials({})).toThrow(/required/);
  });
});
