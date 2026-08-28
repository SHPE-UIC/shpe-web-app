import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['backend/**/*.test.ts'],
    // env.ts throws on a missing DATABASE_URL / JWT_SECRET. These are fakes —
    // no test in this suite opens a connection.
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_SECRET: 'test-secret-for-unit-tests-only',
      CHECKIN_TOKEN_TTL_SECONDS: '60',
      CORS_ORIGINS: 'https://allowed.example.com',
    },
  },
});
