/**
 * Shared app-navigation helpers for the Playwright e2e suite.
 *
 * The Padmakara app is React-Native-Web rendered. Most interactive elements
 * carry stable `testID`s (exposed on web as `data-testid`), so specs prefer
 * `page.getByTestId(...)`. Where a screen has no testID (e.g. the per-group
 * retreat cards), specs fall back to visible text or direct URL navigation.
 *
 * The app boots through an auth guard at `/` that redirects to
 * `/(tabs)/(groups)`. Expo Router serves these grouped routes at clean URLs:
 *   /                       → auth guard, redirects
 *   /(tabs)/(groups)        → home  (also reachable as `/`)
 * Direct deep links used by specs:
 *   /retreat/<eventId>      → sessions + tracks for an event
 *   /transcript/<eventId>   → PDF transcript viewer
 *   /retreats               → retreat groups list
 *   /search                 → search screen
 *   /bookmarks              → bookmarks screen
 */

import type { Page } from '@playwright/test';

/**
 * Wait for the app shell to finish its initial render. The home screen shows
 * the "Teachings & Talks" navigation card once the bundle has booted and the
 * AuthContext has settled — a reliable "app is interactive" marker.
 */
export async function waitForAppReady(page: Page): Promise<void> {
  await page.getByText('Teachings & Talks').first().waitFor({
    state: 'visible',
    timeout: 45_000,
  });
}

/** Navigate to the home screen and wait for it to be interactive. */
export async function gotoHome(page: Page): Promise<void> {
  await page.goto('/');
  await waitForAppReady(page);
}

/** Navigate to an event's sessions/tracks screen by event DB id. */
export async function gotoRetreat(page: Page, eventId: number): Promise<void> {
  await page.goto(`/retreat/${eventId}?from=events`);
}

/** Navigate to an event's transcript viewer by event DB id. */
export async function gotoTranscript(page: Page, eventId: number): Promise<void> {
  await page.goto(`/transcript/${eventId}`);
}

/** Navigate to the retreat groups list. */
export async function gotoRetreats(page: Page): Promise<void> {
  await page.goto('/retreats');
}

/** Navigate to the search screen. */
export async function gotoSearch(page: Page): Promise<void> {
  await page.goto('/search');
}

/** Navigate to the bookmarks screen. */
export async function gotoBookmarks(page: Page): Promise<void> {
  await page.goto('/bookmarks');
}
