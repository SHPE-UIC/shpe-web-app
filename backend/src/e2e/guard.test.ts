import { describe, expect, it } from 'vitest';
import { assertLocalOnly, assertNotCloudSql } from './guard';

const LOCAL = {
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  DATABASE_URL: 'postgresql://shpe:devpass@localhost:55432/shpe',
};

/**
 * The seed wipes every table and every Auth account before it writes. Pointed
 * at production it would delete the chapter, so it has to prove it is not.
 */
describe('assertLocalOnly', () => {
  it('lets a local database and the Auth emulator through', () => {
    expect(() => assertLocalOnly(LOCAL)).not.toThrow();
  });

  it('accepts 127.0.0.1 as well as localhost', () => {
    expect(() =>
      assertLocalOnly({ ...LOCAL, DATABASE_URL: 'postgresql://u:p@127.0.0.1:5432/shpe' }),
    ).not.toThrow();
  });

  // Without the emulator variable the Admin SDK talks to the real tenant.
  it('refuses when the Auth emulator is not configured', () => {
    expect(() => assertLocalOnly({ ...LOCAL, FIREBASE_AUTH_EMULATOR_HOST: undefined })).toThrow(
      /FIREBASE_AUTH_EMULATOR_HOST/,
    );
  });

  it('refuses a database that is not on this machine', () => {
    expect(() =>
      assertLocalOnly({
        ...LOCAL,
        DATABASE_URL: 'postgresql://u:p@/shpe?host=/cloudsql/shpe-webapp:us-central1:shpe',
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it('refuses a remote host that merely contains the word localhost', () => {
    expect(() =>
      assertLocalOnly({ ...LOCAL, DATABASE_URL: 'postgresql://u:p@localhost.evil.example/shpe' }),
    ).toThrow(/DATABASE_URL/);
  });

  it('refuses a missing database URL', () => {
    expect(() => assertLocalOnly({ ...LOCAL, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  });

  // pg dials the ?host= parameter, not the host in the authority.
  it('refuses a localhost URL whose host parameter points elsewhere', () => {
    expect(() =>
      assertLocalOnly({
        ...LOCAL,
        DATABASE_URL: 'postgresql://u:p@localhost:5432/shpe?host=db.prod.example.com',
      }),
    ).toThrow(/db\.prod\.example\.com/);
  });

  it('refuses an Auth emulator that is not on this machine', () => {
    expect(() =>
      assertLocalOnly({ ...LOCAL, FIREBASE_AUTH_EMULATOR_HOST: 'emulator.example.com:9099' }),
    ).toThrow(/FIREBASE_AUTH_EMULATOR_HOST/);
  });
});

/**
 * The Cloud SQL Auth Proxy serves production on 127.0.0.1, so no host check
 * can tell it apart from a local Postgres. The instance itself can.
 */
describe('assertNotCloudSql', () => {
  const answering = (rows: unknown[]) => async () => ({ rows });

  it('lets a stock Postgres through', async () => {
    await expect(assertNotCloudSql(answering([]))).resolves.toBeUndefined();
  });

  it('refuses a Cloud SQL instance, even one reached on localhost', async () => {
    await expect(assertNotCloudSql(answering([{ '?column?': 1 }]))).rejects.toThrow(/Cloud SQL/);
  });
});
