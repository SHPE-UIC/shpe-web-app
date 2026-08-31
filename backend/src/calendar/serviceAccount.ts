import { readFileSync } from 'node:fs';

export type ServiceAccountKey = {
  client_email: string;
  private_key: string;
  project_id?: string;
  [key: string]: unknown;
};

/**
 * Service account credentials, from either source:
 *
 *  - GOOGLE_SERVICE_ACCOUNT_JSON — the whole key file inlined. Use this on
 *    hosts with no writable filesystem to drop a file onto.
 *  - GOOGLE_SERVICE_ACCOUNT_KEY_PATH — a path to the downloaded JSON. Easier
 *    locally.
 *
 * With neither set this returns null and the caller falls back to Application
 * Default Credentials — on Cloud Run that is the runtime service account via
 * the metadata server, so no key file exists anywhere.
 */
export function loadServiceAccount(): ServiceAccountKey | null {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (inline) {
    try {
      return JSON.parse(inline) as ServiceAccountKey;
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is set but is not valid JSON');
    }
  }

  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (!keyPath) return null;

  let raw: string;
  try {
    raw = readFileSync(keyPath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `Service account key not found at ${keyPath}. Download it from the Google ` +
          'Cloud console under IAM > Service accounts, or set ' +
          'GOOGLE_SERVICE_ACCOUNT_JSON instead.',
      );
    }
    throw err;
  }

  try {
    return JSON.parse(raw) as ServiceAccountKey;
  } catch {
    throw new Error(`Service account key at ${keyPath} is not valid JSON`);
  }
}
