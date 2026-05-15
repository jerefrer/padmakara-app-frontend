import { test, expect, Page } from '@playwright/test';

/**
 * Round-trip A → B → A: the user navigates from track A to track B and
 * back to A, and the slider must restore A's saved position.
 *
 * This is the bug the user kept hitting and that the jest H6 test now
 * catches at the unit level. We also run it here against the real
 * HTMLAudioElement + real presigned-URL backend because the jest mock
 * cannot prove the fix works in the browser — only that the logic shape
 * is right. The unit test is the fast feedback loop; this test is the
 * "did it actually work in a real browser" check.
 *
 * Pre-requisites:
 *   - Dev server at http://localhost:8081
 *   - Backend reachable (presigned URLs resolve)
 *   - e2e/.auth/storage-state.json exists (run `npm run test:e2e:setup`)
 *   - The authenticated user has access to the November 2025 "How to
 *     Stay Courageous" event (id 672) with tracks 54277/54279.
 *
 * Run: npm run test:e2e
 */

/**
 * The fixture event used to reproduce the bug. If your test account
 * doesn't have access to this event, swap to another two-track event
 * you DO have access to and update the track IDs / paths to match.
 */
const FIXTURE = {
  eventPath: '/retreat/672?from=events',
  trackA: { id: '54277', label: '1How to stay courageous - 15NOV - Part 1' },
  trackB: { id: '54279', label: '2How to stay courageous - 15NOV - Part 2' },
  savedPosA: 77, // 1:17
  savedPosB: 100, // 1:40
};

/**
 * Set up the saved-position fixtures and the per-audio-element
 * instrumentation BEFORE any page script runs. Returns a function that
 * reads the recorded seek log from the page.
 */
async function setupInstrumentation(page: Page) {
  await page.addInitScript(
    ({ trackAId, trackBId, posA, posB }) => {
      const lastPlayed = '2026-05-14T15:00:00.000Z';
      localStorage.setItem(
        `progress_${trackAId}`,
        JSON.stringify({ trackId: trackAId, position: posA, completed: false, lastPlayed, bookmarks: [] }),
      );
      localStorage.setItem(
        `progress_${trackBId}`,
        JSON.stringify({ trackId: trackBId, position: posB, completed: false, lastPlayed, bookmarks: [] }),
      );
      // Avoid the home-screen "resume last played" auto-load interfering
      // with the controlled scenario.
      localStorage.removeItem('last_played_track');

      type SeekEntry =
        | { n: number; event: 'new Audio'; audioElId: number; src: string | null }
        | { n: number; value: number; src: string; audioElId: number | null };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__seekLog = [] as SeekEntry[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__audioCount = 0;

      const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime')!;
      Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
        ...desc,
        set(this: HTMLMediaElement, v: number) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const log: SeekEntry[] = (window as any).__seekLog;
          log.push({
            n: log.length,
            value: v,
            src: this.src || '(no src)',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            audioElId: (this as any).__id ?? null,
          });
          desc.set!.call(this, v);
        },
      });

      const OrigAudio = window.Audio;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).Audio = function (this: HTMLAudioElement, ...args: any[]) {
        const a = new OrigAudio(...(args as [string?]));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__audioCount += 1;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (a as any).__id = (window as any).__audioCount;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__seekLog.push({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          n: (window as any).__seekLog.length,
          event: 'new Audio',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          audioElId: (a as any).__id,
          src: args[0] ?? null,
        });
        return a;
      };
      Object.setPrototypeOf((window as Window).Audio, OrigAudio);
    },
    {
      trackAId: FIXTURE.trackA.id,
      trackBId: FIXTURE.trackB.id,
      posA: FIXTURE.savedPosA,
      posB: FIXTURE.savedPosB,
    },
  );
}

/**
 * Click a track row by the label prefix shown in the session list.
 * Track rows are <View tabIndex="0">…</View> on RN-Web — they don't
 * carry a stable selector, so we identify them by their visible text.
 */
async function clickTrackRow(page: Page, labelPrefix: string) {
  // The retreat screen renders track rows asynchronously after fetching
  // the session list from the API. Poll for up to 10 s before failing.
  await page.waitForFunction(
    (prefix) => {
      const rows = Array.from(document.querySelectorAll<HTMLElement>('div[tabindex="0"]'));
      return rows.some((el) => (el.textContent || '').startsWith(prefix));
    },
    labelPrefix,
    { timeout: 10000 },
  );
  await page.evaluate((prefix) => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>('div[tabindex="0"]'));
    const target = rows.find((el) => (el.textContent || '').startsWith(prefix));
    if (!target) throw new Error(`Track row not found after wait: ${prefix}`);
    target.click();
  }, labelPrefix);
}

type SeekLogEntry =
  | { n: number; event: 'new Audio'; audioElId: number; src: string | null }
  | { n: number; value: number; src: string; audioElId: number | null };

async function readSeekLog(page: Page): Promise<SeekLogEntry[]> {
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__seekLog as SeekLogEntry[];
  });
}

