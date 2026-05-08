import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Bump this whenever the on-disk cache shape changes incompatibly. On
 * the next app launch, all keys with CACHE_KEY_PREFIX (and any legacy
 * cache prefixes) are wiped, forcing a clean refetch from the backend.
 */
export const CACHE_SCHEMA_VERSION = 2;

/** Prefix for all cache keys written by entityCacheService. */
export const CACHE_KEY_PREFIX = "@padmakara_cache:";

/** Legacy prefixes from previous cache implementations — also wiped on
 * version mismatch so we never read stale data with a different shape. */
export const LEGACY_CACHE_PREFIXES = ["@retreat_cache:"];

const SCHEMA_VERSION_KEY = "@cache_schema_version";

/**
 * Run on app cold start before any cache reads. Compares the stored
 * version against CACHE_SCHEMA_VERSION; on mismatch, wipes all cache
 * keys and writes the new version. A missing stored version is treated
 * as a fresh install — no wipe is needed.
 */
export async function ensureCacheSchemaCurrent(): Promise<void> {
  const stored = await AsyncStorage.getItem(SCHEMA_VERSION_KEY);
  const current = String(CACHE_SCHEMA_VERSION);

  if (stored === current) return;

  if (stored !== null) {
    const allKeys = await AsyncStorage.getAllKeys();
    const toRemove = allKeys.filter(
      (k) =>
        k.startsWith(CACHE_KEY_PREFIX) ||
        LEGACY_CACHE_PREFIXES.some((p) => k.startsWith(p)),
    );
    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
    }
    // Wipe the in-memory mirror so stale data isn't served synchronously
    // after the AsyncStorage keys have been removed.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: entityCacheService } = require("./entityCacheService");
    entityCacheService.clearMemory();
  }

  await AsyncStorage.setItem(SCHEMA_VERSION_KEY, current);
}
