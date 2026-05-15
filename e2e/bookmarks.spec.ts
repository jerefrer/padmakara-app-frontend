/**
 * Bookmarks journey.
 *
 * Creates a track bookmark for a seeded user, then confirms it shows on the
 * Bookmarks screen — and that the screen is empty before the bookmark is
 * created.
 *
 * The bookmark is created via the backend API with the same JWT the app
 * uses, exercising the real `POST /api/content/track-bookmarks` endpoint and
 * the Bookmarks screen's real `GET /api/content/track-bookmarks` loader. The
 * in-player "add bookmark" affordance lives inside a modal in BookmarksManager
 * and writes to local AsyncStorage — a separate, local-only system — so the
 * cross-device bookmark journey is the one exercised here.
 *
 * Each test uses the `nosub` user so bookmark state is isolated between runs:
 * the seed never creates bookmarks, so each fresh run starts empty. To keep
 * tests independent within a run, any bookmarks created are deleted in an
 * afterEach cleanup.
 */

import { test, expect } from '@playwright/test';
import { createAuthSession, injectAuth } from './support/auth';
import { getEvent, EVENT_CODES } from './support/dataset';
import { gotoBookmarks } from './support/app';

const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:3100/api';

/** Create a track bookmark via the backend API; returns the bookmark id. */
async function createTrackBookmark(
  token: string,
  trackId: number,
): Promise<number> {
  const res = await fetch(`${API_BASE}/content/track-bookmarks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ trackId }),
  });
  if (!res.ok) {
    throw new Error(
      `[e2e bookmarks] create bookmark failed: ${res.status} ${await res.text()}`,
    );
  }
  const row = (await res.json()) as { id: number };
  return row.id;
}

/** Delete a track bookmark via the backend API (cleanup). */
async function deleteTrackBookmark(
  token: string,
  trackId: number,
): Promise<void> {
  await fetch(`${API_BASE}/content/track-bookmarks/${trackId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

test.describe('bookmarks', () => {
  test('bookmarks screen is empty for a user with no bookmarks', async ({
    page,
  }) => {
    const session = await createAuthSession('nosub');
    await injectAuth(page, session);

    await gotoBookmarks(page);

    // The bookmarks screen renders its empty state — the "Bookmarks" heading
    // plus the "tap the bookmark icon…" prompt — and no bookmark cards.
    await expect(page.getByText(/save it here/i).first()).toBeVisible({
      timeout: 30_000,
    });
    expect(await page.locator('[data-testid^="bookmark-"]').count()).toBe(0);
  });

  test('a created bookmark appears on the bookmarks screen', async ({
    page,
  }) => {
    const session = await createAuthSession('nosub');
    await injectAuth(page, session);
    // nosub can still bookmark a free-anyone track.
    const event = await getEvent(EVENT_CODES.anyone);
    const trackId = event.trackIds[0];

    let bookmarkId: number | null = null;
    try {
      bookmarkId = await createTrackBookmark(session.token, trackId);

      await gotoBookmarks(page);

      // The created bookmark renders as `bookmark-<dbId>`.
      await expect(
        page.getByTestId(`bookmark-${bookmarkId}`),
      ).toBeVisible({ timeout: 30_000 });
    } finally {
      await deleteTrackBookmark(session.token, trackId);
    }
  });

  test('opening a bookmark navigates to its event', async ({ page }) => {
    const session = await createAuthSession('nosub');
    await injectAuth(page, session);
    const event = await getEvent(EVENT_CODES.anyone);
    const trackId = event.trackIds[0];

    try {
      const bookmarkId = await createTrackBookmark(session.token, trackId);

      await gotoBookmarks(page);
      const card = page.getByTestId(`bookmark-${bookmarkId}`);
      await expect(card).toBeVisible({ timeout: 30_000 });
      await card.click();

      // Lands on the event screen for the bookmarked track.
      await expect(
        page.getByTestId(`track-row-${trackId}`),
      ).toBeVisible({ timeout: 30_000 });
    } finally {
      await deleteTrackBookmark(session.token, trackId);
    }
  });
});
