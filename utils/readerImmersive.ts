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

/**
 * Whether a document reader that takes the whole window is open (publications
 * and transcripts). The desktop shell reads it to drop its sidebar, right
 * panel and player bar while the document is on screen, on the web and on an
 * iPad. Unlike `immersive` it does not depend on the reader's bars.
 */
let fullWindow = false;
const fullWindowListeners = new Set<() => void>();

export function setReaderFullWindow(value: boolean): void {
  if (fullWindow === value) return;
  fullWindow = value;
  fullWindowListeners.forEach((listener) => listener());
}

function subscribeFullWindow(listener: () => void): () => void {
  fullWindowListeners.add(listener);
  return () => fullWindowListeners.delete(listener);
}

export function useReaderFullWindow(): boolean {
  return useSyncExternalStore(subscribeFullWindow, () => fullWindow, () => false);
}
