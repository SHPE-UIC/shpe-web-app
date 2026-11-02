// Puts the local stack into the state the accessibility scan expects: one
// member, one Top 8, an event running now, one coming up, one already over, a
// published announcement, and attendance at the past event.
//
// Usage: npm run e2e:seed   (with the same environment as `npm start`)
//
// It starts by deleting everything — every table's rows and every emulator
// account — so the scan sees the same screens on every run. That is only safe
// on a throwaway stack, which is what assertLocalOnly and assertNotCloudSql
// check before anything else happens.
import { readFileSync } from 'node:fs';
import { is, sql } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { createFirebaseUser } from '../auth/firebase';
import { announcements, checkIns, db, events, pool, users } from '../db';
import * as schema from '../db/schema';
import { ROLE, type Role } from '../roles';
import { assertLocalOnly, assertNotCloudSql } from './guard';

type Account = { id: string; email: string; password: string; name: string; uin: string };

/** Shared with the Playwright scan, which signs in as these and visits these ids. */
type Fixtures = {
  member: Account;
  officer: Account;
  events: { live: string; upcoming: string; past: string };
  announcement: string;
};

const fixtures = JSON.parse(
  readFileSync(new URL('../../../frontend/e2e/fixtures.json', import.meta.url), 'utf8'),
) as Fixtures;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function resetEmulator(): Promise<void> {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST!;
  // The Admin SDK's own precedence, so the accounts cleared here are in the
  // project createFirebaseUser writes to.
  const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  if (!project) throw new Error('Set GCLOUD_PROJECT (demo-shpe) so the seed knows which emulator project to clear.');
  const res = await fetch(`http://${host}/emulator/v1/projects/${project}/accounts`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Could not clear the Auth emulator: HTTP ${res.status}`);
}

async function createMember(account: Account, role: Role): Promise<void> {
  // Same shape registration produces: one id on both sides.
  await createFirebaseUser({
    uid: account.id,
    email: account.email,
    password: account.password,
    displayName: account.name,
  });
  await db.insert(users).values({
    id: account.id,
    firebaseUid: account.id,
    email: account.email,
    name: account.name,
    gender: 'Female',
    schoolLevel: 'Junior',
    majors: ['Computer Science'],
    memberId: '123456789',
    uin: account.uin,
    role,
  });
}

async function seed(): Promise<void> {
  assertLocalOnly(process.env);
  await assertNotCloudSql((text) => pool.query(text));

  // Every table in the schema, so one added later is wiped too.
  const tables = Object.values(schema).filter((value) => is(value, PgTable));
  await db.execute(sql`truncate table ${sql.join(tables, sql`, `)} restart identity cascade`);
  await resetEmulator();

  await createMember(fixtures.member, ROLE.MEMBER);
  await createMember(fixtures.officer, ROLE.TOP8);

  const now = Date.now();
  await db.insert(events).values([
    {
      // Running now, so check-in and the organizer QR render their open state.
      id: fixtures.events.live,
      name: 'General Body Meeting',
      description: 'Updates from the board, then pizza.',
      location: 'SCE 605',
      tag: 'GBM',
      points: 10,
      startsAt: new Date(now - HOUR / 2),
      endsAt: new Date(now + 2 * HOUR),
    },
    {
      id: fixtures.events.upcoming,
      name: 'Resume Workshop',
      description: 'Bring a printed copy.',
      location: 'ERF 1043',
      tag: 'Professional',
      points: 15,
      startsAt: new Date(now + 7 * DAY),
      endsAt: new Date(now + 7 * DAY + 2 * HOUR),
    },
    {
      id: fixtures.events.past,
      name: 'Welcome Social',
      description: '',
      location: 'Quad',
      tag: 'Social',
      points: 5,
      startsAt: new Date(now - 7 * DAY),
      endsAt: new Date(now - 7 * DAY + 2 * HOUR),
    },
  ]);

  await db.insert(announcements).values({
    id: fixtures.announcement,
    title: 'Dues are open',
    body: 'Pay by the end of the month to keep your membership active.',
    accent: 'blue',
    authorId: fixtures.officer.id,
    publishedAt: new Date(now - HOUR),
  });

  // Both attended the past event, so the attendance screen and the member
  // roster have rows to render.
  await db.insert(checkIns).values([
    { userId: fixtures.member.id, eventId: fixtures.events.past, points: 5 },
    { userId: fixtures.officer.id, eventId: fixtures.events.past, points: 5 },
  ]);

  console.log('Seeded: 2 accounts, 3 events, 1 announcement, 2 check-ins.');
}

try {
  await seed();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