/** Returns the last seek on the given audio element id. */
function lastSeekOn(log: SeekLogEntry[], audioElId: number): number | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i];
    if ('value' in entry && entry.audioElId === audioElId) return entry.value;
  }
  return null;
}

/** Returns the highest audioElId in the log. */
function maxAudioElId(log: SeekLogEntry[]): number {
  let max = 0;
  for (const entry of log) {
    if ('audioElId' in entry && entry.audioElId != null && entry.audioElId > max) max = entry.audioElId;
  }
  return max;
}

/**
 * SKIPPED in the automated suite.
 *
 * This spec predates the seeded-database e2e harness. It hard-codes
 * production event/track ids (event 672, tracks 54277/54279) that do NOT
 * exist in the deterministic `padmakara_test` seed dataset, so it cannot
 * run against the automated stack started by playwright.config.ts.
 *
 * It is kept (not deleted) because the A→B→A resume instrumentation it
 * contains is still a valuable manual regression check. To run it, point a
 * dev server at a backend that has event 672, then run this file directly
 * with `test.describe.skip` removed.
 *
 * The automated suite covers audio-player UI behaviour in audio-player.spec.ts
 * against the seeded fixtures instead.
 */
test.describe.skip('audio resume — A→B→A round trip', () => {
  test('the NEW A-player created on re-tap is seeked to A\'s saved position', async ({ page }) => {
    await setupInstrumentation(page);

    await page.goto(FIXTURE.eventPath);

    // Step 1 — tap A (Part 1, saved at 77s).
    await clickTrackRow(page, FIXTURE.trackA.label);
    // Wait for the player to actually load and seek. expo-audio resolves
    // the presigned URL, creates an HTMLAudioElement, and applies seek.
    // 5 s is generous on a local dev server.
    await page.waitForFunction(
      ({ pos }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const log = (window as any).__seekLog as Array<{ value?: number }>;
        return log.some((e) => e.value === pos);
      },
      { pos: FIXTURE.savedPosA },
      { timeout: 5000 },
    );

    let log = await readSeekLog(page);
    const aFirstId = maxAudioElId(log);
    expect(lastSeekOn(log, aFirstId)).toBe(FIXTURE.savedPosA);

    // Step 2 — tap B (Part 2, saved at 100s).
    await clickTrackRow(page, FIXTURE.trackB.label);
    await page.waitForFunction(
      ({ pos, startCount }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const log = (window as any).__seekLog as Array<{ value?: number; n: number }>;
        return log.some((e) => e.n > startCount && e.value === pos);
      },
      { pos: FIXTURE.savedPosB, startCount: log.length },
      { timeout: 5000 },
    );
    log = await readSeekLog(page);
    const bId = maxAudioElId(log);
    expect(bId).toBeGreaterThan(aFirstId);
    expect(lastSeekOn(log, bId)).toBe(FIXTURE.savedPosB);

    // Step 3 — tap A AGAIN. This is the regression point. With the bug,
    // the seek would land on the previous (B) audio element, the new
    // A audio element would never get seeked, and the slider would
    // show 0:00 (web) or play from 0 (iOS). With the fix, the newest
    // audio element is the one that gets seeked.
    const beforeReclick = await readSeekLog(page);
    const beforeReclickLogLen = beforeReclick.length;
    await clickTrackRow(page, FIXTURE.trackA.label);
    try {
      await page.waitForFunction(
        ({ pos, startCount }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const log = (window as any).__seekLog as Array<{ value?: number; n: number }>;
          return log.some((e) => e.n >= startCount && e.value === pos);
        },
        { pos: FIXTURE.savedPosA, startCount: beforeReclickLogLen },
        { timeout: 8000 },
      );
    } catch (err) {
      // Diagnostic dump — usually means the bug is present (new A-player
      // never got seeked) OR a timing issue. Print so we can tell which.
      const finalLog = await readSeekLog(page);
      // eslint-disable-next-line no-console
      console.error('\n  ✗ Expected seek to 77 after re-click. Full seek log:');
      for (const e of finalLog) {
        // eslint-disable-next-line no-console
        console.error('   ', JSON.stringify(e));
      }
      throw err;
    }

    log = await readSeekLog(page);
    const aSecondId = maxAudioElId(log);
    // A fresh audio element must have been created for the re-tap (the
    // presigned URL is regenerated, so useAudioPlayer's useMemo produces
    // a new player object).
    expect(aSecondId).toBeGreaterThan(bId);
    // CRITICAL ASSERTION: the new A audio element is the one that got
    // seeked to A's saved position — NOT some earlier audio element.
    expect(lastSeekOn(log, aSecondId)).toBe(FIXTURE.savedPosA);

    // Sanity: A's saved position in localStorage must not have been
    // overwritten to 0 during the round trip.
    const stored = await page.evaluate(
      (id) => JSON.parse(localStorage.getItem(`progress_${id}`) || 'null'),
      FIXTURE.trackA.id,
    );
    expect(stored.position).toBe(FIXTURE.savedPosA);
  });

  test('switching tracks never flashes the previous track\'s position or duration', async ({ page }) => {
    // Regression: expo-audio's useEvent hook caches the previous emitter's
    // last event in useState. When the player object changes (track switch
    // → new HTMLAudioElement), the cached state from the old player is
    // returned by useAudioPlayerStatus until the new player fires its
    // first event (~1 s away on web while metadata loads). During that
    // window, the position-formula's `phase === 'ready' → livePosition`
    // branch reads the OLD currentTime and OLD duration, making the slider
    // visibly flash the previous track's values for ~1 s before snapping
    // back to the correct ones. iOS doesn't hit this because its native
    // emitter fires synchronously.
    //
    // The fix detects status staleness via `status.id !== player.id` and
    // falls back to `player.currentTime` / `player.duration` (synchronous
    // getters that always reflect the player React is rendering).
    //
    // This test sets up A with a distinct saved position+duration from B,
    // opens A, waits for it to settle, then taps B and polls the visible
    // time strings for ~2.5 s. It asserts that the time strings NEVER show
    // A's MM:SS during that window.
    await setupInstrumentation(page);
    await page.goto(FIXTURE.eventPath);

    // Open A and wait for the seek + ready transition to settle.
    await clickTrackRow(page, FIXTURE.trackA.label);
    await page.waitForFunction(
      ({ pos }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const log = (window as any).__seekLog as Array<{ value?: number }>;
        return log.some((e) => e.value === pos);
      },
      { pos: FIXTURE.savedPosA },
      { timeout: 5000 },
    );
    // Tiny pad so the status update event has time to flow through.
    await page.waitForTimeout(200);

    // A's expected MM:SS string (position) — the value we must NOT see
    // appear on screen after we click B.
    const formatTime = (s: number) =>
      `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
    const aPositionString = formatTime(FIXTURE.savedPosA);
    const bPositionString = formatTime(FIXTURE.savedPosB);

    // Start the trace, then immediately tap B.
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__flashTrace = [] as Array<{ t: number; times: string[] }>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      w.__flashStart = performance.now();
      w.__flashInterval = setInterval(() => {
        const times = (document.body.innerText.match(/\d{1,3}:\d{2}/g) || []).slice(0, 4);
        w.__flashTrace.push({ t: Math.round(performance.now() - w.__flashStart), times });
      }, 16);
    });

    await clickTrackRow(page, FIXTURE.trackB.label);
    // Collect ~2.5 s of frames — long enough to cover the previous
    // ~1.2 s flash window with margin.
    await page.waitForTimeout(2500);

    const trace = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      clearInterval(w.__flashInterval);
      return w.__flashTrace as Array<{ t: number; times: string[] }>;
    });

    // Compress consecutive duplicates for an easier-to-read diagnostic.
    const transitions: Array<{ t: number; times: string[] }> = [];
    let last = '';
    for (const frame of trace) {
      const sig = JSON.stringify(frame.times);
      if (sig !== last) {
        transitions.push(frame);
        last = sig;
      }
    }

    // The slider must show B's position from the very first transition
    // (or 0:00 / target while loading) and never A's position once we've
    // clicked B. Anywhere A's position appears in the trace post-click is
    // a flash regression.
    // Sanity: the trace must observe B's correct saved position at some
    // point — otherwise this test would pass vacuously if e.g. the click
    // never registered.
    const firstBFrameIdx = trace.findIndex((f) => f.times.includes(bPositionString));
    if (firstBFrameIdx === -1) {
      // eslint-disable-next-line no-console
      console.error('  ✗ Trace never showed B\'s position (' + bPositionString + '). Transitions:');
      for (const t of transitions) {
        // eslint-disable-next-line no-console
        console.error('    t=' + t.t + 'ms ' + JSON.stringify(t.times));
      }
    }
    expect(firstBFrameIdx).toBeGreaterThanOrEqual(0);

    // Core assertion: once the slider has shown B's correct position,
    // it must NEVER show anything else for the rest of the observation
    // window. Any transition back to A's position, to 0:00, or to any
    // other value is a flash regression — the stale-status race
    // described in the AudioPlayerContext fix comment.
    //
    // (The fix detects status.id !== player.id and uses player.currentTime
    // / player.duration directly, so the displayed position remains
    // stable from the very first render where it's correct.)
    const flashAfter = trace.slice(firstBFrameIdx).find((f) => !f.times.includes(bPositionString));
    if (flashAfter) {
      // eslint-disable-next-line no-console
      console.error('  ✗ Slider flashed to ' + JSON.stringify(flashAfter.times) +
        ' at t=' + flashAfter.t + 'ms after settling at ' + bPositionString + '. Transitions:');
      for (const t of transitions) {
        // eslint-disable-next-line no-console
        console.error('    t=' + t.t + 'ms ' + JSON.stringify(t.times));
      }
    }
    expect(flashAfter).toBeUndefined();
  });
});
