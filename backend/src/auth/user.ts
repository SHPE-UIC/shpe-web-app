import { avatarUrlFor } from '../avatars/storage';
import type { User } from '../db/schema';
import { roleLabel, type Role } from '../roles';

/** The user shape the API is willing to hand out. Never includes passwordHash. */
export type PublicUser = {
  id: string;
  email: string;
  name: string;
  gender: string | null;
  schoolLevel: string | null;
  /** The member's own words, when their school level is 'Other'. */
  schoolLevelOther: string | null;
  majors: string[];
  /** A major outside the list. Shown to the member, never used to select them. */
  majorOther: string | null;
  memberId: string | null;
  /** Fully resolved, or null when the member has not set a picture. */
  avatarUrl: string | null;
  role: Role;
  /** Sent alongside the number so screens do not each re-implement it. */
  roleLabel: string;
  createdAt: string;
};

/**
 * Built by naming every field explicitly rather than spreading and deleting.
 * A column added to `users` later cannot leak through this by accident.
 *
 * `uin` is absent on purpose and must stay so: it is Top 8 material, served by
 * GET /api/admin/members/:id/uin alone. Putting it on the shape every route
 * returns is precisely how it would reach every officer, and the member's own
 * screens, without anyone deciding that it should.
 */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    gender: user.gender ?? null,
    schoolLevel: user.schoolLevel ?? null,
    schoolLevelOther: user.schoolLevelOther ?? null,
    majors: user.majors ?? [],
    majorOther: user.majorOther ?? null,
    memberId: user.memberId,
    avatarUrl: avatarUrlFor(user.avatarPath),
    role: user.role,
    roleLabel: roleLabel(user.role),
    createdAt: user.createdAt.toISOString(),
  };
}
