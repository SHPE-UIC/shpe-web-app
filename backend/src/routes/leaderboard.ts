import { asc, desc, eq, gt, max, sum } from 'drizzle-orm';
import { Router } from 'express';
import { avatarUrlFor } from '../avatars/storage';
import { db } from '../db';
import { checkIns, users } from '../db/schema';
import { rankLeaders } from '../leaderboard/rank';
import { requireAuth } from '../middleware/auth';

/** How many places the home screen shows. */
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
 * Officers compete like anyone else. Ties are broken by whoever reached the
 * total first: their latest check-in is the earlier one. Name is last, only so
 * that two check-ins stamped in the same instant still list in a stable order.
 */
leaderboardRoutes.get('/', requireAuth, async (_req, res) => {
  const total = sum(checkIns.points).mapWith(Number);
  const reachedAt = max(checkIns.createdAt);

  const rows = await db
    .select({ name: users.name, avatarPath: users.avatarPath, points: total })
    .from(checkIns)
    .innerJoin(users, eq(checkIns.userId, users.id))
    .groupBy(users.id)
    .having(gt(total, 0))
    .orderBy(desc(total), asc(reachedAt), asc(users.name))
    .limit(PLACES);

  const leaders: Leader[] = rankLeaders(rows).map((row) => ({
    rank: row.rank,
    name: row.name,
    avatarUrl: avatarUrlFor(row.avatarPath),
    points: row.points,
  }));

  res.json({ leaders });
});
