/** Where auth.setup.ts saves each account's signed-in session for the scan. */
export const SESSION = {
  member: 'e2e/.auth/member.json',
  officer: 'e2e/.auth/officer.json',
} as const;
