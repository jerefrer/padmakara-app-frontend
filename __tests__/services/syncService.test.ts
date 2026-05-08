import AsyncStorage from "@react-native-async-storage/async-storage";
import apiService from "../../services/apiService";
import { SyncService } from "../../services/syncService";
import type { NamespaceVersion } from "../../services/syncService";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    getAllKeys: jest.fn(),
    multiRemove: jest.fn(),
  },
}));

jest.mock("../../services/apiService", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

// Helper to build a NamespaceVersion tuple
const v = (global: number, user: number): NamespaceVersion => ({ global, user });

describe("SyncService.fetchRemoteVersions", () => {
  let svc: SyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new SyncService();
  });

  it("returns the version map on success", async () => {
    (apiService.get as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        events:       v(42, 5),
        groups:       v(7,  5),
        teachers:     v(17, 5),
        publications: v(23, 5),
      },
    });

    const result = await svc.fetchRemoteVersions();

    expect(result).toEqual({
      events:       { global: 42, user: 5 },
      groups:       { global: 7,  user: 5 },
      teachers:     { global: 17, user: 5 },
      publications: { global: 23, user: 5 },
    });
    expect(apiService.get).toHaveBeenCalledWith("/sync/versions");
  });

  it("returns null on failure", async () => {
    (apiService.get as jest.Mock).mockResolvedValue({ success: false, error: "network" });
    const result = await svc.fetchRemoteVersions();
    expect(result).toBeNull();
  });
});

describe("SyncService.syncNamespace (events)", () => {
  let svc: SyncService;
  const cache = {
    getList: jest.fn(),
    setList: jest.fn(),
    getDetail: jest.fn(),
    setDetail: jest.fn(),
    getNamespaceVersion: jest.fn(),
    setNamespaceVersion: jest.fn(),
  };
  const queue = { addAllSettled: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new SyncService({ cache: cache as any, queue: queue as any });
  });

  it("fetches the index, diffs by updatedAt, prefetches changed details, updates version", async () => {
    cache.getList.mockResolvedValue([
      { id: 1, updatedAt: "2026-05-01T00:00:00Z" },
      { id: 2, updatedAt: "2026-05-01T00:00:00Z" },
    ]);
    (apiService.get as jest.Mock)
      // first call: fetch /events index
      .mockResolvedValueOnce({
        success: true,
        data: [
          { id: 1, updatedAt: "2026-05-01T00:00:00Z" },
          { id: 2, updatedAt: "2026-05-08T00:00:00Z" }, // changed
          { id: 3, updatedAt: "2026-05-08T00:00:00Z" }, // new
        ],
      })
      // subsequent calls: fetch detail for id=2 and id=3
      .mockResolvedValue({ success: true, data: { id: 0, sessions: [] } });

    queue.addAllSettled.mockImplementation(async (tasks: any[]) => {
      for (const t of tasks) await t();
      return [];
    });

    await svc.syncNamespace("events", v(42, 7));

    // List was refreshed
    expect(cache.setList).toHaveBeenCalledWith("events", [
      { id: 1, updatedAt: "2026-05-01T00:00:00Z" },
      { id: 2, updatedAt: "2026-05-08T00:00:00Z" },
      { id: 3, updatedAt: "2026-05-08T00:00:00Z" },
    ]);
    // Two changed entities → two detail fetches queued
    expect((queue.addAllSettled as jest.Mock).mock.calls[0][0]).toHaveLength(2);
    // Namespace version persisted as tuple
    expect(cache.setNamespaceVersion).toHaveBeenCalledWith("events", v(42, 7));
  });

  it("does no detail prefetch when nothing changed (only the namespace counter)", async () => {
    cache.getList.mockResolvedValue([
      { id: 1, updatedAt: "2026-05-01T00:00:00Z" },
    ]);
    (apiService.get as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: [{ id: 1, updatedAt: "2026-05-01T00:00:00Z" }],
    });
    queue.addAllSettled.mockResolvedValue([]);

    await svc.syncNamespace("events", v(42, 7));

    expect(queue.addAllSettled).toHaveBeenCalledWith([]);
    expect(cache.setNamespaceVersion).toHaveBeenCalledWith("events", v(42, 7));
  });

  it("aborts when the index fetch fails (cache untouched)", async () => {
    cache.getList.mockResolvedValue([{ id: 1, updatedAt: "2026-05-01T00:00:00Z" }]);
    (apiService.get as jest.Mock).mockResolvedValue({ success: false, error: "network" });

    await svc.syncNamespace("events", v(42, 7));

    expect(cache.setList).not.toHaveBeenCalled();
    expect(cache.setNamespaceVersion).not.toHaveBeenCalled();
    expect(queue.addAllSettled).not.toHaveBeenCalled();
  });
});

