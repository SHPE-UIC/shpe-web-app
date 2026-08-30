import type { Role } from '../roles';
// Response shapes from the API.
//
// Hand-written rather than imported from the backend: the web build never
// installs the backend's dependencies, so a shared type would need npm
// workspaces. The contract tests keep these honest.

export const SEX_AT_BIRTH_OPTIONS = ['Male', 'Female'] as const;
export const SCHOOL_LEVEL_OPTIONS = [
  'Freshman',
  'Sophomore',
  'Junior',
  'Senior',
  'Graduate',
] as const;

export type SexAtBirth = (typeof SEX_AT_BIRTH_OPTIONS)[number];
export type SchoolLevel = (typeof SCHOOL_LEVEL_OPTIONS)[number];

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  age: number | null;
  sexAtBirth: string | null;
  gender: string | null;
  schoolLevel: string | null;
  memberId: string | null;
  role: Role;
  roleLabel: string;
  createdAt: string;
};

/** What /api/auth/register returns. Sessions are Firebase's, so no token. */
export type AuthResponse = {
  user: PublicUser;
};

export type RegistrationPayload = {
  email: string;
  password: string;
  name: string;
  age?: number | null;
  sexAtBirth?: SexAtBirth | null;
  gender?: string | null;
  schoolLevel?: SchoolLevel | null;
  memberId?: string | null;
};

export type PublicEvent = {
  id: string;
  name: string;
  description: string;
  location: string;
  tag: string;
  points: number;
  /** ISO 8601 instant. */
  startsAt: string;
  /** ISO 8601 instant. For an all-day event this is the exclusive end. */
  endsAt: string;
  allDay: boolean;
  /** 'google_calendar' or 'manual'. */
  source: string;
};
