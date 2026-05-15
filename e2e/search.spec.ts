/**
 * Search journey.
 *
 * Types a query that matches the seeded events and confirms matching results
 * appear, then opens a result and lands on the event screen.
 *
 * The seeded events all share the "E2E" prefix in their titles, and each
 * event's tracks are titled "<CODE> – Track N", so a query of "E2E" matches
 * every seeded event and "Track" matches every seeded track title.
 */

import { test, expect } from '@playwright/test';
import { authenticateAs } from './support/auth';
import { getEvent, EVENT_CODES } from './support/dataset';
import { gotoSearch } from './support/app';

test.describe('search', () => {
  test('searching surfaces matching seeded events', async ({ page }) => {
    await authenticateAs(page, 'groupMember');
    await gotoSearch(page);

    const input = page.getByTestId('search-input');
    await expect(input).toBeVisible({ timeout: 30_000 });
    await input.fill('E2E');

    // At least one result card appears (results carry `search-result-<id>`).
    const results = page.locator('[data-testid^="search-result-"]');
    await expect(results.first()).toBeVisible({ timeout: 20_000 });
    expect(await results.count()).toBeGreaterThan(0);
  });

  test('a specific seeded event appears in results', async ({ page }) => {
    await authenticateAs(page, 'groupMember');
    const event = await getEvent(EVENT_CODES.groupMembers);

    await gotoSearch(page);
    await page.getByTestId('search-input').fill('Retreat Group Members');

    // The E2E-GROUP event card is identified by `search-result-<eventId>`.
    await expect(
      page.getByTestId(`search-result-${event.eventId}`),
    ).toBeVisible({ timeout: 20_000 });
  });

  test('a query with no matches shows the empty state', async ({ page }) => {
    await authenticateAs(page, 'groupMember');
    await gotoSearch(page);

    await page.getByTestId('search-input').fill('zzznomatchqueryzzz');

    // No result cards; the "no results" message is shown instead.
    await expect(page.getByText(/no results/i).first()).toBeVisible({
      timeout: 20_000,
    });
    expect(
      await page.locator('[data-testid^="search-result-"]').count(),
    ).toBe(0);
  });

  test('opening a search result navigates to the event', async ({ page }) => {
    await authenticateAs(page, 'groupMember');
    const event = await getEvent(EVENT_CODES.groupMembers);

    await gotoSearch(page);
    await page.getByTestId('search-input').fill('Retreat Group Members');

    const result = page.getByTestId(`search-result-${event.eventId}`);
    await expect(result).toBeVisible({ timeout: 20_000 });
    await result.click();

    // Lands on the event screen — the seeded tracks are listed.
    await expect(
      page.getByTestId(`track-row-${event.trackIds[0]}`),
    ).toBeVisible({ timeout: 30_000 });
  });
});
