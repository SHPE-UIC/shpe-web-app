import { publicUrl } from '../avatars/storage';
import type { User } from '../db/schema';
import { roleLabel, type Role } from '../roles';

/** The user shape the API is willing to hand out. Never includes passwordHash. */
export type PublicUser = {
  id: string;
  email: string;
  name: string;
  gender: string | null;
  schoolLevel: string | null;
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
 */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    gender: user.gender ?? null,
    schoolLevel: user.schoolLevel ?? null,
    memberId: user.memberId,
    avatarUrl: user.avatarPath ? publicUrl(user.avatarPath) : null,
    role: user.role,
    roleLabel: roleLabel(user.role),
    createdAt: user.createdAt.toISOString(),
  };
}
