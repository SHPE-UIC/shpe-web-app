import { sql } from 'drizzle-orm';
import { ROLE, type Role } from '../roles';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/** Where an event came from. Decides whether the calendar sync may touch it. */
export type EventSource = 'google_calendar' | 'manual';

/**
 * The only demographic the chapter collects. Replaced a free-text gender
 * field and a separate sex-at-birth question, both retired at the Top 8's
 * request along with age.
 */
export const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;

/**
 * How far along a member is. Mirrors the wording of the chapter's intake form
 * rather than the four US class years, which had no room for a fifth- or
 * sixth-year undergraduate or for a PhD student.
 */
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
 * The majors a member can be selected by — for a mailing about one department,
 * an event aimed at one programme, a breakdown of the chapter.
 *
 * 'Other' is deliberately not among them. See the note on `users.majors`.
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

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    /** Firebase's uid for this member. Equals `id` by convention. */
    firebaseUid: text('firebase_uid'),
    name: text('name').notNull(),
    /** Null only on rows that predate the fixed option set. */
    gender: text('gender').$type<Gender>(),
    /**
     * How the member describes their gender, in their own words.
     *
     * Set only alongside `gender = 'Other'`, and required there — 'Other' by
     * itself records nothing. Kept in its own column rather than widening
     * `gender`, so that column stays one of three known values and the two
     * cases stay distinguishable.
     */
    genderSelfDescribed: text('gender_self_described'),
    schoolLevel: text('school_level').$type<SchoolLevel>(),
    /**
     * The member's own words for a school level of 'Other'. Same shape, and
     * the same reasoning, as `genderSelfDescribed`.
     */
    schoolLevelOther: text('school_level_other'),
    /**
     * Every major the member picked, from MAJOR_OPTIONS and nothing else.
     *
     * An 'Other' answer lives in `majorOther` instead of in here, unlike the
     * 'Other' that `gender` stores inline. The chapter's rule is that an Other
     * major never drives a feature, and a value in this array would have to be
     * excluded again by every targeting query, every aggregate, and every
     * filter written later — the one that forgets sends a Computer Science
     * mailing to someone studying Art History. Keeping the array canonical puts
     * that rule in the data rather than in each caller's memory.
     */
    majors: text('majors')
      .array()
      .$type<Major[]>()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** A major outside the list, in the member's words. Never targetable. */
    majorOther: text('major_other'),
    memberId: text('member_id'),
    /**
     * The university's student number — nine digits, and not the SHPE
     * membership number in `memberId`, which merely looks like one.
     *
     * Text rather than an integer: it is an identifier, so a leading zero is
     * part of it and arithmetic on it is meaningless. Unique because one UIN
     * belongs to one student, so a second account claiming it is either a typo
     * or a duplicate — the same thing the email index already refuses.
     */
    uin: text('uin'),
    /** Object path in the avatars bucket, not a URL — the bucket can move. */
    avatarPath: text('avatar_path'),
    /**
     * 0 member, 1 board member, 2 top 8. See ../roles.ts.
     *
     * Ordered so every permission check is "this level or above" — a
     * comparison, not a lookup.
     */
    role: integer('role').$type<Role>().notNull().default(ROLE.MEMBER),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Case-insensitive uniqueness: Ann@uic.edu and ann@uic.edu are one person.
    uniqueIndex('users_email_lower_idx').on(sql`lower(${table.email})`),
    uniqueIndex('users_firebase_uid_idx').on(table.firebaseUid),
    uniqueIndex('users_uin_idx').on(table.uin),
  ],
);

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** Null for events created in the admin screens. */
    googleCalendarEventId: text('google_calendar_event_id').unique(),
    source: text('source').$type<EventSource>().notNull().default('manual'),

    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    location: text('location').notNull().default(''),
    tag: text('tag').notNull().default('Event'),
    points: integer('points').notNull().default(0),

    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    allDay: boolean('all_day').notNull().default(false),

    /**
     * Field names an admin has edited in-app. The calendar sync skips exactly
     * these and overwrites everything else, so one manual correction does not
     * freeze the whole row against future calendar changes.
     */
    overriddenFields: text('overridden_fields')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),

    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('events_upcoming_idx').on(table.endsAt, table.startsAt)],
);

export const checkIns = pgTable(
  'check_ins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),

    /**
     * Snapshot of events.points at scan time, not a join. Recoloring an event
     * later changes what it is worth going forward; it must not silently
     * revalue attendance already recorded.
     */
    points: integer('points').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One check-in per member per event — this is what rejects a second scan.
    uniqueIndex('check_ins_user_event_idx').on(table.userId, table.eventId),
  ],
);

export const announcements = pgTable('announcements', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  /** Theme colour key (navy / blue / orange / teal), resolved on the client. */
  accent: text('accent'),
  authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** What kind of thing an audit entry is about. */
export type AuditEntity = 'event' | 'announcement' | 'member';
export type AuditAction = 'create' | 'update' | 'delete';

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),

    /**
     * Snapshots, denormalised on purpose. Both the officer and the thing they
     * changed can be gone by the time anyone reads the log, and "someone
     * deleted a3f9…" answers nothing.
     */
    actorEmail: text('actor_email').notNull(),
    entityLabel: text('entity_label').notNull(),

    action: text('action').$type<AuditAction>().notNull(),
    entity: text('entity').$type<AuditEntity>().notNull(),
    entityId: uuid('entity_id').notNull(),

    /** Which fields an update touched. Empty for creates and deletes. */
    changedFields: text('changed_fields')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('audit_log_recent_idx').on(table.createdAt)],
);

export const syncState = pgTable('sync_state', {
  key: text('key').primaryKey(),
  nextSyncToken: text('next_sync_token'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  lastResult: jsonb('last_result'),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type CheckIn = typeof checkIns.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
