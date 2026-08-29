import { describe, expect, it } from 'vitest';
import { sslConfigFor } from './ssl';

describe('sslConfigFor', () => {
  it('skips TLS for localhost', () => {
    expect(sslConfigFor('postgresql://shpe:pw@localhost:5432/shpe')).toBeUndefined();
  });

  it('skips TLS for 127.0.0.1', () => {
    expect(sslConfigFor('postgresql://shpe:pw@127.0.0.1:5432/shpe')).toBeUndefined();
  });

  it('skips TLS for a Cloud SQL unix socket DSN', () => {
    expect(
      sslConfigFor(
        'postgresql://shpe_api:pw@localhost/shpe?host=/cloudsql/my-project:us-central1:shpe-pg',
      ),
    ).toBeUndefined();
  });

  it('skips TLS for a URL-encoded unix socket path', () => {
    expect(
      sslConfigFor(
        'postgresql://shpe_api:pw@localhost/shpe?host=%2Fcloudsql%2Fmy-project%3Aus-central1%3Ashpe-pg',
      ),
    ).toBeUndefined();
  });

  it('requires verified TLS for a managed remote host', () => {
    expect(
      sslConfigFor('postgresql://shpe:pw@ep-cool-name-123.us-east-2.aws.neon.tech/shpe'),
    ).toEqual({ rejectUnauthorized: true });
  });

  it('requires verified TLS for any other remote host, sslmode or not', () => {
    expect(sslConfigFor('postgresql://shpe:pw@db.example.org:5432/shpe?sslmode=require')).toEqual({
      rejectUnauthorized: true,
    });
  });
});
