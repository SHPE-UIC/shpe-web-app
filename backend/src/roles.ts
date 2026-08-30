/**
 * SHPE's three levels of member, stored as `users.role`.
 *
 * Numeric and ordered on purpose: every check in the app is "this level or
 * above", which is a comparison rather than a set membership test. A named enum
 * would need an explicit ranking alongside it to answer the same question.
 */
export const ROLE = {
  /** An ordinary member. The default for every new account. */
  MEMBER: 0,
  /** Board member — what used to be `is_admin = true`. Runs events and posts. */
  BOARD: 1,
  /** Top 8. Everything a board member can do, plus setting other people's level. */
  TOP8: 2,
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const ROLES: readonly Role[] = [ROLE.MEMBER, ROLE.BOARD, ROLE.TOP8];

export const ROLE_LABEL: Record<Role, string> = {
  [ROLE.MEMBER]: 'Member',
  [ROLE.BOARD]: 'Board Member',
  [ROLE.TOP8]: 'Top 8',
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'number' && (ROLES as readonly number[]).includes(value);
}

/** Can run events, post announcements, and see the dashboard. */
export const isBoardOrAbove = (role: number): boolean => role >= ROLE.BOARD;

/** Can additionally change other members' levels. */
export const isTop8 = (role: number): boolean => role >= ROLE.TOP8;

export function roleLabel(role: number): string {
  return isRole(role) ? ROLE_LABEL[role] : 'Member';
}
