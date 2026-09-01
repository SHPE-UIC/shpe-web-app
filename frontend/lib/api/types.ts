import type { Role } from '../roles';
// Response shapes from the API.
//
// Hand-written rather than imported from the backend: the web build never
// installs the backend's dependencies, so a shared type would need npm
// workspaces. The contract tests keep these honest.

export const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;
export const SCHOOL_LEVEL_OPTIONS = [
  'Freshman',
  'Sophomore',
  'Junior',
  'Senior',
  'Graduate',
] as const;

export type Gender = (typeof GENDER_OPTIONS)[number];
export type SchoolLevel = (typeof SCHOOL_LEVEL_OPTIONS)[number];

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  gender: string | null;
  schoolLevel: string | null;
  memberId: string | null;
  avatarUrl: string | null;
  role: Role;
  roleLabel: string;
  createdAt: string;
};

/** What GET /api/auth/me hands back. */
export type MeResponse = {
  user: PublicUser;
  /**
   * The Firebase `email_verified` claim as the API saw it on this request.
   * Every other endpoint answers 403 `email_unverified` while it is false, so
   * this is what the app checks before rendering anything else.
   */
  emailVerified: boolean;
};

/** What POST /api/profile/avatar/upload-url hands back. */
export type UploadTicket = {
  url: string;
  objectPath: string;
  maxBytes: number;
};

export type RegistrationPayload = {
  email: string;
  password: string;
  name: string;
  gender: Gender;
  /** Required when gender is 'Other', null otherwise. */
  genderSelfDescribed?: string | null;
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
