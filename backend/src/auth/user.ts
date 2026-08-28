import type { User } from '../db/schema';

/** The user shape the API is willing to hand out. Never includes passwordHash. */
export type PublicUser = {
  id: string;
  email: string;
  name: string;
  age: number | null;
  sexAtBirth: string | null;
  gender: string | null;
  schoolLevel: string | null;
  memberId: string | null;
  isAdmin: boolean;
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
    age: user.age,
    sexAtBirth: user.sexAtBirth ?? null,
    gender: user.gender,
    schoolLevel: user.schoolLevel ?? null,
    memberId: user.memberId,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt.toISOString(),
  };
}
