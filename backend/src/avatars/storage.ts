import { randomUUID } from 'node:crypto';
import { Storage } from '@google-cloud/storage';
import { env } from '../env';

/**
 * Profile pictures live in their own bucket and never pass through this
 * process: the app asks for a signed URL and PUTs the bytes straight to GCS.
 * Cloud Run would otherwise buffer every upload for no reason.
 */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/** Content type to file extension. Anything absent here is refused. */
export const AVATAR_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// Built on first use so that importing this module — which auth/user.ts does,
// only for publicUrl — does not construct a GCS client.
let client: Storage | undefined;
function storage(): Storage {
  client ??= new Storage();
  return client;
}

/** Every object a member owns sits under this prefix. */
export function avatarPrefix(userId: string): string {
  return `users/${userId}/`;
}

/**
 * A ten-minute write URL for one specific new object. The random name means a
 * replaced picture never collides with the one it replaces, and the size
 * header is signed into the URL, so the cap is enforced by GCS rather than by
 * trusting the client.
 */
export async function createUploadUrl(
  userId: string,
  contentType: string,
): Promise<{ url: string; objectPath: string }> {
  const objectPath = `${avatarPrefix(userId)}${randomUUID()}.${AVATAR_CONTENT_TYPES[contentType]}`;

  const [url] = await storage()
    .bucket(env.avatarsBucket)
    .file(objectPath)
    .getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 10 * 60_000,
      contentType,
      extensionHeaders: { 'x-goog-content-length-range': `0,${AVATAR_MAX_BYTES}` },
    });

  return { url, objectPath };
}

export async function deleteObject(objectPath: string): Promise<void> {
  await storage().bucket(env.avatarsBucket).file(objectPath).delete({ ignoreNotFound: true });
}

export function publicUrl(objectPath: string): string {
  return `https://storage.googleapis.com/${env.avatarsBucket}/${objectPath}`;
}
