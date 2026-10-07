type Total = {
  name: string;
  points: number;
  /** When the member reached this total: their latest check-in that earned points. */
  reachedAt: Date | string | null;
};

const time = (at: Total['reachedAt']) => (at ? new Date(at).getTime() : 0);

/**
 * Turns every member's total into the board: highest first, ties broken by
 * whoever reached the total first and then by name, numbered the way a race is
 * scored — a tie shares a place and the place after it is skipped (1, 2, 2, 4).
 *
 * Keeps every row whose place is within `places`, so everyone tied for the last
 * place shown is shown too: five places can be more than five rows. Members
 * with no points are left off.
 *
 * Here rather than in SQL so the ordering and the cut are tested; the query
 * only aggregates.
 */
export function rankLeaders<T extends Total>(rows: T[], places: number): (T & { rank: number })[] {
  const ordered = rows
    .filter((row) => row.points > 0)
    .sort(
      (a, b) =>
        b.points - a.points ||
        time(a.reachedAt) - time(b.reachedAt) ||
        // A fixed locale, so the server's own cannot reorder accented names.
        a.name.localeCompare(b.name, 'en'),
    );

  // Places only grow down the list, so the first row past the cut ends it.
  const board: (T & { rank: number })[] = [];
  for (const row of ordered) {
    const previous = board[board.length - 1];
    const rank = previous && previous.points === row.points ? previous.rank : board.length + 1;
    if (rank > places) break;
    board.push({ ...row, rank });
  }
  return board;
}
