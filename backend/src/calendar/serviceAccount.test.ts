import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadServiceAccount } from './serviceAccount';

const KEY = { client_email: 'svc@test.iam.gserviceaccount.com', private_key: 'pem' };

describe('loadServiceAccount', () => {
  let savedJson: string | undefined;
  let savedPath: string | undefined;

  beforeEach(() => {
    savedJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    savedPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  });

  afterEach(() => {
    if (savedJson === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    else process.env.GOOGLE_SERVICE_ACCOUNT_JSON = savedJson;
    if (savedPath === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
    else process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH = savedPath;
  });

  it('returns null when no key is configured, deferring to ADC', () => {
    expect(loadServiceAccount()).toBeNull();
  });

  it('parses an inline key from GOOGLE_SERVICE_ACCOUNT_JSON', () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(KEY);
    expect(loadServiceAccount()).toEqual(KEY);
  });

  it('still fails loudly on malformed inline JSON', () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = '{not json';
    expect(() => loadServiceAccount()).toThrow(/not valid JSON/);
  });

  it('still fails loudly when the key path points nowhere', () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH = 'C:/definitely/missing/key.json';
    expect(() => loadServiceAccount()).toThrow(/not found/);
  });
});
