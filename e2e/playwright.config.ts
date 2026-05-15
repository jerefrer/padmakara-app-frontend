import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

/**
 * Padmakara mobile-app end-to-end test config.
 *
 * Fully automated: `npx playwright test` (run from the padmakara-app worktree)
 * stands up the entire stack itself —
 *
 *   globalSetup   → spawns the e2e infra runner (padmakara-api worktree):
 *                   resets + migrates + seeds the padmakara_test database,
 *                   starts local MinIO, uploads fixture media. MinIO stays
 *                   up for the whole run.
 *   webServer[0]  → the Hono backend (padmakara-api worktree) on :3100,
 *                   started with EXPLICIT test-env overrides so it connects
 *                   ONLY to padmakara_test + local MinIO — never the real
 *                   database or AWS S3. NODE_ENV=test.
 *   webServer[1]  → the Expo web dev server (this worktree) on :8181, built
 *                   with EXPO_PUBLIC_API_URL pointing at the :3100 backend.
 *   globalTeardown → stops the infra runner (clean MinIO shutdown).
 *
 * Auth is programmatic and per-test: each spec mints a JWT for a seeded user
 * via the backend's test-only endpoints and injects it into localStorage
 * before navigation (see e2e/support/auth.ts). No magic-link flow, no shared
 * storageState file.
 *
 * Dedicated ports 3100 / 8181 are used (not 3000 / 8081) so the test stack
 * never collides with — or accidentally reuses — a developer's running
 * dev servers, which are connected to the real database.
 */

/** Backend port — kept distinct from the dev default (3000) for isolation. */
const BACKEND_PORT = 3100;
/** Expo web port — kept distinct from the dev default (8081). */
const WEB_PORT = 8181;

const API_BASE_URL = `http://localhost:${BACKEND_PORT}/api`;
const WEB_BASE_URL = `http://localhost:${WEB_PORT}`;

/**
 * Absolute path to the padmakara-api worktree (sibling of this worktree).
 * __dirname is `<…>/.worktrees/pw-app/e2e`, so two `..` segments climb to
 * `<…>/.worktrees`, then `pw-api` is the sibling worktree.
 */
const API_WORKTREE = path.join(__dirname, '..', '..', 'pw-api');
/** Bun binary — override via BUN_BIN if not on PATH. */
const BUN_BIN = process.env.BUN_BIN ?? `${process.env.HOME}/.bun/bin/bun`;

/**
 * EXPLICIT test-env overrides for the backend. The backend reads every value
 * below from process.env (src/config.ts), so providing them here guarantees
 * it targets the test database + local MinIO and never the real `.env`.
 */
const BACKEND_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: String(BACKEND_PORT),
  DATABASE_URL: 'postgresql://localhost:5432/padmakara_test',
  E2E_ENABLED: 'true',
  JWT_SECRET: 'test-secret-do-not-use-in-production',
  // Local MinIO — must match tests/e2e/support/minio.ts constants.
  S3_ENDPOINT: 'http://127.0.0.1:9100',
  S3_FORCE_PATH_STYLE: 'true',
  S3_BUCKET: 'padmakara-test',
  AWS_ACCESS_KEY_ID: 'e2eadmin',
  AWS_SECRET_ACCESS_KEY: 'e2epasswd',
  AWS_REGION: 'us-east-1',
  // CORS allow-list must include the Expo web origin.
  FRONTEND_URL: WEB_BASE_URL,
  // Dummy values so config.ts does not throw on missing required vars.
  BUNNY_STREAM_LIBRARY_ID: '12345',
  BUNNY_STREAM_API_KEY: 'test-api-key',
  BUNNY_STREAM_CDN_HOSTNAME: 'vz-test.b-cdn.net',
  BUNNY_STREAM_TOKEN_AUTH_KEY: 'test-token-auth-key',
  BUNNY_WEBHOOK_SECRET: 'test-webhook-secret',
  READ_ALONG_WEBHOOK_SECRET: 'test-webhook-secret',
};

// Expose the API base URL to the support helpers (auth.ts / dataset.ts).
process.env.E2E_API_URL = API_BASE_URL;

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Single worker — all specs share one seeded database.
  workers: 1,
  reporter: [['list']],
  // Generous global timeout — Metro's first bundle build can be slow.
  timeout: 60_000,
  expect: { timeout: 15_000 },

  globalSetup: path.join(__dirname, 'support', 'global-setup.ts'),
  globalTeardown: path.join(__dirname, 'support', 'global-teardown.ts'),

  use: {
    baseURL: WEB_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // No storageState — auth is injected per-test via e2e/support/auth.ts.
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // The legacy interactive magic-link setup is no longer used.
      testIgnore: /auth\.setup\.ts/,
    },
  ],

  webServer: [
    {
      // Backend — Hono API on :3100, test DB + local MinIO only.
      name: 'backend',
      command: `${BUN_BIN} src/index.ts`,
      cwd: API_WORKTREE,
      env: BACKEND_ENV,
      url: `http://localhost:${BACKEND_PORT}/health`,
      // Never reuse an existing server on this port — the dedicated test
      // port should always be ours. reuseExistingServer:false guarantees a
      // fresh, correctly-configured backend.
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      // Expo web dev server on :8181, pointed at the :3100 backend.
      name: 'expo-web',
      command: `npx expo start --web --port ${WEB_PORT}`,
      cwd: path.join(__dirname, '..'),
      env: { EXPO_PUBLIC_API_URL: API_BASE_URL },
      url: WEB_BASE_URL,
      reuseExistingServer: false,
      // Metro's dev server is reachable quickly; the first bundle build
      // happens on first page load. 4 min covers a cold build.
      timeout: 240_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
