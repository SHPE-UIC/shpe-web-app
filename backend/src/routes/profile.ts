import { eq } from 'drizzle-orm';
import { Router } from 'express';
import {
  AVATAR_CONTENT_TYPES,
  AVATAR_MAX_BYTES,
  avatarPrefix,
  createUploadUrl,
  deleteObject,
} from '../avatars/storage';
import { toPublicUser } from '../auth/user';
import { db } from '../db';
import { users } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { badRequest, forbidden, HttpError } from '../middleware/errors';
import { env } from '../env';

export const profileRoutes = Router();

/**
 * Hands back a URL the app can PUT an image to directly. The path is chosen
 * here, not by the client, so a member can only ever be handed a URL for
 * their own prefix.
 */
profileRoutes.post('/avatar/upload-url', requireAuth, async (req, res) => {
  if (!env.avatarsBucket) {
    throw new HttpError(503, 'Profile pictures are not configured on this server', 'avatars_disabled');
  }

  const contentType = typeof req.body?.contentType === 'string' ? req.body.contentType : '';
  if (!AVATAR_CONTENT_TYPES[contentType]) {
    throw badRequest('Pictures must be a JPEG, PNG, or WebP image', 'bad_content_type');
  }

  const { url, objectPath } = await createUploadUrl(req.currentUser!.id, contentType);
  res.status(201).json({ url, objectPath, maxBytes: AVATAR_MAX_BYTES });
});

/**
 * Points the member's row at an object they have just uploaded.
 *
 * The signed URL already limits where they can write, but adopting is a
 * separate request, so the prefix is checked again here — otherwise a member
 * could claim somebody else's picture as their own.
 */
profileRoutes.put('/avatar', requireAuth, async (req, res) => {
  const user = req.currentUser!;
  const objectPath = typeof req.body?.objectPath === 'string' ? req.body.objectPath : '';

  if (
    !objectPath.startsWith(avatarPrefix(user.id)) ||
    objectPath.includes('..')
  ) {
    throw forbidden('That picture does not belong to your account', 'not_your_object');
  }

  const [updated] = await db
    .update(users)
    .set({ avatarPath: objectPath })
    .where(eq(users.id, user.id))
    .returning();

  if (!updated) throw new Error('Update returned no row');

  // The replaced object is nobody's now. Failing to remove it must not fail
  // the request — the new picture is already live.
  if (user.avatarPath && user.avatarPath !== objectPath) {
    await deleteObject(user.avatarPath).catch(() => {});
  }

  res.json({ user: toPublicUser(updated) });
});
