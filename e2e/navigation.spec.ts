/**
 * Core navigation journey.
 *
 * Programmatic login → home renders → groups list → open the seeded group →
 * open its event → see the event's sessions/tracks → open the transcript.
 *
 * Runs as the group-member user, who has access to the E2E-GROUP event via
 * group membership. Uses `testID` selectors where they exist and visible
 * text / direct deep links where they do not (the per-group retreat cards
 * carry no testID).
 */

import { test, expect } from '@playwright/test';
import { authenticateAs } from './support/auth';
import { getDataset, getGroup, getEvent, EVENT_CODES } from './support/dataset';
import {
  waitForAppReady,
  gotoHome,
  gotoRetreats,
  gotoRetreat,
  gotoTranscript,
} from './support/app';

test.describe('core navigation', () => {
  test('home screen renders after programmatic login', async ({ page }) => {
    await authenticateAs(page, 'groupMember');
    await gotoHome(page);

    // The three primary navigation cards are present on the home screen.
    await expect(page.getByText('Teachings & Talks')).toBeVisible();
    await expect(page.getByText('Retreats')).toBeVisible();

    // Auth state is persisted in localStorage (web AsyncStorage backing).
    const auth = await page.evaluate(() => ({
      token: !!localStorage.getItem('auth_token'),
      activated: localStorage.getItem('device_activated'),
    }));
    expect(auth.token).toBe(true);
    expect(auth.activated).toBe('true');
  });

  test('groups list shows the seeded retreat group', async ({ page }) => {
    await authenticateAs(page, 'groupMember');
    const group = await getGroup();

    await gotoRetreats(page);

    // The group-card testID is `group-card-<dbId>`.
    const card = page.getByTestId(`group-card-${group.id}`);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toContainText(group.nameEn);
  });

  test('opening the group shows its event', async ({ page }) => {
    await authenticateAs(page, 'groupMember');
    const group = await getGroup();
    const event = await getEvent(EVENT_CODES.groupMembers);

    await gotoRetreats(page);
    await page.getByTestId(`group-card-${group.id}`).click();

    // The group detail screen lists the event by its title. The per-group
    // retreat cards carry no testID, so assert on the visible event title.
    await expect(
      page.getByText('E2E Event – Retreat Group Members').first(),
    ).toBeVisible({ timeout: 30_000 });
    // The seed gives this event exactly one session worth of content.
    expect(event.sessionIds.length).toBe(1);
  });

  test('event screen lists the seeded sessions and tracks', async ({ page }) => {
    await authenticateAs(page, 'groupMember');
    const event = await getEvent(EVENT_CODES.groupMembers);

    await gotoRetreat(page, event.eventId);

    // Each seeded track renders a `track-row-<dbId>` element.
    for (const trackId of event.trackIds) {
      await expect(page.getByTestId(`track-row-${trackId}`)).toBeVisible({
        timeout: 30_000,
      });
    }
    // The session header for the seeded session is shown.
    await expect(page.getByText(/MORNING/i).first()).toBeVisible();
  });

  test('transcript viewer opens for the event', async ({ page }) => {
    await authenticateAs(page, 'groupMember');
    const event = await getEvent(EVENT_CODES.groupMembers);

    await gotoTranscript(page, event.eventId);

    // The transcript screen shell carries the `transcript-view` testID.
    // The fixture transcript is a placeholder buffer (not a real PDF), so we
    // assert the viewer chrome renders — not rendered PDF page content.
    await expect(page.getByTestId('transcript-view')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('Transcript').first()).toBeVisible();
  });

  test('end-to-end: home → groups → group → event → transcript', async ({
    page,
  }) => {
    await authenticateAs(page, 'groupMember');
    const dataset = await getDataset();
    const group = dataset.groups[0];
    const event = dataset.events[EVENT_CODES.groupMembers];

    // 1. Home.
    await gotoHome(page);
    await expect(page.getByText('Teachings & Talks')).toBeVisible();

    // 2. Retreats list → seeded group.
    await gotoRetreats(page);
    await page.getByTestId(`group-card-${group.id}`).click();

    // 3. Group detail → open the event.
    const eventCard = page
      .getByText('E2E Event – Retreat Group Members')
      .first();
    await expect(eventCard).toBeVisible({ timeout: 30_000 });
    await eventCard.click();

    // 4. Event detail → tracks visible.
    await expect(
      page.getByTestId(`track-row-${event.trackIds[0]}`),
    ).toBeVisible({ timeout: 30_000 });

    // 5. Transcript.
    await gotoTranscript(page, event.eventId);
    await expect(page.getByTestId('transcript-view')).toBeVisible({
      timeout: 30_000,
    });
  });
});

test.describe('public access (unauthenticated)', () => {
  test('public events are visible without login', async ({ page }) => {
    // No auth injected — the app's auth guard still allows public content.
    await page.goto('/');
    await waitForAppReady(page);
    await expect(page.getByText('Teachings & Talks')).toBeVisible();
  });
});
