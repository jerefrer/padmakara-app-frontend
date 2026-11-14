import { useSyncExternalStore } from 'react';

/**
 * Whether a document reader has hidden its bars. The tab layout reads it to
 * hide the tab bar and the mini player too, so the page fills the screen.
 */
let immersive = false;
const listeners = new Set<() => void>();

export function setReaderImmersive(value: boolean): void {
  if (immersive === value) return;
  immersive = value;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useReaderImmersive(): boolean {
  return useSyncExternalStore(subscribe, () => immersive, () => false);
}
