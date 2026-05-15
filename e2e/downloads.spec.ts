/**
 * Event ZIP download journey.
 *
 * Opens an event, triggers "Download as ZIP" from the overflow menu, and
 * confirms the request is acknowledged — the in-app download banner appears
 * with progress text.
 *
 * The download flow is: POST /api/events/:id/request-download → poll
 * /api/download-requests/:id/status until "ready". Against the seeded
 * fixtures the ZIP is generated successfully (archiver zips the placeholder
 * bytes without decoding them), so the banner progresses from
 * "Preparing download..." through to a ready state.
 *
 * Runs as the group-member user against the E2E-GROUP event.
 */

import { test, expect } from '@playwright/test';
import { authenticateAs } from './support/auth';
import { getEvent, EVENT_CODES } from './support/dataset';
import { gotoRetreat } from './support/app';

test.describe('event ZIP download', () => {
  test('requesting a ZIP shows the download banner', async ({ page }) => {
    await authenticateAs(page, 'groupMember');
    const event = await getEvent(EVENT_CODES.groupMembers);

    await gotoRetreat(page, event.eventId);
    await page
      .getByTestId(`track-row-${event.trackIds[0]}`)
      .waitFor({ state: 'visible', timeout: 30_000 });

    // Open the event overflow menu and pick "Download as ZIP".
    await page.getByTestId('event-menu-button').click();
    const downloadItem = page.getByTestId('event-download-zip');
    await expect(downloadItem).toBeVisible({ timeout: 10_000 });
    await downloadItem.click();

    // The download banner appears, acknowledging the request.
    const banner = page.getByTestId('event-download-banner');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    // The banner shows live progress text from the request lifecycle.
    await expect(banner).toContainText(/download|ZIP/i);
  });

  test('the ZIP request progresses through generation', async ({ page }) => {
    await authenticateAs(page, 'groupMember');
    const event = await getEvent(EVENT_CODES.groupMembers);

    await gotoRetreat(page, event.eventId);
    await page
      .getByTestId(`track-row-${event.trackIds[0]}`)
      .waitFor({ state: 'visible', timeout: 30_000 });

    await page.getByTestId('event-menu-button').click();
    await page.getByTestId('event-download-zip').click();

    const banner = page.getByTestId('event-download-banner');
    await expect(banner).toBeVisible({ timeout: 15_000 });

    // The banner advances from the initial "Preparing download..." message
    // into the generation phase — confirming the request was created and the
    // client is polling its status. (The terminal "ZIP ready!" message is
    // shown only momentarily before the browser hands off to a file
    // download, so it is not asserted here to avoid a race.)
    await expect(banner).toContainText(/generating zip/i, { timeout: 20_000 });
  });
});
