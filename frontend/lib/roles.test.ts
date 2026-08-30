import { ROLE, isBoardOrAbove, isRole, isTop8, roleLabel } from './roles';

// Mirrors backend/src/roles.test.ts. Both copies decide what renders and what
// is allowed, so they have to agree.
describe('role helpers', () => {
  it('inherits board powers upward', () => {
    expect(isBoardOrAbove(ROLE.MEMBER)).toBe(false);
    expect(isBoardOrAbove(ROLE.BOARD)).toBe(true);
    expect(isBoardOrAbove(ROLE.TOP8)).toBe(true);
  });

  it('reserves level changes for top 8', () => {
    expect(isTop8(ROLE.BOARD)).toBe(false);
    expect(isTop8(ROLE.TOP8)).toBe(true);
  });

  // Screens read user?.role, which is undefined before the session loads. That
  // must render as a member, not crash or briefly flash officer controls.
  it('treats a missing role as member', () => {
    expect(isBoardOrAbove(undefined)).toBe(false);
    expect(isTop8(undefined)).toBe(false);
  });

  it('validates and labels levels', () => {
    expect(isRole(2)).toBe(true);
    expect(isRole(3)).toBe(false);
    expect(roleLabel(ROLE.TOP8)).toBe('Top 8');
    expect(roleLabel(99)).toBe('Member');
  });
});
