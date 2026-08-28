import { isUicEmail } from '../validation';

describe('isUicEmail', () => {
  it('accepts a uic.edu address', () => {
    expect(isUicEmail('student@uic.edu')).toBe(true);
  });

  it('accepts regardless of case', () => {
    expect(isUicEmail('Student@UIC.EDU')).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    expect(isUicEmail('  student@uic.edu  ')).toBe(true);
  });

  it('rejects a lookalike suffix', () => {
    expect(isUicEmail('student@uic.edu.evil.com')).toBe(false);
  });

  it('rejects a lookalike prefix', () => {
    expect(isUicEmail('student@fake-uic.edu')).toBe(false);
  });

  it('rejects a non-uic address', () => {
    expect(isUicEmail('student@gmail.com')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isUicEmail('')).toBe(false);
  });

  it('rejects an address with no local part', () => {
    expect(isUicEmail('@uic.edu')).toBe(false);
  });
});
