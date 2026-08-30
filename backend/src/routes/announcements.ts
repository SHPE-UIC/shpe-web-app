import { and, desc, isNotNull, lte } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { recordAudit } from '../audit';
import { db } from '../db';
import { isBoardOrAbove } from '../roles';
import { announcements, type Announcement } from '../db/schema';
import { requireBoard, requireAuth } from '../middleware/auth';
import { badRequest, notFoundError } from '../middleware/errors';

/**
 * Accent colours are theme keys, not raw colours, so the palette stays defined
 * in one place on the client and an announcement cannot introduce an off-brand
 * colour.
 */
export const ACCENTS = ['navy', 'blue', 'orange', 'teal'] as const;
export type Accent = (typeof ACCENTS)[number];

export type PublicAnnouncement = {
  id: string;
  title: string;
  body: string;
  accent: string | null;
  publishedAt: string | null;
  createdAt: string;
};

export function toPublicAnnouncement(row: Announcement): PublicAnnouncement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    accent: row.accent,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function announcementId(req: { params: Record<string, string | string[]> }): string {
  const raw = req.params.id;
  const id = Array.isArray(raw) ? (raw[0] ?? '') : raw ?? '';
  // Checked here so a stray path does not reach Postgres as a bad uuid and
  // surface as a 500.
  if (!UUID.test(id)) throw notFoundError('That announcement does not exist', 'not_found');
  return id;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseAccent(value: unknown): Accent | null {
  const accent = str(value);
  if (!accent) return null;
  if (!(ACCENTS as readonly string[]).includes(accent)) {
    throw badRequest(`Accent must be one of: ${ACCENTS.join(', ')}`, 'accent_invalid');
  }
  return accent as Accent;
}

export const announcementRoutes = Router();

announcementRoutes.use(requireAuth);

/**
 * Members see published announcements; officers see drafts too, so they can
 * check one over before it goes out.
 *
 * A future publishedAt is a scheduled post and stays hidden until it passes.
 */
announcementRoutes.get('/', async (req, res) => {
  const visible = and(
    isNotNull(announcements.publishedAt),
    lte(announcements.publishedAt, new Date()),
  );

  const rows = await (isBoardOrAbove(req.currentUser!.role)
    ? db.select().from(announcements).orderBy(desc(announcements.createdAt))
    : db
        .select()
        .from(announcements)
        .where(visible)
        .orderBy(desc(announcements.publishedAt)));

  res.json({ announcements: rows.map(toPublicAnnouncement) });
});

announcementRoutes.post('/', requireBoard, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;

  const title = str(body.title);
  const text = str(body.body);
  if (!title) throw badRequest('Title is required', 'title_required');
  if (!text) throw badRequest('Body is required', 'body_required');

  const [created] = await db
    .insert(announcements)
    .values({
      title,
      body: text,
      accent: parseAccent(body.accent),
      authorId: req.currentUser!.id,
      // Publishes immediately unless explicitly created as a draft.
      publishedAt: body.draft === true ? null : new Date(),
    })
    .returning();

  void recordAudit({
    actor: req.currentUser!,
    action: 'create',
    entity: 'announcement',
    entityId: created!.id,
    entityLabel: created!.title,
  });

  res.status(201).json({ announcement: toPublicAnnouncement(created!) });
});

announcementRoutes.patch('/:id', requireBoard, async (req, res) => {
  const id = announcementId(req);
  const [existing] = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
  if (!existing) throw notFoundError('That announcement does not exist', 'not_found');

  const body = (req.body ?? {}) as Record<string, unknown>;
  const update: Partial<typeof announcements.$inferInsert> = {};
  // Which fields this request actually touched, for the audit entry.
  const edited: string[] = [];

  if (body.title !== undefined) {
    const title = str(body.title);
    if (!title) throw badRequest('Title cannot be empty', 'title_required');
    update.title = title;
    edited.push('title');
  }
  if (body.body !== undefined) {
    const text = str(body.body);
    if (!text) throw badRequest('Body cannot be empty', 'body_required');
    update.body = text;
    edited.push('body');
  }
  if (body.accent !== undefined) {
    update.accent = parseAccent(body.accent);
    edited.push('accent');
  }
  if (body.draft !== undefined) {
    // Unpublishing keeps the row but hides it again; re-publishing stamps a
    // fresh time so it returns to the top of the feed.
    update.publishedAt = body.draft === true ? null : (existing.publishedAt ?? new Date());
    edited.push(body.draft === true ? 'unpublished' : 'published');
  }

  if (Object.keys(update).length === 0) {
    throw badRequest('No editable fields were provided', 'nothing_to_update');
  }

  const [updated] = await db
    .update(announcements)
    .set(update)
    .where(eq(announcements.id, id))
    .returning();

  void recordAudit({
    actor: req.currentUser!,
    action: 'update',
    entity: 'announcement',
    entityId: updated!.id,
    entityLabel: updated!.title,
    changedFields: edited,
  });

  res.json({ announcement: toPublicAnnouncement(updated!) });
});

announcementRoutes.delete('/:id', requireBoard, async (req, res) => {
  const removed = await db
    .delete(announcements)
    .where(eq(announcements.id, announcementId(req)))
    .returning({ id: announcements.id, title: announcements.title });

  if (removed.length === 0) throw notFoundError('That announcement does not exist', 'not_found');

  void recordAudit({
    actor: req.currentUser!,
    action: 'delete',
    entity: 'announcement',
    entityId: removed[0]!.id,
    entityLabel: removed[0]!.title,
  });
  res.status(204).end();
});