describe("SyncService.syncNamespace (publications — wrapped response)", () => {
  let svc: SyncService;
  const cache = {
    getList: jest.fn(),
    setList: jest.fn(),
    getDetail: jest.fn(),
    setDetail: jest.fn(),
    getNamespaceVersion: jest.fn(),
    setNamespaceVersion: jest.fn(),
  };
  const queue = { addAllSettled: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new SyncService({ cache: cache as any, queue: queue as any });
  });

  it("unwraps the publications array from the wrapped response before diffing and persisting", async () => {
    cache.getList.mockResolvedValue([]);
    (apiService.get as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: {
        publications: [
          { id: 1, updatedAt: "2026-05-01T00:00:00Z" },
          { id: 2, updatedAt: "2026-05-01T00:00:00Z" },
        ],
        hasHiddenPublications: true,
      },
    });
    queue.addAllSettled.mockImplementation(async (tasks: any[]) => {
      for (const t of tasks) await t();
      return [];
    });
    (apiService.get as jest.Mock).mockResolvedValue({ success: true, data: {} });

    await svc.syncNamespace("publications", v(5, 2));

    // setList must receive the plain array, not the wrapped object
    expect(cache.setList).toHaveBeenCalledWith("publications", [
      { id: 1, updatedAt: "2026-05-01T00:00:00Z" },
      { id: 2, updatedAt: "2026-05-01T00:00:00Z" },
    ]);
    expect(cache.setNamespaceVersion).toHaveBeenCalledWith("publications", v(5, 2));
  });
});

describe("SyncService.syncNamespace (teachers — abbreviation key)", () => {
  let svc: SyncService;
  const cache = {
    getList: jest.fn(),
    setList: jest.fn(),
    getDetail: jest.fn(),
    setDetail: jest.fn(),
    getNamespaceVersion: jest.fn(),
    setNamespaceVersion: jest.fn(),
  };
  const queue = { addAllSettled: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new SyncService({ cache: cache as any, queue: queue as any });
  });

  it("prefetches teacher detail using abbreviation, not numeric id", async () => {
    cache.getList.mockResolvedValue([]);
    (apiService.get as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: [{ id: 3, abbreviation: "JKR", updatedAt: "2026-05-01T00:00:00Z" }],
    });

    // Capture URLs that detail prefetch tasks call.
    const calledUrls: string[] = [];
    queue.addAllSettled.mockImplementation(async (tasks: any[]) => {
      for (const t of tasks) {
        // Wrap apiService.get to record the URL.
        (apiService.get as jest.Mock).mockImplementationOnce((url: string) => {
          calledUrls.push(url);
          return Promise.resolve({ success: true, data: { id: 3 } });
        });
        await t();
      }
      return [];
    });

    await svc.syncNamespace("teachers", v(10, 0));

    expect(calledUrls).toHaveLength(1);
    expect(calledUrls[0]).toBe("/teachers/JKR");
    expect(calledUrls[0]).not.toBe("/teachers/3");
    // Detail is still cached under the numeric id.
    expect(cache.setDetail).toHaveBeenCalledWith("teachers", 3, { id: 3 });
  });
});

describe("SyncService.syncNamespace (groups — no detail prefetch)", () => {
  let svc: SyncService;
  const cache = {
    getList: jest.fn(),
    setList: jest.fn(),
    getDetail: jest.fn(),
    setDetail: jest.fn(),
    getNamespaceVersion: jest.fn(),
    setNamespaceVersion: jest.fn(),
  };
  const queue = { addAllSettled: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new SyncService({ cache: cache as any, queue: queue as any });
  });

  it("persists list and version but never enqueues detail tasks for groups", async () => {
    cache.getList.mockResolvedValue([]);
    (apiService.get as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: [
        { id: 1, updatedAt: "2026-05-01T00:00:00Z" },
        { id: 2, updatedAt: "2026-05-01T00:00:00Z" },
      ],
    });

    await svc.syncNamespace("groups", v(7, 3));

    // List was saved.
    expect(cache.setList).toHaveBeenCalledWith("groups", [
      { id: 1, updatedAt: "2026-05-01T00:00:00Z" },
      { id: 2, updatedAt: "2026-05-01T00:00:00Z" },
    ]);
    // Version was bumped as tuple.
    expect(cache.setNamespaceVersion).toHaveBeenCalledWith("groups", v(7, 3));
    // No detail prefetch queue was called for group detail fetches.
    expect(queue.addAllSettled).not.toHaveBeenCalled();
    // No individual group detail API call was made (only the list call).
    expect((apiService.get as jest.Mock).mock.calls).toHaveLength(1);
  });
});

describe("SyncService.checkAndSync (schema wipe before cache reads)", () => {
  let svc: SyncService;
  const cache = {
    getList: jest.fn(),
    setList: jest.fn(),
    getDetail: jest.fn(),
    setDetail: jest.fn(),
    getNamespaceVersion: jest.fn(),
    setNamespaceVersion: jest.fn(),
  };
  const queue = { addAllSettled: jest.fn().mockResolvedValue([]) };

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new SyncService({ cache: cache as any, queue: queue as any });
  });

  it("calls ensureCacheSchemaCurrent (via AsyncStorage schema read) before fetching remote versions", async () => {
    // Simulate an old schema version in storage — the wipe should happen
    // before any cache namespace reads.
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === "@cache_schema_version") return Promise.resolve("0");
      return Promise.resolve(null);
    });
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
      "@padmakara_cache:events:list",
    ]);
    (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

    // Remote versions fetch fails — that's fine, we only care that schema
    // check ran first.
    (apiService.get as jest.Mock).mockResolvedValue({ success: false, error: "x" });

    await svc.checkAndSync();

    // ensureCacheSchemaCurrent reads the schema version key.
    expect(AsyncStorage.getItem).toHaveBeenCalledWith("@cache_schema_version");
    // On mismatch, it wipes cache keys.
    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
      "@padmakara_cache:events:list",
    ]);
  });
});

