/**
 * Tiny external store for the live audio level shown by <LevelTrail>.
 *
 * Levels (0..1) arrive ~15 times per second while a track plays. They live
 * here instead of in React context state so that only the indicators
 * re-render, not the whole app. The store keeps a short rolling history,
 * newest level last.
 */

export const HISTORY_SIZE = 16;
const FADE_STEP_MS = 80;
const FADE_STEPS = 5;
const FADE_FACTOR = 0.4;
// Levels below this snap to exactly 0 during a fade.
const FADE_FLOOR = 0.02;

type Listener = () => void;

let history: readonly number[] = [];
const listeners = new Set<Listener>();
let fadeTimer: ReturnType<typeof setInterval> | null = null;

function notify(): void {
  listeners.forEach((l) => l());
}

function stopFade(): void {
  if (fadeTimer !== null) {
    clearInterval(fadeTimer);
    fadeTimer = null;
  }
}

/** Append the newest level (clamped to 0..1); the oldest one falls off. */
export function push(level: number): void {
  stopFade();
  const clamped = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
  history = [...history, clamped].slice(-HISTORY_SIZE);
  notify();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Stable reference between changes, as useSyncExternalStore requires. */
export function getHistory(): readonly number[] {
  return history;
}

/**
 * Shrink the history in place to the flat minimum over ~400 ms (no scrolling),
 * for when playback pauses or stops. A later push() cancels it.
 */
export function fadeOut(): void {
  stopFade();
  if (history.every((l) => l === 0)) return;
  let step = 0;
  fadeTimer = setInterval(() => {
    step += 1;
    const last = step >= FADE_STEPS;
    history = history.map((l) => {
      const next = l * FADE_FACTOR;
      return last || next < FADE_FLOOR ? 0 : next;
    });
    notify();
    if (last) stopFade();
  }, FADE_STEP_MS);
}

/** Forget everything, so indicators fall back to their static profile. */
export function reset(): void {
  stopFade();
  if (history.length === 0) return;
  history = [];
  notify();
}

// ─── Meter: raw audio frames → normalised, smoothed, throttled levels ───

const PUSH_INTERVAL_MS = 70;
const PEAK_DECAY = 0.998;
// Keeps silence (and the noise floor) from being amplified to full scale.
const PEAK_FLOOR = 0.01;
const HEADROOM = 0.85;
const ATTACK = 0.6;
const RELEASE = 0.25;

export function rms(frames: ArrayLike<number>): number {
  const n = frames.length;
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += frames[i] * frames[i];
  return Math.sqrt(sum / n);
}

export interface LevelMeter {
  /** Feed one audio sample buffer; pushes to the store at most every ~70 ms. */
  feed(frames: ArrayLike<number>, nowMs?: number): void;
}

/**
 * Automatic gain: a slow-moving peak normalises the RMS so quiet recordings
 * still move; fast attack and slower release smooth the result.
 */
export function createLevelMeter(sink: (level: number) => void = push): LevelMeter {
  let peak = PEAK_FLOOR;
  let smoothed = 0;
  let windowMax = 0;
  let lastPushAt = -Infinity;

  return {
    feed(frames, nowMs = Date.now()) {
      const value = rms(frames);
      peak = Math.max(value, peak * PEAK_DECAY, PEAK_FLOOR);
      windowMax = Math.max(windowMax, value);
      if (nowMs - lastPushAt < PUSH_INTERVAL_MS) return;
      lastPushAt = nowMs;
      const target = Math.min(1, windowMax / (peak * HEADROOM));
      windowMax = 0;
      smoothed += (target - smoothed) * (target > smoothed ? ATTACK : RELEASE);
      sink(smoothed);
    },
  };
}
