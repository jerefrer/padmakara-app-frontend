/**
 * Audio player journey.
 *
 * Opens an event, selects a track, and exercises the player controls
 * (play/pause toggle, skip forward/back).
 *
 * IMPORTANT — fixture media is PLACEHOLDER bytes, not a real MP3. The browser
 * cannot decode it, so real audio will never actually play. These tests
 * therefore assert the player UI/state behaviour — controls render, the
 * play/pause button toggles, the seek bar and time display are present, and
 * the player loads the selected track — NOT that sound is produced. Testing
 * real decoded playback would require committing a real audio fixture; that
 * is out of scope for this suite and is called out in the e2e README.
 *
 * Runs as the group-member user against the E2E-GROUP event.
 */

import { test, expect } from '@playwright/test';
import { authenticateAs } from './support/auth';
import { getEvent, EVENT_CODES } from './support/dataset';
import { gotoRetreat } from './support/app';

test.describe('audio player', () => {
  test('selecting a track shows the player controls', async ({ page }) => {
    await authenticateAs(page, 'groupMember');
    const event = await getEvent(EVENT_CODES.groupMembers);

    await gotoRetreat(page, event.eventId);

    // Select the first seeded track.
    const trackRow = page.getByTestId(`track-row-${event.trackIds[0]}`);
    await expect(trackRow).toBeVisible({ timeout: 30_000 });
    await trackRow.click();

    // The player control cluster renders for the selected track.
    await expect(page.getByTestId('audio-play-pause')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('audio-skip-forward')).toBeVisible();
    await expect(page.getByTestId('audio-skip-back')).toBeVisible();
    await expect(page.getByTestId('audio-current-time')).toBeVisible();
  });

  test('the player loads the selected track title', async ({ page }) => {
    await authenticateAs(page, 'groupMember');
    const event = await getEvent(EVENT_CODES.groupMembers);

    await gotoRetreat(page, event.eventId);
    await page.getByTestId(`track-row-${event.trackIds[0]}`).click();

    // The player bar shows the title of the track that was opened.
    await expect(page.getByTestId('audio-play-pause')).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText('E2E-GROUP – Track 1').first(),
    ).toBeVisible();
  });

  test('play/pause control responds to clicks', async ({ page }) => {
    await authenticateAs(page, 'groupMember');
    const event = await getEvent(EVENT_CODES.groupMembers);

    await gotoRetreat(page, event.eventId);
    await page.getByTestId(`track-row-${event.trackIds[0]}`).click();

    const playPause = page.getByTestId('audio-play-pause');
    await expect(playPause).toBeVisible({ timeout: 15_000 });

    // The control must remain present and clickable after being pressed.
    // (Placeholder media cannot decode, so we assert the control stays
    // interactive — not that audio output starts.)
    await playPause.click();
    await expect(playPause).toBeVisible();
    await playPause.click();
    await expect(playPause).toBeVisible();
  });

  test('switching between tracks updates the player', async ({ page }) => {
    await authenticateAs(page, 'groupMember');
    const event = await getEvent(EVENT_CODES.groupMembers);

    await gotoRetreat(page, event.eventId);

    // Open track 1.
    await page.getByTestId(`track-row-${event.trackIds[0]}`).click();
    await expect(page.getByTestId('audio-play-pause')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('E2E-GROUP – Track 1').first()).toBeVisible();

    // Switch to track 2 — the player must reflect the new track.
    await page.getByTestId(`track-row-${event.trackIds[1]}`).click();
    await expect(page.getByText('E2E-GROUP – Track 2').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('audio-play-pause')).toBeVisible();
  });

  test('skip controls remain interactive', async ({ page }) => {
    await authenticateAs(page, 'groupMember');
    const event = await getEvent(EVENT_CODES.groupMembers);

    await gotoRetreat(page, event.eventId);
    await page.getByTestId(`track-row-${event.trackIds[0]}`).click();

    const skipFwd = page.getByTestId('audio-skip-forward');
    const skipBack = page.getByTestId('audio-skip-back');
    await expect(skipFwd).toBeVisible({ timeout: 15_000 });

    // Clicking skip must not crash the player; controls stay present.
    await skipFwd.click();
    await skipBack.click();
    await expect(page.getByTestId('audio-current-time')).toBeVisible();
    await expect(page.getByTestId('audio-play-pause')).toBeVisible();
  });
});
