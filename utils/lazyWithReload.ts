import { lazy, type ComponentType } from 'react';

const RELOAD_FLAG = 'padmakara:chunk-reload';

/**
 * React.lazy for web chunks that reloads the page once when the chunk cannot be fetched.
 * A tab opened before a deploy asks for a chunk file of the old build; if it is gone,
 * a reload brings the current build instead of leaving a blank page. The flag stops a
 * reload loop when the chunk fails for another reason (offline): the error then
 * reaches the caller as usual.
 */
export function lazyWithReload<T extends ComponentType<any>>(
  load: () => Promise<{ default: T }>,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined = safeSessionStorage(),
  reload: () => void = () => window.location.reload(),
) {
  return lazy(async () => {
    try {
      const mod = await load();
      storage?.removeItem(RELOAD_FLAG);
      return mod;
    } catch (error) {
      if (storage && !storage.getItem(RELOAD_FLAG)) {
        storage.setItem(RELOAD_FLAG, '1');
        reload();
        // Keep Suspense on its fallback until the page goes away.
        return new Promise<never>(() => {});
      }
      throw error;
    }
  });
}

function safeSessionStorage() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : undefined;
  } catch {
    return undefined;
  }
}
