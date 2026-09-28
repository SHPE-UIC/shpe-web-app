/**
 * Numbers leaderboard rows the way a race is scored: a tie shares a place, and
 * the place after it is skipped (1, 2, 2, 4).
 *
 * Expects the rows already in order. Ordering is the query's job, because the
 * tie-break — whoever reached the total first — needs data the rows here do
 * not carry.
 */
export function rankLeaders<T extends { points: number }>(rows: T[]): (T & { rank: number })[] {
  return rows.map((row) => {
    const firstWithSamePoints = rows.findIndex((other) => other.points === row.points);
    return { ...row, rank: firstWithSamePoints + 1 };
  });
}
