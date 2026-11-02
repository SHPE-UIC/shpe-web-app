import { describe, expect, it } from 'vitest';
import { rankLeaders } from './rank';

const DAY = 24 * 60 * 60 * 1000;
const row = (name: string, points: number, reachedDay = 1) => ({
  name,
  points,
  reachedAt: new Date(Date.UTC(2026, 8, reachedDay)),
});

const ranks = (rows: ReturnType<typeof row>[], places = 5) =>
  rankLeaders(rows, places).map((r) => [r.rank, r.name]);

/**
 * Highest total first; ties share a place and the place after a tie is
 * skipped, the way a race is scored.
 */
describe('rankLeaders', () => {
  it('numbers distinct totals from 1, highest first', () => {
    expect(ranks([row('Cy', 10), row('Ana', 40), row('Ben', 30)])).toEqual([
      [1, 'Ana'],
      [2, 'Ben'],
      [3, 'Cy'],
    ]);
  });

  it('gives a tie one shared place and skips the next', () => {
    expect(ranks([row('Ana', 40), row('Ben', 30), row('Cy', 30), row('Dee', 10)]).map((r) => r[0])).toEqual([
      1, 2, 2, 4,
    ]);
  });

  it('puts everyone first when everyone is tied', () => {
    expect(ranks([row('Ana', 5), row('Ben', 5), row('Cy', 5)]).map((r) => r[0])).toEqual([1, 1, 1]);
  });

  it('lists whoever reached a tied total first ahead', () => {
    expect(ranks([row('Late', 30, 20), row('Early', 30, 3)])).toEqual([
      [1, 'Early'],
      [1, 'Late'],
    ]);
  });

  it('falls back to name when both reached it at the same instant', () => {
    expect(ranks([row('Zoe', 30, 5), row('Abe', 30, 5)])).toEqual([
      [1, 'Abe'],
      [1, 'Zoe'],
    ]);
  });

  it('leaves off members with no points', () => {
    expect(ranks([row('Ana', 40), row('Nil', 0)])).toEqual([[1, 'Ana']]);
  });

  // Five places, not five rows: cutting a tie in half would hide someone the
  // numbering says shares the place.
  it('keeps everyone tied for the last place shown', () => {
    const board = ranks([
      row('A', 40),
      row('B', 30),
      row('C', 20),
      row('D', 10),
      row('E', 5),
      row('F', 5, 2),
      row('G', 1),
    ]);
    expect(board).toEqual([
      [1, 'A'],
      [2, 'B'],
      [3, 'C'],
      [4, 'D'],
      [5, 'E'],
      [5, 'F'],
    ]);
  });

  it('stops at the place limit when there is no tie across it', () => {
    expect(ranks([row('A', 40), row('B', 30), row('C', 20)], 2)).toEqual([
      [1, 'A'],
      [2, 'B'],
    ]);
  });

  it('carries every field through', () => {
    const reachedAt = new Date(Date.now() - DAY);
    expect(rankLeaders([{ name: 'Ana', points: 40, avatarUrl: null, reachedAt }], 5)).toEqual([
      { rank: 1, name: 'Ana', points: 40, avatarUrl: null, reachedAt },
    ]);
  });

  it('ranks nobody when there is nobody', () => {
    expect(rankLeaders([], 5)).toEqual([]);
  });
});
