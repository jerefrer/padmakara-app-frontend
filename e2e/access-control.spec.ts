/**
 * Access-control journey.
 *
 * The seed dataset gives each access level its own event:
 *   E2E-ANYONE — free to anyone (incl. signed-out users)
 *   E2E-SUBS   — free to subscribers
 *   E2E-GROUP  — retreat-group members only
 *   E2E-PART   — event participants only
 *
 * and six users at different access levels. These tests confirm the app
 * shows the right content for the right user:
 *   - the `subscriber` user can open the subscribers-only event;
 *   - the `nosub` user cannot — opening it lands on the not-found / error
 *     state instead of the track list;
 *   - the `nosub` user also cannot open the group-members-only event;
 *   - the `groupMember` user can.
 *
 * Access control is enforced at the event-detail level (the backend returns
 * 403 for events the user may not see); the public "Teachings & Talks" list
 * shows only free-anyone events for everyone.
 */

import { test, expect } from '@playwright/test';
import { authenticateAs } from './support/auth';
import { getEvent, EVENT_CODES } from './support/dataset';
import { gotoRetreat } from './support/app';

/** A track row from the event is the "has access" marker. */
async function expectHasAccess(
  page: import('@playwright/test').Page,
  trackId: number,
): Promise<void> {
  await expect(page.getByTestId(`track-row-${trackId}`)).toBeVisible({
    timeout: 30_000,
  });
}

/** The not-found / error state is the "denied" marker. */
async function expectAccessDenied(
  page: import('@playwright/test').Page,
  trackId: number,
): Promise<void> {
  // The restricted event resolves to the error state — "Retreat not found".
  await expect(page.getByText(/not found/i).first()).toBeVisible({
    timeout: 30_000,
  });
  // And the protected content is NOT shown.
  await expect(page.getByTestId(`track-row-${trackId}`)).toHaveCount(0);
}

test.describe('access control', () => {
  test('free-anyone event is accessible to a user with no subscription', async ({
    page,
  }) => {
    await authenticateAs(page, 'nosub');
    const event = await getEvent(EVENT_CODES.anyone);

    await gotoRetreat(page, event.eventId);
    await expectHasAccess(page, event.trackIds[0]);
  });

  test('subscriber CAN open the subscribers-only event', async ({ page }) => {
    await authenticateAs(page, 'subscriber');
    const event = await getEvent(EVENT_CODES.subscribers);

    await gotoRetreat(page, event.eventId);
    await expectHasAccess(page, event.trackIds[0]);
  });

  test('non-subscriber CANNOT open the subscribers-only event', async ({
    page,
  }) => {
    await authenticateAs(page, 'nosub');
    const event = await getEvent(EVENT_CODES.subscribers);

    await gotoRetreat(page, event.eventId);
    await expectAccessDenied(page, event.trackIds[0]);
  });

  test('group member CAN open the group-members-only event', async ({
    page,
  }) => {
    await authenticateAs(page, 'groupMember');
    const event = await getEvent(EVENT_CODES.groupMembers);

    await gotoRetreat(page, event.eventId);
    await expectHasAccess(page, event.trackIds[0]);
  });

  test('non-member CANNOT open the group-members-only event', async ({
    page,
  }) => {
    // The subscriber is NOT a member of the retreat group — an active
    // subscription alone does not grant retreat-group-members content.
    await authenticateAs(page, 'subscriber');
    const event = await getEvent(EVENT_CODES.groupMembers);

    await gotoRetreat(page, event.eventId);
    await expectAccessDenied(page, event.trackIds[0]);
  });

  test('event participant CAN open the participants-only event', async ({
    page,
  }) => {
    await authenticateAs(page, 'participant');
    const event = await getEvent(EVENT_CODES.participants);

    await gotoRetreat(page, event.eventId);
    await expectHasAccess(page, event.trackIds[0]);
  });
});
