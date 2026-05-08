import apiService from "./apiService";
import { API_ENDPOINTS } from "./apiConfig";
import entityCacheService, { Namespace, EntityCacheService, NamespaceVersion } from "./entityCacheService";
import prefetchQueue, { PrefetchQueue } from "./prefetchQueue";
import { ensureCacheSchemaCurrent } from "./cacheSchemaVersion";

export type { NamespaceVersion };
export type RemoteVersionMap = Record<Namespace, NamespaceVersion>;

interface IndexRow {
  id: number;
  updatedAt: string;
  [key: string]: unknown;
}

interface SyncServiceDeps {
  cache?: EntityCacheService;
  queue?: PrefetchQueue;
}

const NAMESPACE_INDEX_ENDPOINT: Record<Namespace, string> = {
  events: API_ENDPOINTS.EVENTS,
  groups: API_ENDPOINTS.GROUPS,
  teachers: API_ENDPOINTS.TEACHERS,
  publications: API_ENDPOINTS.PUBLICATIONS,
};

/**
 * Per-namespace extractor: converts the raw index response into a plain
 * IndexRow[]. Most namespaces return an array directly; publications wraps
 * its array in `{ publications: [...], hasHiddenPublications: bool }`.
 */
const NAMESPACE_INDEX_EXTRACT: Record<Namespace, (data: unknown) => IndexRow[]> = {
  events: (d) => d as IndexRow[],
  groups: (d) => d as IndexRow[],
  teachers: (d) => d as IndexRow[],
  publications: (d) => ((d as { publications?: IndexRow[] })?.publications ?? []) as IndexRow[],
};

const NAMESPACE_DETAIL_ENDPOINT: Record<Namespace, (id: string | number) => string> = {
  events: (id) => API_ENDPOINTS.EVENT_DETAILS(String(id)),
  groups: (id) => `/groups/${id}`,
  teachers: (id) => API_ENDPOINTS.TEACHER_DETAILS(String(id)),
  publications: (id) => `/publications/${id}`,
};

/**
 * Per-namespace key extractor: maps a list row to the URL key used to
 * fetch its detail. Most namespaces use the numeric id; the teachers
 * endpoint is keyed by abbreviation string.
 */
const NAMESPACE_DETAIL_KEY: Record<Namespace, (row: IndexRow) => string | number> = {
  events: (r) => r.id,
  groups: (r) => r.id,
  teachers: (r) => (r as unknown as { abbreviation: string }).abbreviation,
  publications: (r) => r.id,
};

/**
 * Namespaces for which we skip per-entity detail prefetching. The list
 * refresh is sufficient; details are derived locally by the frontend.
 *
 * groups: the frontend builds group detail from the cached groups list +
 *         events list. There is no GET /groups/:id endpoint on the server.
 */
const NAMESPACES_WITHOUT_DETAIL_PREFETCH = new Set<Namespace>(["groups"]);

export class SyncService {
  private cache: EntityCacheService;
  private queue: PrefetchQueue;
  private static DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes
  private lastCheckAt: number | null = null;
  private inFlight: Promise<void> | null = null;

  constructor(deps: SyncServiceDeps = {}) {
    this.cache = deps.cache ?? entityCacheService;
    this.queue = deps.queue ?? prefetchQueue;
  }

  /** GET /api/sync/versions. Returns null on any failure (network, auth,
   * malformed response). syncService never throws — failures gracefully
   * leave the cache untouched. */
  async fetchRemoteVersions(): Promise<RemoteVersionMap | null> {
    const res = await apiService.get<RemoteVersionMap>(API_ENDPOINTS.SYNC_VERSIONS);
    if (!res.success || !res.data) return null;
    return res.data;
  }

