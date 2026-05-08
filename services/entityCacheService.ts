import AsyncStorage from "@react-native-async-storage/async-storage";
import { CACHE_KEY_PREFIX } from "./cacheSchemaVersion";

export type Namespace = "events" | "groups" | "teachers" | "publications";

/**
 * A versioned namespace tuple. Both fields must match the remote values for
 * the cache to be considered up to date.
 *
 * - `global` — bumped when any entity in the namespace changes (admin CRUD)
 * - `user`   — bumped when an admin action changes THIS user's access
 *              (group/event membership, role/subscription edits)
 */
export interface NamespaceVersion {
  global: number;
  user: number;
}

/**
 * Storage key layout:
 *   @padmakara_cache:<namespace>:list           — JSON array of lightweight rows
 *   @padmakara_cache:<namespace>:detail:<id>    — JSON object for one entity's full detail
 *   @padmakara_cache:<namespace>:version        — JSON-encoded {global, user} tuple
 *
 * No TTL. Cache is invalidated only by:
 *   - schema version mismatch (handled by cacheSchemaVersion.ts at boot)
 *   - syncService noticing a remote namespace counter > local
 *
 * In-memory mirror:
 *   All async reads populate a module-level Map so that subsequent reads can
 *   be answered synchronously via getListSync / getDetailSync / getNamespaceVersionSync.
 *   Writes always update both AsyncStorage and the mirror so the mirror is
 *   always at least as fresh as persistent storage.
 */
export class EntityCacheService {
  // ─── In-memory mirrors ────────────────────────────────────────────────
  // `undefined` = not yet read from AsyncStorage in this session
  // `null`      = read from AsyncStorage and key was absent (cache miss)
  // `T`         = populated value
  private memoryList = new Map<Namespace, unknown[] | null>();
  private memoryDetail = new Map<string, unknown | null>();
  private memoryVersion = new Map<Namespace, NamespaceVersion | null>();

  // ─── Key helpers ──────────────────────────────────────────────────────

  private listKey(ns: Namespace): string {
    return `${CACHE_KEY_PREFIX}${ns}:list`;
  }
  private detailKey(ns: Namespace, id: number | string): string {
    return `${CACHE_KEY_PREFIX}${ns}:detail:${id}`;
  }
  private versionKey(ns: Namespace): string {
    return `${CACHE_KEY_PREFIX}${ns}:version`;
  }

  // ─── Async methods (AsyncStorage + mirror) ────────────────────────────

  async getList<T = unknown>(ns: Namespace): Promise<T[] | null> {
    if (this.memoryList.has(ns)) {
      return this.memoryList.get(ns) as T[] | null;
    }
    const raw = await AsyncStorage.getItem(this.listKey(ns));
    if (raw === null) {
      this.memoryList.set(ns, null);
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as T[];
      this.memoryList.set(ns, parsed);
      return parsed;
    } catch {
      this.memoryList.set(ns, null);
      return null;
    }
  }

  async setList<T = unknown>(ns: Namespace, items: T[]): Promise<void> {
    // Mirror first: in-memory always succeeds and keeps the session live
    // even if persistent storage rejects the write (e.g. localStorage quota
    // on web).
    this.memoryList.set(ns, items);
    await this.safeSetItem(this.listKey(ns), JSON.stringify(items));
  }

  async getDetail<T = unknown>(ns: Namespace, id: number | string): Promise<T | null> {
    const key = `${ns}:${id}`;
    if (this.memoryDetail.has(key)) {
      const value = this.memoryDetail.get(key);
      return value === null ? null : (value as T);
    }
    const raw = await AsyncStorage.getItem(this.detailKey(ns, id));
    if (raw === null) {
      this.memoryDetail.set(key, null);
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as T;
      this.memoryDetail.set(key, parsed);
      return parsed;
    } catch {
      this.memoryDetail.set(key, null);
      return null;
    }
  }

  async setDetail<T = unknown>(ns: Namespace, id: number | string, detail: T): Promise<void> {
    this.memoryDetail.set(`${ns}:${id}`, detail);
    await this.safeSetItem(this.detailKey(ns, id), JSON.stringify(detail));
  }

  /**
   * Returns the stored {global, user} version tuple for the namespace, or
   * null if no version has been persisted yet (cold cache / after wipe).
   */
  async getNamespaceVersion(ns: Namespace): Promise<NamespaceVersion | null> {
    if (this.memoryVersion.has(ns)) {
      return this.memoryVersion.get(ns) ?? null;
    }
    const raw = await AsyncStorage.getItem(this.versionKey(ns));
    if (raw === null) {
      this.memoryVersion.set(ns, null);
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as NamespaceVersion;
      if (
        typeof parsed.global === "number" &&
        typeof parsed.user === "number"
      ) {
        this.memoryVersion.set(ns, parsed);
        return parsed;
      }
    } catch {
      // fall through
    }
    // Malformed data (e.g. legacy bare number) — treat as cache miss
    this.memoryVersion.set(ns, null);
    return null;
  }

  async setNamespaceVersion(ns: Namespace, version: NamespaceVersion): Promise<void> {
    this.memoryVersion.set(ns, version);
    await this.safeSetItem(this.versionKey(ns), JSON.stringify(version));
  }

  // ─── Safe write helper ────────────────────────────────────────────────

  /**
   * Attempt to persist a key/value to AsyncStorage. On web the underlying
   * localStorage has a tight per-origin quota (~5 MB) which the events
   * list with all its nested data can exceed. When that happens we log a
   * warning and continue — the in-memory mirror keeps the session
   * functional and the next page load will refetch from the network.
   */
  private async safeSetItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (err) {
      if (this.isQuotaError(err)) {
        console.warn(
          `[cache] storage quota exceeded writing ${key} (${value.length} chars); falling back to in-memory only`,
        );
        return;
      }
      throw err;
    }
  }

  private isQuotaError(err: unknown): boolean {
    if (err == null || typeof err !== "object") return false;
    const e = err as { name?: unknown; message?: unknown; code?: unknown };
    if (e.name === "QuotaExceededError") return true;
    // Firefox uses code 22, Safari uses 1014, the message text is consistent
    if (e.code === 22 || e.code === 1014) return true;
    if (typeof e.message === "string" && /quota/i.test(e.message)) return true;
    return false;
  }

  // ─── Synchronous read methods (mirror only) ───────────────────────────
  //
  // Return `undefined` when the mirror has not been populated yet (AsyncStorage
  // not yet read this session), `null` when the key is absent, or the value.

  getListSync<T>(ns: Namespace): T[] | null | undefined {
    if (!this.memoryList.has(ns)) return undefined;
    return this.memoryList.get(ns) as T[] | null;
  }

  getDetailSync<T>(ns: Namespace, id: number | string): T | null | undefined {
    const key = `${ns}:${id}`;
    if (!this.memoryDetail.has(key)) return undefined;
    const value = this.memoryDetail.get(key);
    return value === null ? null : (value as T);
  }

  getNamespaceVersionSync(ns: Namespace): NamespaceVersion | null | undefined {
    if (!this.memoryVersion.has(ns)) return undefined;
    return this.memoryVersion.get(ns) ?? null;
  }

  // ─── Memory management ────────────────────────────────────────────────

  /** Wipe the in-memory mirror. Call this after AsyncStorage is wiped on
   *  schema-version mismatch so sync reads don't return stale data. */
  clearMemory(): void {
    this.memoryList.clear();
    this.memoryDetail.clear();
    this.memoryVersion.clear();
  }
}

export default new EntityCacheService();
