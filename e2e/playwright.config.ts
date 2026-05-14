import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const STORAGE_STATE = path.join(__dirname, '.auth', 'storage-state.json');

/**
 * Padmakara mobile-app end-to-end test config.
 *
 * Scope: catches bugs that unit tests with mocked expo-audio cannot —
 * specifically anything that depends on real HTMLAudioElement / native
 * player lifecycle, presigned-URL refresh, multi-render race conditions
 * that the mock cannot reproduce.
 *
 * Pre-requisites (manual): dev server running at http://localhost:8081,
 * and a recent storage state at e2e/.auth/storage-state.json. Run
 * `npm run test:e2e:setup` interactively to generate / refresh the auth
 * state when it expires.
 */
export default defineConfig({
  testDir: '.',
  // No CI hooks for now — local-only on demand.
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8081',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    storageState: STORAGE_STATE,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      // Setup runs in headed mode without storage state so the user can
      // complete the magic-link flow interactively.
      use: { storageState: undefined as never, headless: false },
    },
    {
      name: 'chromium',
      testIgnore: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
      // Don't auto-run setup before tests — setup is interactive and
      // should be invoked explicitly via `npm run test:e2e:setup`. If the
      // storage state is stale, tests will fail with a clear error and
      // the user re-runs the setup.
    },
  ],
});
