import { defineConfig, devices } from '@playwright/test';

/**
 * The accessibility scan: every screen, signed in, in a real browser, checked
 * by axe. See e2e/a11y.spec.ts for what it visits and README "Checks" for the
 * stack it expects (Postgres, the Auth emulator, the API, and the seed).
 *
 * Playwright builds and serves the web export itself, pointed at that local
 * stack, into e2e/.dist rather than dist/: dist/ is what Firebase Hosting
 * deploys, and a build that signs in against the emulator must never land
 * there. Every run builds fresh and never reuses a server already on the port,
 * which could be serving an older build than the code under test.
 */
const PORT = 8090;
const OUT_DIR = 'e2e/.dist';
const API_URL = process.env.A11Y_API_URL ?? 'http://localhost:5000';
const AUTH_EMULATOR = process.env.A11Y_AUTH_EMULATOR ?? 'http://127.0.0.1:9099';

export default defineConfig({
  testDir: './e2e',
  // .spec, never .test: Jest claims every *.test.ts in this project.
  testMatch: /.*\.(spec|setup)\.ts$/,
  outputDir: './e2e/.results',
  timeout: 60_000,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',

  use: {
    baseURL: `http://localhost:${PORT}`,
    // A phone, because that is how members use the app. Chromium, because
    // that is the browser Playwright installs in CI.
    ...devices['Pixel 7'],
    // The check-in tab opens the camera on load. A fake device lets it
    // render its scanning state instead of a permission prompt.
    permissions: ['camera'],
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
    trace: 'retain-on-failure',
  },

  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts$/ },
    { name: 'a11y', testMatch: /\.spec\.ts$/, dependencies: ['setup'] },
  ],

  webServer: {
    command: `npx expo export --platform web --output-dir ${OUT_DIR} && node e2e/serve.mjs ${OUT_DIR} ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      EXPO_PUBLIC_API_URL: API_URL,
      EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR: AUTH_EMULATOR,
      // Placeholders: the emulator accepts any key, but the project id has to
      // match the one the API's Admin SDK verifies tokens against.
      EXPO_PUBLIC_FIREBASE_API_KEY: 'demo-key',
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-shpe.firebaseapp.com',
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'demo-shpe',
      EXPO_PUBLIC_FIREBASE_APP_ID: '1:0:web:0',
    },
  },
});
