import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Storage adapter used by the entity cache layer.
 *
 * The native build (iOS/Android) delegates to AsyncStorage. The web build
 * is provided by `cacheStorage.web.ts`, which Metro automatically picks up
 * when bundling for web — that variant uses IndexedDB instead of
 * localStorage so the cache is no longer constrained by the ~5 MB
 * per-origin localStorage quota.
 *
 * The interface mirrors only the AsyncStorage methods the cache layer
 * actually uses; everything outside the cache (auth tokens, user prefs,
 * downloads metadata, …) keeps importing AsyncStorage directly.
 */
export interface CacheStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiRemove(keys: readonly string[]): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
}

const cacheStorage: CacheStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
  multiRemove: (keys) => AsyncStorage.multiRemove(keys as string[]),
  getAllKeys: () => AsyncStorage.getAllKeys(),
};

export default cacheStorage;