  /**
   * Sync one namespace: refetch its lightweight list, diff per-entity
   * `updatedAt` against the cached list, prefetch details for entities
   * that are new or changed, persist the new namespace version.
   *
   * If the index fetch fails, the cache is left untouched (no version
   * bump locally) so we'll retry on the next sync trigger.
   */
  async syncNamespace(ns: Namespace, newVersion: NamespaceVersion): Promise<void> {
    const indexRes = await apiService.get<unknown>(NAMESPACE_INDEX_ENDPOINT[ns]);
    if (!indexRes.success || !indexRes.data) return;

    // Extract the plain array. Some namespaces wrap their list in an object
    // (e.g. publications returns { publications: [...], hasHiddenPublications }).
    const remoteList = NAMESPACE_INDEX_EXTRACT[ns](indexRes.data);
    const localList = (await this.cache.getList<IndexRow>(ns)) ?? [];

    // Diff: which entities are new or have a newer updatedAt than what
    // we have cached locally.
    const localById = new Map<number, IndexRow>(localList.map((r) => [r.id, r]));
    const changedIds: number[] = [];
    for (const row of remoteList) {
      const local = localById.get(row.id);
      if (!local || local.updatedAt !== row.updatedAt) {
        changedIds.push(row.id);
      }
    }

    // Persist the refreshed list first (always the plain array).
    await this.cache.setList(ns, remoteList);

    // Groups don't have a per-entity detail endpoint — the frontend derives
    // group detail from the cached list + events. Skip detail prefetch.
    if (NAMESPACES_WITHOUT_DETAIL_PREFETCH.has(ns)) {
      await this.cache.setNamespaceVersion(ns, newVersion);
      return;
    }

    // Prefetch changed details in the background.
    const tasks = changedIds.map((id) => async () => {
      const row = remoteList.find((r) => r.id === id);
      if (!row) return;
      // Use the namespace-specific key (e.g. teachers use abbreviation, not id).
      const urlKey = NAMESPACE_DETAIL_KEY[ns](row);
      const detailRes = await apiService.get<unknown>(NAMESPACE_DETAIL_ENDPOINT[ns](urlKey));
      if (detailRes.success && detailRes.data) {
        // Cache under the numeric id for consistent downstream lookup.
        await this.cache.setDetail(ns, id, detailRes.data);
      }
    });
    await this.queue.addAllSettled(tasks);

    // Persist namespace version last.
    await this.cache.setNamespaceVersion(ns, newVersion);
  }

  /**
   * Top-level sync entry point. Triggered on:
   *   - cold start (after auth restore)
   *   - app foreground (debounced via DEBOUNCE_MS)
   *   - pull-to-refresh (force=true)
   *
   * Idempotent: concurrent calls share one in-flight promise.
   */
  async checkAndSync(opts: { force?: boolean } = {}): Promise<void> {
    if (this.inFlight) return this.inFlight;

    if (!opts.force && this.lastCheckAt !== null) {
      const elapsed = Date.now() - this.lastCheckAt;
      if (elapsed < SyncService.DEBOUNCE_MS) return;
    }

    this.inFlight = this.runSync();
    try {
      await this.inFlight;
    } finally {
      this.inFlight = null;
      this.lastCheckAt = Date.now();
    }
  }

  private async runSync(): Promise<void> {
    // Ensure the cache schema is current before reading any cached values.
    // Idempotent and fast when the version matches (single AsyncStorage read).
    await ensureCacheSchemaCurrent();
    const remote = await this.fetchRemoteVersions();
    if (!remote) return;

    const namespaces: Namespace[] = ["events", "groups", "teachers", "publications"];
    for (const ns of namespaces) {
      const localVersion = await this.cache.getNamespaceVersion(ns);
      const remoteVersion = remote[ns];
      if (!remoteVersion) continue;

      // Resync if EITHER the global counter OR the user counter has changed.
      // localVersion null means cold cache → always resync.
      const same =
        localVersion !== null &&
        localVersion.global === remoteVersion.global &&
        localVersion.user === remoteVersion.user;
      if (same) continue;

      await this.syncNamespace(ns, remoteVersion);
    }
  }
}

export default new SyncService();
