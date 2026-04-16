import type { Timestamp, FieldValue } from 'firebase/firestore';

export const SEX_AT_BIRTH_OPTIONS = ['Male', 'Female'] as const;
export type SexAtBirth = (typeof SEX_AT_BIRTH_OPTIONS)[number];

export const SCHOOL_LEVEL_OPTIONS = [
  'Freshman',
  'Sophomore',
  'Junior',
  'Senior',
  'Graduate',
] as const;
export type SchoolLevel = (typeof SCHOOL_LEVEL_OPTIONS)[number];

export interface UserProfileInput {
  name: string;
  age: number;
  sexAtBirth: SexAtBirth;
  gender: string;
  schoolLevel: SchoolLevel;
  memberId: string;
}

export interface UserProfile extends UserProfileInput {
  email: string;
  isAdmin: boolean;
  createdAt: Timestamp | FieldValue;
}
