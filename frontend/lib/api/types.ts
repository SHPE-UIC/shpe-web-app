// Response shapes from the Render API.
//
// Hand-written rather than imported from the backend: Vercel builds this
// directory in isolation and never installs the backend's dependencies, so a
// shared type would need npm workspaces. The contract tests keep these honest.

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
  isAdmin: boolean;
  createdAt: string;
};

export type AuthResponse = {
  token: string;
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
