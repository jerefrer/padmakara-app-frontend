import {
  createStore,
  del,
  delMany,
  get,
  keys,
  set,
  type UseStore,
} from "idb-keyval";

/**
 * Web build of the cache storage adapter. Metro selects this file in
 * place of `cacheStorage.ts` when bundling for the `web` platform.
 *
 * Backed by IndexedDB via `idb-keyval` rather than localStorage. The
 * default browser quota for IndexedDB is multiple gigabytes (vs ~5 MB
 * for localStorage), which removes the QuotaExceededError class of
 * failures that affected the cache when the events list grew.
 *
 * Values are stored as plain strings — the same shape the native
 * AsyncStorage path stores — so cache code does not need to know which
 * backend is in use.
 */
export interface CacheStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiRemove(keys: readonly string[]): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
}

let storeRef: UseStore | null = null;

function getStore(): UseStore {
  if (storeRef === null) {
    storeRef = createStore("padmakara-cache", "kv");
  }
  return storeRef;
}

const cacheStorage: CacheStorage = {
  async getItem(key) {
    const value = await get<string>(key, getStore());
    return value === undefined ? null : value;
  },
  async setItem(key, value) {
    await set(key, value, getStore());
  },
  async removeItem(key) {
    await del(key, getStore());
  },
  async multiRemove(keysToRemove) {
    if (keysToRemove.length === 0) return;
    await delMany(keysToRemove as string[], getStore());
  },
  async getAllKeys() {
    const allKeys = await keys(getStore());
    return allKeys.map((k) => String(k));
  },
};

export default cacheStorage;
