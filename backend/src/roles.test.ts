import { describe, expect, it } from 'vitest';
import { ROLE, isBoardOrAbove, isRole, isTop8, roleLabel } from './roles';

describe('role levels', () => {
  it('orders member below board below top 8', () => {
    expect(ROLE.MEMBER).toBeLessThan(ROLE.BOARD);
    expect(ROLE.BOARD).toBeLessThan(ROLE.TOP8);
  });

  // The whole point of numbering them: every check is "this level or above".
  it('treats board powers as inherited upward', () => {
    expect(isBoardOrAbove(ROLE.MEMBER)).toBe(false);
    expect(isBoardOrAbove(ROLE.BOARD)).toBe(true);
    expect(isBoardOrAbove(ROLE.TOP8)).toBe(true);
  });

  it('reserves level changes for top 8', () => {
    expect(isTop8(ROLE.MEMBER)).toBe(false);
    expect(isTop8(ROLE.BOARD)).toBe(false);
    expect(isTop8(ROLE.TOP8)).toBe(true);
  });
});

describe('isRole', () => {
  it('accepts exactly 0, 1, and 2', () => {
    expect(isRole(0)).toBe(true);
    expect(isRole(1)).toBe(true);
    expect(isRole(2)).toBe(true);
  });

  // Guards the PATCH body: a request must not be able to invent a level.
  it('rejects anything else', () => {
    for (const bad of [3, -1, 1.5, '1', null, undefined, true, {}]) {
      expect(isRole(bad)).toBe(false);
    }
  });
});

describe('roleLabel', () => {
  it('names each level', () => {
    expect(roleLabel(ROLE.MEMBER)).toBe('Member');
    expect(roleLabel(ROLE.BOARD)).toBe('Board Member');
    expect(roleLabel(ROLE.TOP8)).toBe('Top 8');
  });

  // A row written before a future level existed should read as the least
  // privileged thing, never as a crash or a blank.
  it('falls back to Member for an unknown value', () => {
    expect(roleLabel(99)).toBe('Member');
  });
});