describe("SyncService.checkAndSync", () => {
  let svc: SyncService;
  const cache = {
    getList: jest.fn(),
    setList: jest.fn(),
    getDetail: jest.fn(),
    setDetail: jest.fn(),
    getNamespaceVersion: jest.fn(),
    setNamespaceVersion: jest.fn(),
  };
  const queue = { addAllSettled: jest.fn().mockResolvedValue([]) };

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new SyncService({ cache: cache as any, queue: queue as any });
  });

  it("syncs each namespace whose remote version differs from local", async () => {
    (apiService.get as jest.Mock)
      .mockResolvedValueOnce({
        success: true,
        data: {
          events:       v(42, 5),
          groups:       v(7,  5),
          teachers:     v(17, 5),
          publications: v(23, 5),
        },
      })
      .mockResolvedValue({ success: true, data: [] });

    cache.getNamespaceVersion
      .mockResolvedValueOnce(v(40, 5)) // events: global stale
      .mockResolvedValueOnce(v(7,  5)) // groups: same
      .mockResolvedValueOnce(v(17, 5)) // teachers: same
      .mockResolvedValueOnce(v(20, 5)); // publications: global stale
    cache.getList.mockResolvedValue([]);

    await svc.checkAndSync();

    expect(cache.setList).toHaveBeenCalledWith("events", []);
    expect(cache.setList).toHaveBeenCalledWith("publications", []);
    expect(cache.setList).not.toHaveBeenCalledWith("groups", expect.anything());
    expect(cache.setList).not.toHaveBeenCalledWith("teachers", expect.anything());
  });

  it("resyncs when user counter changes even if global is the same", async () => {
    (apiService.get as jest.Mock)
      .mockResolvedValueOnce({
        success: true,
        data: {
          events:       v(42, 8), // user bumped from 5 → 8
          groups:       v(7,  8),
          teachers:     v(17, 8),
          publications: v(23, 8),
        },
      })
      .mockResolvedValue({ success: true, data: [] });

    // Local: all global same, but user = 5 (old)
    cache.getNamespaceVersion.mockResolvedValue(v(42, 5));
    // For events/publications, the global didn't change but user did
    cache.getNamespaceVersion
      .mockResolvedValueOnce(v(42, 5)) // events: user stale
      .mockResolvedValueOnce(v(7,  5)) // groups: user stale
      .mockResolvedValueOnce(v(17, 5)) // teachers: user stale
      .mockResolvedValueOnce(v(23, 5)); // publications: user stale
    cache.getList.mockResolvedValue([]);

    await svc.checkAndSync();

    // All four namespaces should sync since user counter changed for all
    expect(cache.setList).toHaveBeenCalledWith("events", []);
    expect(cache.setList).toHaveBeenCalledWith("publications", []);
  });

  it("skips namespace when both global and user match", async () => {
    (apiService.get as jest.Mock)
      .mockResolvedValueOnce({
        success: true,
        data: {
          events:       v(42, 5),
          groups:       v(7,  5),
          teachers:     v(17, 5),
          publications: v(23, 5),
        },
      });

    // All local versions match remote exactly
    cache.getNamespaceVersion.mockResolvedValue(null); // return null for all
    cache.getNamespaceVersion
      .mockResolvedValueOnce(v(42, 5)) // events: exact match
      .mockResolvedValueOnce(v(7,  5)) // groups: exact match
      .mockResolvedValueOnce(v(17, 5)) // teachers: exact match
      .mockResolvedValueOnce(v(23, 5)); // publications: exact match

    await svc.checkAndSync();

    // Nothing should be synced
    expect(cache.setList).not.toHaveBeenCalled();
  });

  it("skips when called within debounce window unless force=true", async () => {
    (apiService.get as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        events:       v(1, 1),
        groups:       v(1, 1),
        teachers:     v(1, 1),
        publications: v(1, 1),
      },
    });
    cache.getNamespaceVersion.mockResolvedValue(v(1, 1));

    await svc.checkAndSync();
    expect(apiService.get).toHaveBeenCalledTimes(1);

    await svc.checkAndSync();
    expect(apiService.get).toHaveBeenCalledTimes(1);

    await svc.checkAndSync({ force: true });
    expect(apiService.get).toHaveBeenCalledTimes(2);
  });

  it("no-ops when remote versions fetch fails", async () => {
    (apiService.get as jest.Mock).mockResolvedValue({ success: false, error: "x" });
    await svc.checkAndSync();
    expect(cache.setList).not.toHaveBeenCalled();
    expect(cache.setNamespaceVersion).not.toHaveBeenCalled();
  });
});
