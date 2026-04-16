export const UIC_EMAIL_DOMAIN = 'uic.edu';

export const isUicEmail = (email: string): boolean =>
  /^[^\s@]+@uic\.edu$/i.test(email.trim());
