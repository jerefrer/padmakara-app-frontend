/**
 * No-op default. Native platforms never wrote cache data to anything
 * other than AsyncStorage's native backend, which is also where the
 * cache adapter still routes — so there is nothing to clean up.
 *
 * The web build (`legacyCacheCleanup.web.ts`) sweeps orphaned
 * localStorage keys left over from before the IndexedDB migration.
 */
export async function cleanupLegacyWebCache(): Promise<void> {
  // intentionally empty
}
