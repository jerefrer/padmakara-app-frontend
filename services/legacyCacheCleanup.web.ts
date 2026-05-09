import { CACHE_KEY_PREFIX, LEGACY_CACHE_PREFIXES } from "./cacheSchemaVersion";

const CLEANUP_DONE_KEY = "@cache_localstorage_cleanup_done";
const SCHEMA_VERSION_KEY = "@cache_schema_version";

/**
 * One-time sweep that removes orphaned cache keys from localStorage on
 * the web build.
 *
 * Before the IndexedDB migration the entity cache wrote to localStorage
 * via AsyncStorage's web adapter. After the migration those keys are
 * dead weight that still counts against the ~5 MB localStorage quota,
 * which can cause unrelated AsyncStorage writes (audio progress,
 * bookmarks, auth state, …) to fail with QuotaExceededError.
 *
 * Idempotent — flagged in localStorage itself (~32 bytes) so repeated
 * boots are essentially free.
 */
export async function cleanupLegacyWebCache(): Promise<void> {
  if (typeof window === "undefined" || !window.localStorage) return;

  try {
    if (window.localStorage.getItem(CLEANUP_DONE_KEY) === "1") return;

    const allPrefixes = [CACHE_KEY_PREFIX, ...LEGACY_CACHE_PREFIXES];
    const toRemove: string[] = [];

    // localStorage.length / .key(i) is sync and inexpensive.
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k === null) continue;
      if (allPrefixes.some((p) => k.startsWith(p))) {
        toRemove.push(k);
      }
    }
    // The schema version key is now stored in IndexedDB; the
    // localStorage copy is orphaned.
    toRemove.push(SCHEMA_VERSION_KEY);

    for (const k of toRemove) {
      try {
        window.localStorage.removeItem(k);
      } catch {
        // best-effort — keep going
      }
    }

    window.localStorage.setItem(CLEANUP_DONE_KEY, "1");

    if (toRemove.length > 1) {
      console.info(
        `[cache] swept ${toRemove.length} orphaned localStorage keys ` +
          "left over from pre-IndexedDB cache",
      );
    }
  } catch (err) {
    console.warn("[cache] legacy localStorage cleanup failed", err);
  }
}
