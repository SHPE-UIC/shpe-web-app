import { describe, expect, it } from 'vitest';
import { rankLeaders } from './rank';

const row = (name: string, points: number) => ({ name, points });

/**
 * Rows arrive already ordered — points first, then whoever got there first —
 * so ranking is only about numbering them. Ties share a place, and the place
 * after a tie is skipped, the way a race is scored.
 */
describe('rankLeaders', () => {
  it('numbers distinct totals from 1', () => {
    expect(rankLeaders([row('Ana', 40), row('Ben', 30), row('Cy', 10)]).map((r) => r.rank)).toEqual([
      1, 2, 3,
    ]);
  });

  it('gives a tie one shared place and skips the next', () => {
    const ranked = rankLeaders([row('Ana', 40), row('Ben', 30), row('Cy', 30), row('Dee', 10)]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });

  it('puts everyone first when everyone is tied', () => {
    expect(rankLeaders([row('Ana', 5), row('Ben', 5), row('Cy', 5)]).map((r) => r.rank)).toEqual([
      1, 1, 1,
    ]);
  });

  it('keeps the order it was given', () => {
    const ranked = rankLeaders([row('Ana', 40), row('Ben', 40)]);
    expect(ranked.map((r) => r.name)).toEqual(['Ana', 'Ben']);
  });

  it('carries every field through', () => {
    expect(rankLeaders([{ name: 'Ana', points: 40, avatarUrl: null }])).toEqual([
      { rank: 1, name: 'Ana', points: 40, avatarUrl: null },
    ]);
  });

  it('ranks nobody when there is nobody', () => {
    expect(rankLeaders([])).toEqual([]);
  });
});
