/**
 * "Show me this track in its event's list": asked by the players (tapping the track title in the
 * mini player, the desktop player bar or the phone's event player), answered by the event page,
 * which scrolls its list to the track.
 *
 * The request may come before the page exists (the mini player opens the event, then the page
 * mounts), so it is kept until a page claims it. It lapses after a few seconds: a request no page
 * took must not scroll an event the person opens later on their own, since opening a page shows
 * its top (André).
 */
const MAX_AGE_MS = 10_000;

let pending: { trackId: string; at: number } | null = null;
const listeners = new Set<() => void>();

export function requestTrackReveal(trackId: string | number): void {
  pending = { trackId: String(trackId), at: Date.now() };
  listeners.forEach((listener) => listener());
}

/** Offers the pending request to `accept`; it is cleared once accepted (or when it has lapsed). */
export function claimTrackReveal(accept: (trackId: string) => boolean): void {
  if (!pending) return;
  if (Date.now() - pending.at > MAX_AGE_MS) {
    pending = null;
    return;
  }
  if (accept(pending.trackId)) pending = null;
}

/** Called on every new request; returns the unsubscribe function. */
export function subscribeTrackReveal(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
