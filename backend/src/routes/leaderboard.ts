import { eq, sql, sum } from 'drizzle-orm';
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
 * name, a picture, and a total and nothing else — no id field, no email,
 * nothing that reaches a profile. The response is built by naming those four
 * fields rather than by passing rows through, so a column added to the select
 * later cannot leak.
 *
 * The picture's URL does carry the member's account id, in its object path
 * (users/<id>/…). That is accepted rather than hidden: the id is an opaque
 * UUID that no member-facing route takes, so it leads nowhere, and the bucket
 * is public-read already.
 *
 * Officers compete like anyone else. The query only totals each member's
 * points; ordering, ties, and the cut are rankLeaders', where they are tested.
 * When a total was reached is the latest check-in that earned points: a later
 * check-in worth nothing did not change the total, so it must not move a tie.
 * One row per member who has checked in is a chapter's worth, not a scale
 * concern.
 */
leaderboardRoutes.get('/', requireAuth, async (_req, res) => {
  const totals = await db
    .select({
      name: users.name,
      avatarPath: users.avatarPath,
      points: sum(checkIns.points).mapWith(Number),
      reachedAt: sql`max(${checkIns.createdAt}) filter (where ${checkIns.points} > 0)`.mapWith(
        checkIns.createdAt,
      ),
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
