import { readFileSync } from 'node:fs';

/**
 * Service account credentials, from either source:
 *
 *  - GOOGLE_SERVICE_ACCOUNT_JSON — the whole key file inlined. Use this on
 *    hosts with no writable filesystem to drop a file onto.
 *  - GOOGLE_SERVICE_ACCOUNT_KEY_PATH — a path to the downloaded JSON. Easier
 *    locally, and what Render's Secret Files produce (/etc/secrets/<name>).
 */
export function loadServiceAccount() {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (inline) {
    try {
      return JSON.parse(inline);
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is set but is not valid JSON');
    }
  }

  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (!keyPath) {
    throw new Error(
      'No service account configured. Set GOOGLE_SERVICE_ACCOUNT_KEY_PATH to the ' +
        'key file, or GOOGLE_SERVICE_ACCOUNT_JSON to its contents.',
    );
  }

  let raw;
  try {
    raw = readFileSync(keyPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(
        `Service account key not found at ${keyPath}. Download it from Firebase ` +
          'Console > Project settings > Service accounts, or set ' +
          'GOOGLE_SERVICE_ACCOUNT_JSON instead.',
      );
    }
    throw err;
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Service account key at ${keyPath} is not valid JSON`);
  }
}
