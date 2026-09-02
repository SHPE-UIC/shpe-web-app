import type { Role } from '../roles';
// Response shapes from the API.
//
// Hand-written rather than imported from the backend: the web build never
// installs the backend's dependencies, so a shared type would need npm
// workspaces. The contract tests keep these honest.

export const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;

/** Mirrors SCHOOL_LEVEL_OPTIONS in backend/src/db/schema.ts. */
export const SCHOOL_LEVEL_OPTIONS = [
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  'Graduate',
  'PhD',
  'Other',
] as const;

/**
 * Mirrors MAJOR_OPTIONS in backend/src/db/schema.ts.
 *
 * 'Other' is not here, and must not be added: the server drops it, because the
 * array is what future features select members by. The form offers Other as a
 * separate control that fills `majorOther`.
 */
export const MAJOR_OPTIONS = [
  'Biomedical Engineering',
  'Chemical Engineering',
  'Civil Engineering',
  'Computer Engineering',
  'Computer Science',
  'Data Science',
  'Electrical Engineering',
  'Engineering Management',
  'Engineering Physics',
  'Environmental Engineering',
  'Industrial Engineering',
  'Mechanical Engineering',
] as const;

export type Gender = (typeof GENDER_OPTIONS)[number];
export type SchoolLevel = (typeof SCHOOL_LEVEL_OPTIONS)[number];
export type Major = (typeof MAJOR_OPTIONS)[number];

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  gender: string | null;
  schoolLevel: string | null;
  schoolLevelOther: string | null;
  majors: string[];
  majorOther: string | null;
  memberId: string | null;
  avatarUrl: string | null;
  role: Role;
  roleLabel: string;
  createdAt: string;
  // No `uin` — it is Top 8 material and has its own endpoint. See UinResponse.
};

/** What GET /api/admin/members/:id/uin hands back. Top 8 only. */
export type UinResponse = { uin: string | null };

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
  schoolLevel: SchoolLevel;
  /** Required when schoolLevel is 'Other', null otherwise. */
  schoolLevelOther?: string | null;
  majors: Major[];
  /** A major outside the list. Either this or a non-empty `majors` is required. */
  majorOther?: string | null;
  memberId?: string | null;
  /** Nine digits. The university's number, not the SHPE one. */
  uin: string;
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
