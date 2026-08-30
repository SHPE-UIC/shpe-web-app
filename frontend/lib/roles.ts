// Mirrors backend/src/roles.ts. The server is the authority; this copy exists
// so screens can decide what to render without a round trip.

export const ROLE = {
  MEMBER: 0,
  BOARD: 1,
  TOP8: 2,
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const ROLE_LABEL: Record<Role, string> = {
  [ROLE.MEMBER]: 'Member',
  [ROLE.BOARD]: 'Board Member',
  [ROLE.TOP8]: 'Top 8',
};

/** What each level can do, for the screens that explain the choice. */
export const ROLE_DESCRIPTION: Record<Role, string> = {
  [ROLE.MEMBER]: 'Sees events and announcements, and checks in.',
  [ROLE.BOARD]: 'Also creates events, posts announcements, and sees the dashboard.',
  [ROLE.TOP8]: 'Also changes what level other members have.',
};

export function isRole(value: unknown): value is Role {
  return value === ROLE.MEMBER || value === ROLE.BOARD || value === ROLE.TOP8;
}

/** Runs events and posts. Everything the old `isAdmin` used to gate. */
export const isBoardOrAbove = (role: number | undefined): boolean =>
  (role ?? ROLE.MEMBER) >= ROLE.BOARD;

/** Can additionally change other members' levels. */
export const isTop8 = (role: number | undefined): boolean =>
  (role ?? ROLE.MEMBER) >= ROLE.TOP8;

export const roleLabel = (role: number): string =>
  isRole(role) ? ROLE_LABEL[role] : ROLE_LABEL[ROLE.MEMBER];
