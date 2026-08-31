/**
 * Decides the pg TLS setting from the DSN alone, so the same build runs
 * against local Postgres, a Cloud SQL unix socket, and a TLS-terminating
 * managed host without extra configuration.
 */
export function sslConfigFor(databaseUrl: string): { rejectUnauthorized: true } | undefined {
  // Cloud SQL is reached through a unix socket (?host=/cloudsql/...); the
  // socket is already private and offers no TLS endpoint to verify.
  const isSocket = /[?&]host=(\/|%2F)/i.test(databaseUrl);

  const isLocal = /@(localhost|127\.0\.0\.1)/.test(databaseUrl);

  // A managed host reached over TCP (Cloud SQL's public IP, or any hosted
  // Postgres) terminates TLS with a publicly trusted certificate, so full
  // verification works. A self-hosted Postgres behind a self-signed cert
  // would need { rejectUnauthorized: false } instead.
  return isSocket || isLocal ? undefined : { rejectUnauthorized: true };
}
