import { isUicEmail, MIN_PASSWORD_LENGTH } from './validation';

// Mirrors the server rule in backend/src/validation.ts. Both copies matter:
// this one gives immediate feedback, that one decides.
describe('isUicEmail', () => {
  it('accepts a plain UIC address, case and whitespace insensitive', () => {
    expect(isUicEmail('someone@uic.edu')).toBe(true);
    expect(isUicEmail('  SomeOne@UIC.EDU  ')).toBe(true);
  });

  // The cases that motivate anchoring the pattern at both ends: both of these
  // are addresses an outsider can actually register.
  it('rejects a domain that merely starts or ends with uic.edu', () => {
    expect(isUicEmail('someone@uic.edu.evil.com')).toBe(false);
    expect(isUicEmail('someone@fake-uic.edu')).toBe(false);
  });

  it('rejects subdomains, other domains, and junk', () => {
    expect(isUicEmail('someone@mail.uic.edu')).toBe(false);
    expect(isUicEmail('someone@gmail.com')).toBe(false);
    expect(isUicEmail('uic.edu')).toBe(false);
    expect(isUicEmail('')).toBe(false);
  });
});

describe('MIN_PASSWORD_LENGTH', () => {
  it('matches what the server enforces', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });
});
