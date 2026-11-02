const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Refuses unless both halves of the stack are on this machine.
 *
 * The accessibility seed starts by deleting every table's rows and every Auth
 * account, so it must never reach the real tenant or Cloud SQL. The Admin SDK
 * only talks to the emulator when FIREBASE_AUTH_EMULATOR_HOST is set, and the
 * database check parses the host rather than searching the string, so
 * `localhost.example.com` does not pass for local.
 *
 * A local host is necessary, not sufficient: the Cloud SQL Auth Proxy puts
 * production on 127.0.0.1 too. assertNotCloudSql asks the database itself.
 */
export function assertLocalOnly(env: Record<string, string | undefined>): void {
  const emulator = env.FIREBASE_AUTH_EMULATOR_HOST?.trim();
  if (!emulator) {
    throw new Error(
      'Refusing to seed: FIREBASE_AUTH_EMULATOR_HOST is not set, so Firebase calls would reach the real tenant.',
    );
  }
  let emulatorHost = '';
  try {
    // host:port, no scheme — the form the Admin SDK reads.
    emulatorHost = new URL(`http://${emulator}`).hostname;
  } catch {
    // Unparseable is not local; fall through to the refusal.
  }
  if (!LOCAL_HOSTS.has(emulatorHost)) {
    throw new Error(
      `Refusing to seed: FIREBASE_AUTH_EMULATOR_HOST must be on this machine, not "${emulator}".`,
    );
  }

  let host = '';
  try {
    const url = new URL(env.DATABASE_URL ?? '');
    // pg lets a ?host= parameter replace the authority's host, so that is the
    // one it actually dials: ...@localhost/shpe?host=prod.example.com is remote.
    host = url.searchParams.get('host') || url.hostname;
  } catch {
    // Unparseable is not local; fall through to the refusal.
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to seed: DATABASE_URL must point at localhost, not "${host || 'nothing'}".`,
    );
  }
}

/**
 * Refuses a database that is Cloud SQL, however it is reached.
 *
 * The Auth Proxy serves production on 127.0.0.1, so no host check can tell it
 * from a local Postgres. The instance can: Cloud SQL creates the
 * cloudsqlsuperuser role on every instance, and a stock Postgres never has it.
 */
export async function assertNotCloudSql(
  query: (text: string) => Promise<{ rows: unknown[] }>,
): Promise<void> {
  const { rows } = await query(`select 1 from pg_roles where rolname = 'cloudsqlsuperuser'`);
  if (rows.length > 0) {
    throw new Error(
      'Refusing to seed: DATABASE_URL reaches a Cloud SQL instance (through the Auth Proxy?), not a throwaway Postgres.',
    );
  }
}
