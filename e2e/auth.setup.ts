import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Interactive: opens a headed browser at the dev server, waits for the
 * user to complete the magic-link login flow (submit email, click the
 * link in the inbox, return to the device-activated screen), then saves
 * the resulting storage state to .auth/storage-state.json for subsequent
 * test runs.
 *
 * Re-run this whenever the saved auth state expires:
 *   npm run test:e2e:setup
 *
 * The 5-minute timeout below is intentionally generous to cover the
 * round-trip through an actual email inbox. If the user hasn't completed
 * the flow in 5 min the test errors out.
 */
const authFile = path.join(__dirname, '.auth', 'storage-state.json');

setup('authenticate via magic link', async ({ page }) => {
  setup.setTimeout(6 * 60 * 1000);

  await page.goto('/');

  // eslint-disable-next-line no-console
  console.log(
    '\n  → Complete the magic-link login in the browser window.\n' +
      '    Setup will auto-save once the home tab loads.\n',
  );

  // Detect success: home tab content is visible.
  // "Teachings & Talks" is the primary nav card on the authenticated home
  // screen and is also visible to public users, so additionally wait for
  // an authenticated-only marker.
  await expect(page.getByText('Teachings & Talks')).toBeVisible({ timeout: 5 * 60 * 1000 });
  // Authenticated-only: the bottom tab bar's "Account" link.
  await expect(page.getByText('Account', { exact: true })).toBeVisible({ timeout: 60 * 1000 });

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });

  // eslint-disable-next-line no-console
  console.log(`  ✓ Auth state saved to ${authFile}\n`);
});
