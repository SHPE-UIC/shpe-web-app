import { describe, expect, it } from 'vitest';
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
    age: 20,
    sexAtBirth: 'Female',
    gender: 'Woman',
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

  it('drops unrecognised enum values instead of storing them', () => {
    const parsed = parseRegistration({ ...valid, sexAtBirth: 'nonsense', schoolLevel: 'Wizard' });
    expect(parsed.sexAtBirth).toBeNull();
    expect(parsed.schoolLevel).toBeNull();
  });

  it('treats blank optional fields as null rather than empty strings', () => {
    const parsed = parseRegistration({ ...valid, gender: '  ', memberId: '', age: '' });
    expect(parsed.gender).toBeNull();
    expect(parsed.memberId).toBeNull();
    expect(parsed.age).toBeNull();
  });

  it('rejects an implausible age', () => {
    expect(() => parseRegistration({ ...valid, age: 3 })).toThrow(/valid age/);
    expect(() => parseRegistration({ ...valid, age: 20.5 })).toThrow(/valid age/);
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
