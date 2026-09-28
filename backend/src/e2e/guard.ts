const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Refuses unless both halves of the stack are on this machine.
 *
 * The accessibility seed starts by deleting every table's rows and every Auth
 * account, so it must never reach the real tenant or Cloud SQL. The Admin SDK
 * only talks to the emulator when FIREBASE_AUTH_EMULATOR_HOST is set, and the
 * database check parses the host rather than searching the string, so
 * `localhost.example.com` does not pass for local.
 */
export function assertLocalOnly(env: Record<string, string | undefined>): void {
  if (!env.FIREBASE_AUTH_EMULATOR_HOST?.trim()) {
    throw new Error(
      'Refusing to seed: FIREBASE_AUTH_EMULATOR_HOST is not set, so Firebase calls would reach the real tenant.',
    );
  }

  let host = '';
  try {
    host = new URL(env.DATABASE_URL ?? '').hostname;
  } catch {
    // Unparseable is not local; fall through to the refusal.
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to seed: DATABASE_URL must point at localhost, not "${host || 'nothing'}".`,
    );
  }
}
