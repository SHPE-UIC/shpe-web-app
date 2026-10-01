import { eq, max, sum } from 'drizzle-orm';
import { Router } from 'express';
import { avatarUrlFor } from '../avatars/storage';
import { db } from '../db';
import { checkIns, users } from '../db/schema';
import { rankLeaders } from '../leaderboard/rank';
import { requireAuth } from '../middleware/auth';

/** How many places the home screen shows — more rows when the last is tied. */
const PLACES = 5;

export type Leader = {
  rank: number;
  name: string;
  avatarUrl: string | null;
  points: number;
};

export const leaderboardRoutes = Router();

/**
 * The top five by all-time check-in points, for every signed-in member.
 *
 * This is the one route that shows a member other members, so it hands out a
 * name, a picture, and a total and nothing else — no id, no email, nothing
 * that identifies an account or reaches a profile. The response is built by
 * naming those four fields rather than by passing rows through, so a column
 * added to the select later cannot leak.
 *
 * Officers compete like anyone else. The query only totals each member's
 * points; ordering, ties, and the cut are rankLeaders', where they are tested.
 * One row per member who has checked in is a chapter's worth, not a scale
 * concern.
 */
leaderboardRoutes.get('/', requireAuth, async (_req, res) => {
  const totals = await db
    .select({
      name: users.name,
      avatarPath: users.avatarPath,
      points: sum(checkIns.points).mapWith(Number),
      reachedAt: max(checkIns.createdAt),
    })
    .from(checkIns)
    .innerJoin(users, eq(checkIns.userId, users.id))
    .groupBy(users.id);

  const leaders: Leader[] = rankLeaders(totals, PLACES).map((row) => ({
    rank: row.rank,
    name: row.name,
    avatarUrl: avatarUrlFor(row.avatarPath),
    points: row.points,
  }));

  res.json({ leaders });
});
