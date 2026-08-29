import { sql } from 'drizzle-orm';
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

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    age: integer('age'),
    sexAtBirth: text('sex_at_birth').$type<SexAtBirth>(),
    gender: text('gender'),
    schoolLevel: text('school_level').$type<SchoolLevel>(),
    memberId: text('member_id'),
    isAdmin: boolean('is_admin').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Case-insensitive uniqueness: Ann@uic.edu and ann@uic.edu are one person.
    uniqueIndex('users_email_lower_idx').on(sql`lower(${table.email})`),
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
export type AuditEntity = 'event' | 'announcement';
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
